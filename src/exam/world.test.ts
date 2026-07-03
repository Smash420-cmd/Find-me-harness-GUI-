/**
 * Plan 006 Step 1 check: record a run, replay it, get byte-identical results.
 * No live web — the "live" side is stubbed; what's under test is the world.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordingFetch, replayFetch, RecordingValidator, ReplayValidator, type RenderProvider } from "./world.js";
import { VerificationTier } from "../types/index.js";
import type { CaptureResult } from "../providers/index.js";

const world = () => mkdtempSync(join(tmpdir(), "world-"));

describe("frozen world — fetch", () => {
  it("replays a recorded body byte-identically", async () => {
    const dir = world();
    const rec = recordingFetch(dir, async () => "<html>§ exact bytes ¢</html>");
    const live = await rec("https://shop.example/p/1");
    const replay = await replayFetch(dir)("https://shop.example/p/1");
    expect(replay).toBe(live);
  });

  it("replays a recorded ERROR verbatim — a 403 is a 403", async () => {
    const dir = world();
    const rec = recordingFetch(dir, async (url) => { throw new Error(`GET ${url} → 403`); });
    await expect(rec("https://walled.example/x")).rejects.toThrow("403");
    await expect(replayFetch(dir)("https://walled.example/x")).rejects.toThrow(
      "GET https://walled.example/x → 403",
    );
  });

  it("a miss is a walled 404, never a live fetch, never exam vocabulary", async () => {
    const dir = world();
    // NB: host must dodge the vocabulary scan below ("example" contains "exam")
    const err = await replayFetch(dir)("https://missing.shop/x").catch((e: Error) => e.message);
    expect(err).toBe("GET https://missing.shop/x → 404");
    for (const word of ["world", "exam", "record", "replay", "snapshot"]) {
      expect(err.toLowerCase()).not.toContain(word); // Spec 006 C1: name the world, never the grading
    }
  });
});

function fakeRenderer(dir: string): RenderProvider {
  return {
    async capture({ url, mustShow }) {
      const png = join(dir, "live-shot.png");
      writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic — content just has to round-trip
      return {
        proof: { tier: VerificationTier.Vision, artifactRef: png, capturedAt: 1_234_567, shows: mustShow },
        fields: { _addToCart: "true", _visiblePrice: "369.00", title: `page at ${url}` },
      } as CaptureResult;
    },
    async browse(url) {
      return [`${url}/product-1|Title One`, `${url}/product-2|Title Two`];
    },
  };
}

describe("frozen world — render", () => {
  it("capture replays fields, frozen capturedAt, and the stored PNG", async () => {
    const dir = world();
    const scratch = world();
    const live = await new RecordingValidator(fakeRenderer(scratch), dir).capture({ url: "https://shop.example/p/9", mustShow: "test" });
    const replay = await new ReplayValidator(dir).capture({ url: "https://shop.example/p/9", mustShow: "test" });

    expect(replay.fields).toEqual(live.fields);
    expect(replay.proof.capturedAt).toBe(1_234_567); // deterministic world, deterministic time
    expect(replay.proof.shows).toBe("test");
    expect(existsSync(replay.proof.artifactRef)).toBe(true);
    expect(readFileSync(replay.proof.artifactRef)).toEqual(readFileSync(live.proof.artifactRef));
  });

  it("browse replays results; a browse miss is fail-soft empty (as live)", async () => {
    const dir = world();
    const scratch = world();
    const js = "(() => [])()";
    const live = await new RecordingValidator(fakeRenderer(scratch), dir).browse("https://engine.example/serp", js);
    const replay = await new ReplayValidator(dir).browse("https://engine.example/serp", js);
    expect(replay).toEqual(live);
    expect(await new ReplayValidator(dir).browse("https://never.recorded/serp", js)).toEqual([]);
  });

  it("the same url with DIFFERENT extractJs is a different recording", async () => {
    const dir = world();
    const scratch = world();
    const v = new RecordingValidator(fakeRenderer(scratch), dir);
    await v.browse("https://e.example/s", "A");
    expect(await new ReplayValidator(dir).browse("https://e.example/s", "B")).toEqual([]);
  });
});
