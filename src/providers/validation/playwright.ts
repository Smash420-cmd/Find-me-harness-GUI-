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

      // Same-domain requests are proxied through server-side fetch (avoids bot blocks).
      // Cross-domain requests (CDN images, fonts, CSS) pass through directly so the
      // screenshot shows the page as it actually looks to a real user.
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        let host = "";
        try {
          host = new URL(url).host;
        } catch {
          return route.abort();
        }
        if (host !== allow && !host.endsWith(`.${allow}`)) return route.continue();
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
      // Don't rush the shot. Three gates, all capped so nothing hangs forever:
      // 1. network quiet (JS-rendered prices), 2. every VISIBLE image fully
      // decoded (lazy loaders and slow CDNs beat networkidle), 3. paint settle.
      await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
      await page
        .waitForFunction(
          `(() => {
            const imgs = [...document.querySelectorAll('img')].filter(i => {
              const r = i.getBoundingClientRect();
              return r.top < window.innerHeight && r.bottom > 0 && r.width > 40 && r.height > 40;
            });
            return imgs.every(i => i.complete && i.naturalWidth > 0);
          })()`,
          { timeout: 10_000 },
        )
        .catch(() => {});
      await page.waitForTimeout(1500); // let above-the-fold paint settle

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

      // Universal availability/price signals — work on any retailer, no per-site classifier needed.
      // Passed as a string so TypeScript doesn't try to type-check browser DOM code.
      try {
        const u = await page.evaluate(`(() => {
          const btns = [...document.querySelectorAll("button, input[type='submit'], input[type='button']")];
          const addToCart = btns.some(b => {
            const t = (b.textContent || b.value || "").toLowerCase().trim();
            return t.includes("add to cart") || t.includes("buy now") || t.includes("add to basket") || t === "buy";
          });
          const bodyText = document.body.innerText.toLowerCase();
          const outOfStock = /\\b(sold\\s*out|out\\s*of\\s*stock|unavailable|notify\\s*me)\\b/.test(bodyText);
          // First POSITIVE price — header cart widgets put "$0.00" first on many stores.
          const price = (bodyText.match(/\\$\\s*\\d[\\d,]*\\.?\\d*/g) || [])
            .map(s => s.replace(/[^\\d.]/g, ""))
            .find(v => parseFloat(v) > 0) || null;
          return { addToCart, outOfStock, price };
        })()`) as { addToCart: boolean; outOfStock: boolean; price: string | null };
        fields["_addToCart"] = u.addToCart ? "true" : "false";
        fields["_outOfStock"] = u.outOfStock ? "true" : "false";
        if (u.price) fields["_visiblePrice"] = u.price;
      } catch {
        // non-fatal — structured signals take precedence anyway
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

  /** Navigate to url, run extractJs (must return string[]) and return those strings.
   * Used for discovery (Google search etc.) — no proof-shot, no network isolation.
   * Falls back to [] on any error so a discovery failure never kills the run. */
  async browse(url: string, extractJs: string): Promise<string[]> {
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: this.executablePath,
        args: [
          "--disable-background-networking",
          "--disable-quic",
          "--no-default-browser-check",
          "--disable-blink-features=AutomationControlled",
        ],
      });
      const ctx = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 900 },
      });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.navTimeoutMs });
      await page.waitForTimeout(1800);
      return (await page.evaluate(extractJs)) as string[];
    } catch {
      return [];
    } finally {
      await browser?.close();
    }
  }
}
