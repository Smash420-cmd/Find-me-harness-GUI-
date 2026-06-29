/**
 * PlaywrightValidator — the Tier-3 proof-shot capture (IValidationProvider).
 *
 * Sandboxing (Plan B.4 / Constitution Law): every capture runs in a FRESH
 * browser context that is torn down in `finally`, so a hostile retailer page
 * cannot persist state or reach the engine. The render is also network-isolated:
 * the page makes no direct requests — every request is intercepted and fulfilled
 * from a server-side fetch of the SAME registrable domain only; everything else
 * (analytics, third-party CDNs) is aborted. The screenshot is the user-facing
 * proof that the kit, its price, and its availability are real.
 */
import { chromium, type Browser } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { VerificationTier } from "../../types/index.js";
import type { CaptureResult, ExtractSpec, IValidationProvider } from "../index.js";
import { USER_AGENT } from "../net.js";

export interface PlaywrightValidatorOptions {
  /** Path to a chromium binary; defaults to the env's pre-installed browser. */
  readonly executablePath?: string;
  /** Where proof-shot images are written. */
  readonly artifactDir?: string;
  readonly navTimeoutMs?: number;
}

/** The registrable (base) domain of a host, e.g. www.umart.com.au → umart.com.au. */
function baseDomain(host: string): string {
  const parts = host.split(".");
  return parts.length <= 2 ? host : parts.slice(-3).join("."); // handles co.au-style suffixes
}

/**
 * Resolve a chromium binary. Prefer an explicit option/env; otherwise use the
 * managed-environment symlink IF it exists; else return undefined so Playwright
 * falls back to its own downloaded browser (portable to a normal dev machine).
 */
function resolveExecutable(opt?: string): string | undefined {
  const explicit = opt ?? process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (explicit) return explicit;
  const managed = "/opt/pw-browsers/chromium";
  return existsSync(managed) ? managed : undefined;
}

export class PlaywrightValidator implements IValidationProvider {
  private readonly artifactDir: string;
  private readonly navTimeoutMs: number;
  private readonly executablePath: string | undefined;

  constructor(opts: PlaywrightValidatorOptions = {}) {
    this.artifactDir = opts.artifactDir ?? "/tmp/harness-proofs";
    this.navTimeoutMs = opts.navTimeoutMs ?? 60_000;
    this.executablePath = resolveExecutable(opts.executablePath);
  }

  async capture(target: {
    url: string;
    mustShow: string;
    extract?: Record<string, ExtractSpec>;
  }): Promise<CaptureResult> {
    await mkdir(this.artifactDir, { recursive: true });
    const allow = baseDomain(new URL(target.url).host);

    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: this.executablePath,
        args: ["--disable-background-networking", "--disable-quic", "--no-default-browser-check"],
      });
      // A fresh, isolated, ephemeral context — discarded in finally.
      const ctx = await browser.newContext({ userAgent: USER_AGENT });
      const page = await ctx.newPage();

      // Network isolation: fulfil same-domain requests from a server-side fetch
      // (which traverses the proxy); abort everything else.
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        let host = "";
        try {
          host = new URL(url).host;
        } catch {
          return route.abort();
        }
        if (host !== allow && !host.endsWith(`.${allow}`)) return route.abort();
        try {
          const r = await fetch(url, { headers: { "user-agent": USER_AGENT } });
          const body = Buffer.from(await r.arrayBuffer());
          return route.fulfill({
            status: r.status,
            headers: { "content-type": r.headers.get("content-type") ?? "application/octet-stream" },
            body,
          });
        } catch {
          return route.abort();
        }
      });

      await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: this.navTimeoutMs });
      await page.waitForTimeout(800); // let above-the-fold settle

      // Read the requested fields off THIS render — the same DOM we screenshot —
      // so the caller can confirm liveness on exactly what the proof shows (F1).
      const fields: Record<string, string | null> = {};
      for (const [name, spec] of Object.entries(target.extract ?? {})) {
        try {
          fields[name] = spec.attr
            ? await page.getAttribute(spec.selector, spec.attr)
            : ((await page.locator(spec.selector).first().textContent()) ?? null);
        } catch {
          fields[name] = null;
        }
      }

      const artifactRef = join(this.artifactDir, `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
      const png = await page.screenshot({ fullPage: false });
      await writeFile(artifactRef, png);

      return {
        proof: {
          tier: VerificationTier.Vision,
          artifactRef,
          capturedAt: Date.now(),
          shows: target.mustShow,
        },
        fields,
      };
    } finally {
      await browser?.close(); // ephemeral: nothing rendered survives the capture
    }
  }
}
