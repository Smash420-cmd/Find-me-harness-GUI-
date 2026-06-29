/**
 * Task 10 — End-to-end against the REAL Umart. Gated behind RUN_LIVE=1 so normal
 * CI stays hermetic; run with `RUN_LIVE=1 npm test -- src/e2e`.
 *
 * Proves the whole spine: real query → Spec → observe Umart → verify (live DOM +
 * sandboxed Playwright proof-shot) → policy → rank → confidence gate → results,
 * each carrying a real proof-shot image and a composed confidence.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { runLoop } from "../engine/loop/index.js";
import { EphemeralSandbox } from "../engine/verify/index.js";
import { VerificationTier, type Spec } from "../types/index.js";
import { createRamChassis, parseRamSpec, type RamSpecFields } from "../chassis/ram/index.js";
import { UmartSource } from "../chassis/ram/sources/umart.js";
import { PlaywrightValidator } from "../providers/validation/playwright.js";

const live = process.env.RUN_LIVE === "1";

(live ? describe : describe.skip)("Task 10 — e2e against live Umart", () => {
  it(
    "real DDR5 query yields ranked, proof-carrying, confidence-scored results",
    async () => {
      const source = new UmartSource({ maxCandidates: 3 });
      const validator = new PlaywrightValidator();
      const chassis = createRamChassis({
        source,
        readLive: (c) => source.read(c),
        captureProof: (c, env) =>
          env.sandbox.run(() =>
            validator.capture({ url: c.data.url, mustShow: `${c.data.title} @ $${c.data.priceAud} in stock` }),
          ),
      });

      const spec = parseRamSpec({
        generation: "DDR5",
        capacityGb: 32,
        perStickGb: 16,
        kitCount: 2,
        dataRateMtps: 6000,
        budgetAud: 800,
      }) as Spec<RamSpecFields>;

      const out = await runLoop(spec, chassis, { maxIterations: 2, wallClockMs: 180_000 }, {
        sandbox: new EphemeralSandbox(),
      });

      // eslint-disable-next-line no-console
      console.log(
        "e2e results:",
        out.results.map((r) => ({
          kit: r.candidate.data.title.slice(0, 48),
          price: r.candidate.data.priceAud,
          overall: Number(r.confidence.overall.toFixed(3)),
          flagged: r.confidence.flagged,
          proof: r.proof.artifactRef,
        })),
      );

      expect(out.results.length).toBeGreaterThan(0);
      // ranked ascending by verified price
      const prices = out.results.map((r) => r.candidate.data.priceAud);
      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
      // every shown kit carries a real proof-shot image + composed confidence (Law 1, E5)
      for (const r of out.results) {
        expect(r.proof.tier).toBe(VerificationTier.Vision);
        expect(existsSync(r.proof.artifactRef)).toBe(true);
        expect(r.confidence.overall).toBeGreaterThan(0);
      }
    },
    200_000,
  );
});
