/**
 * Frozen worlds (Spec 006, Plan Step 1) — record/replay decorators at the
 * provider seam. The tool belt never changes: it talks to a world that is
 * either live (recording) or canned (replaying).
 *
 * Layout of a world directory:
 *   fetch/<sha256(url)>.json            { url, body } | { url, error }
 *   browse/<sha256(url\nextractJs)>.json { url, extractJs, result }
 *   capture/<sha256(url)>.json          { url, fields, proof } (+ .png beside it)
 *
 * Replay miss policy (exam mode): a miss is a walled response — a plain 404
 * for fetch/capture, an empty result for browse (browse is fail-soft live
 * too). NEVER a live fetch: the Student cannot escape the snapshot. Error
 * strings replay verbatim — a 403 is a 403, and nothing student-visible may
 * mention worlds, exams, or recording (Spec 006 C1: name the world, never
 * the grading).
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureResult, ExtractSpec, RenderProvider } from "../providers/index.js";
import { liveFetchText, setFetchTextImpl } from "../providers/net.js";

export type WorldMode = "record" | "replay";
export type FetchFn = (url: string, init?: RequestInit) => Promise<string>;
export type { RenderProvider };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const writeJson = (p: string, o: unknown) => writeFileSync(p, JSON.stringify(o, null, 1));

// ── fetch ─────────────────────────────────────────────────────────────────

export function recordingFetch(dir: string, base: FetchFn = liveFetchText): FetchFn {
  mkdirSync(join(dir, "fetch"), { recursive: true });
  return async (url, init) => {
    const p = join(dir, "fetch", `${sha(url)}.json`);
    try {
      const body = await base(url, init);
      writeJson(p, { url, body });
      return body;
    } catch (e) {
      writeJson(p, { url, error: String(e instanceof Error ? e.message : e) });
      throw e;
    }
  };
}

export function replayFetch(dir: string): FetchFn {
  return async (url) => {
    const p = join(dir, "fetch", `${sha(url)}.json`);
    if (!existsSync(p)) throw new Error(`GET ${url} → 404`);
    const rec = readJson<{ url: string; body?: string; error?: string }>(p);
    if (rec.error !== undefined) throw new Error(rec.error);
    return rec.body!;
  };
}

// ── render (capture + browse) ─────────────────────────────────────────────

interface CaptureRecord {
  readonly url: string;
  readonly mustShow: string;
  readonly fields: CaptureResult["fields"];
  readonly proof: Omit<CaptureResult["proof"], "artifactRef">;
  readonly error?: string;
}

export class RecordingValidator implements RenderProvider {
  constructor(private readonly inner: RenderProvider, private readonly dir: string) {
    mkdirSync(join(dir, "capture"), { recursive: true });
    mkdirSync(join(dir, "browse"), { recursive: true });
  }

  async capture(target: { url: string; mustShow: string; extract?: Record<string, ExtractSpec> }): Promise<CaptureResult> {
    const key = sha(target.url);
    const p = join(this.dir, "capture", `${key}.json`);
    try {
      const result = await this.inner.capture(target);
      const { artifactRef, ...proofRest } = result.proof;
      copyFileSync(artifactRef, join(this.dir, "capture", `${key}.png`));
      const rec: CaptureRecord = { url: target.url, mustShow: target.mustShow, fields: result.fields, proof: proofRest };
      writeJson(p, rec);
      return result;
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      writeJson(p, { url: target.url, mustShow: target.mustShow, fields: {}, proof: {}, error: msg });
      throw e;
    }
  }

  browse(url: string, extractJs: string): Promise<string[]> {
    const p = join(this.dir, "browse", `${sha(`${url}\n${extractJs}`)}.json`);
    return this.inner.browse(url, extractJs).then((result) => {
      writeJson(p, { url, extractJs, result });
      return result;
    });
  }
}

export class ReplayValidator implements RenderProvider {
  constructor(private readonly dir: string) {}

  async capture(target: { url: string; mustShow: string; extract?: Record<string, ExtractSpec> }): Promise<CaptureResult> {
    const key = sha(target.url);
    const p = join(this.dir, "capture", `${key}.json`);
    if (!existsSync(p)) throw new Error(`GET ${target.url} → 404`);
    const rec = readJson<CaptureRecord>(p);
    if (rec.error !== undefined) throw new Error(rec.error);
    // The stored PNG is the proof; capturedAt replays frozen (deterministic world, deterministic time).
    return {
      proof: { ...rec.proof, artifactRef: join(this.dir, "capture", `${key}.png`) } as CaptureResult["proof"],
      fields: rec.fields,
    };
  }

  async browse(url: string, extractJs: string): Promise<string[]> {
    const p = join(this.dir, "browse", `${sha(`${url}\n${extractJs}`)}.json`);
    if (!existsSync(p)) return []; // browse is fail-soft live too
    return readJson<{ result: string[] }>(p).result;
  }
}

// ── composition-root wiring ───────────────────────────────────────────────

/**
 * Wire the world from WORLD_MODE / WORLD_DIR env vars. Called ONLY from the
 * entry point (start.ts) — the one place allowed to import src/exam from the
 * harness side. No env vars set → everything stays live and untouched.
 */
export function worldFromEnv(inner: RenderProvider): RenderProvider {
  const mode = process.env.WORLD_MODE as WorldMode | undefined;
  const dir = process.env.WORLD_DIR;
  if (!mode) return inner;
  if (!dir) throw new Error("WORLD_MODE is set but WORLD_DIR is not");
  if (mode === "record") {
    setFetchTextImpl(recordingFetch(dir));
    console.log(`[world] RECORDING to ${dir}`);
    return new RecordingValidator(inner, dir);
  }
  setFetchTextImpl(replayFetch(dir));
  console.log(`[world] REPLAYING from ${dir}`);
  return new ReplayValidator(dir);
}
