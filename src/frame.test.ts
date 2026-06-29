/**
 * Task 0 — the frame. No behaviour yet; this proves the skeleton stands:
 * every error class exists, the cache stub misses, the vocabulary compiles.
 */
import { describe, it, expect } from "vitest";
import {
  SupersededRunError,
  LoopBudgetExceededError,
  SourceUnavailableError,
  SpecInvalidError,
  GhostDroppedError,
  HarnessError,
} from "./engine/errors/index.js";
import { StubCacheProvider } from "./providers/cache/stub.js";

describe("Task 0 — frame", () => {
  it("every named error class exists and carries a stable code (Law 9)", () => {
    const errs: HarnessError[] = [
      new SupersededRunError("run-1"),
      new LoopBudgetExceededError({ iterations: 8, elapsedMs: 1000 }),
      new SourceUnavailableError("umart"),
      new SpecInvalidError("impossible spec"),
      new GhostDroppedError("k1", "sold out"),
    ];
    expect(errs.map((e) => e.code)).toEqual([
      "SUPERSEDED_RUN",
      "LOOP_BUDGET_EXCEEDED",
      "SOURCE_UNAVAILABLE",
      "SPEC_INVALID",
      "GHOST_DROPPED",
    ]);
    // Each is a real Error subclass with its own name — no string-parsing needed.
    for (const e of errs) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(HarnessError);
      expect(e.name).toBe(e.constructor.name);
    }
  });

  it("ICacheProvider stub always misses (empty scaffold, Law 2-safe)", async () => {
    const cache = new StubCacheProvider();
    await cache.set("any", 123);
    const got = await cache.get<number>("any");
    expect(got).toEqual({ hit: false });
  });
});
