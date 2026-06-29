import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { runLoop, type LoopBudget } from "./index.js";
import { EphemeralSandbox } from "../verify/index.js";
import { LoopBudgetExceededError } from "../errors/index.js";
import {
  VerificationTier,
  type Candidate,
  type Chassis,
  type ProofShot,
  type Spec,
  type TierRule,
} from "../../types/index.js";

type Data = { score: number };
const spec: Spec<{}> = { fields: {} };

function proof(): ProofShot {
  return { tier: VerificationTier.Vision, artifactRef: "a", capturedAt: 0, shows: "proof" };
}

/**
 * Build a chassis whose single source yields, on each pass, candidates with the
 * scores returned by `scoresPerPass()`. A candidate's verificationScore == its
 * data.score; relevance is 1; reliability 1, so confidence.overall == score.
 */
function makeChassis(scoresPerPass: () => number[]): Chassis<{}, Data> {
  const visionRule = (c: Candidate<Data>): TierRule<Data> => ({
    tier: VerificationTier.Vision,
    proofBearing: true,
    evaluate: async () => ({ ok: true, proof: proof(), score: c.data.score }),
  });
  return {
    parseSpec: (i) => ({ fields: i as {} }),
    tierRules: (c) => [visionRule(c)],
    rank: (v) => [...v].sort((a, b) => b.confidence.overall - a.confidence.overall),
    sources: [
      {
        name: "src",
        capabilities: { hasApi: false, hasStockFlag: true, rendersClean: true },
        reliability: 1,
        observe: async () =>
          scoresPerPass().map((score, i) => ({ key: `k${i}`, source: "src", data: { score }, relevance: 1 })),
        read: async () => ({}),
      },
    ],
  };
}

const deps = () => ({ sandbox: new EphemeralSandbox() });
const budget = (over: Partial<LoopBudget> = {}): LoopBudget => ({ maxIterations: 5, wallClockMs: 10_000, ...over });

describe("Task 4 — the loop (stop conditions, E3, E4)", () => {
  it("stop 1 — gate: an above-threshold result returns immediately", async () => {
    const chassis = makeChassis(() => [0.9]); // overall 0.9 ≥ 0.85
    const out = await runLoop(spec, chassis, budget(), deps());
    expect(out.stoppedBy).toBe("gate");
    expect(out.iterations).toBe(1);
    expect(out.results[0]!.confidence.flagged).toBe(false);
  });

  it("stop 2 — no-improvement: a steady sub-threshold state stops and returns flagged results", async () => {
    const chassis = makeChassis(() => [0.5]); // overall 0.5, same every pass
    const out = await runLoop(spec, chassis, budget(), deps());
    expect(out.stoppedBy).toBe("no-improvement");
    expect(out.iterations).toBe(2); // pass 1 improved over baseline; pass 2 did not
    expect(out.results[0]!.confidence.flagged).toBe(true); // flagged, not dropped (E5)
  });

  it("stop 3 — max-iterations breach throws LoopBudgetExceededError", async () => {
    let n = 0;
    const chassis = makeChassis(() => [0.3 + n++ * 0.05]); // improves forever, never crosses
    await expect(runLoop(spec, chassis, budget({ maxIterations: 3 }), deps())).rejects.toBeInstanceOf(
      LoopBudgetExceededError,
    );
  });

  it("stop 4 — wall-clock breach throws LoopBudgetExceededError", async () => {
    let t = 0;
    let n = 0;
    const chassis = makeChassis(() => [0.3 + n++ * 0.05]); // keeps improving
    const clock = () => (t += 40); // each check advances 40ms
    await expect(
      runLoop(spec, chassis, budget({ wallClockMs: 100, maxIterations: 1000 }), { sandbox: new EphemeralSandbox(), now: clock }),
    ).rejects.toBeInstanceOf(LoopBudgetExceededError);
  });

  it("E4: loopWider only fires when a pass improved (improve once, then plateau)", async () => {
    const seq = [[0.4], [0.6], [0.6], [0.6]]; // improves to pass 2, then plateaus
    let i = 0;
    const chassis = makeChassis(() => seq[Math.min(i++, seq.length - 1)]!);
    const out = await runLoop(spec, chassis, budget(), deps());
    expect(out.stoppedBy).toBe("no-improvement");
    expect(out.iterations).toBe(3); // pass1 (0.4) improved, pass2 (0.6) improved, pass3 (0.6) did not → stop
  });

  it("4b — policy filter runs after verify, before rank, on verified candidates only", async () => {
    // Two verified candidates; policy excludes the higher-scoring one. If policy
    // ran on verified results before rank, only the lower survives.
    const chassis = makeChassis(() => [0.9, 0.95]);
    const seen: number[] = [];
    const withPolicy: typeof chassis = {
      ...chassis,
      policy: (r) => {
        seen.push(r.confidence.overall); // only verified results reach policy
        return r.confidence.overall < 0.93; // exclude the 0.95 one
      },
    };
    const out = await runLoop(spec, withPolicy, budget(), deps());
    // policy only ever saw verified candidates (both were verified here)
    expect(seen.sort()).toEqual([0.9, 0.95]);
    // the excluded (0.95) candidate is absent from ranked output
    expect(out.results.every((r) => r.confidence.overall < 0.93)).toBe(true);
    expect(out.results.map((r) => r.confidence.overall)).toEqual([0.9]);
  });

  it("E3 property: the loop ALWAYS terminates within maxIterations for any inputs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 0, maxLength: 6 }),
        fc.integer({ min: 1, max: 8 }),
        async (scores, maxIterations) => {
          const chassis = makeChassis(() => scores);
          try {
            const out = await runLoop(spec, chassis, budget({ maxIterations }), deps());
            expect(out.iterations).toBeLessThanOrEqual(maxIterations);
          } catch (e) {
            // The only acceptable non-return is a budget breach (still terminated).
            expect(e).toBeInstanceOf(LoopBudgetExceededError);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
