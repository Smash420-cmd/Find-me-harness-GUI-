import { describe, it, expect } from "vitest";
import { parseRamSpec, createRamChassis, type RamCandidateData } from "./index.js";
import { ramPolicy } from "./policy.js";
import { rankByPrice } from "./rank.js";
import { SpecInvalidError } from "../../engine/errors/index.js";
import { runLoop } from "../../engine/loop/index.js";
import { EphemeralSandbox } from "../../engine/verify/index.js";
import {
  VerificationTier,
  type Candidate,
  type ISourceProvider,
  type ProofShot,
  type Spec,
  type VerifiedResult,
} from "../../types/index.js";
import type { RamLiveState, RamSpecFields } from "./types.js";

// ── A valid baseline request ─────────────────────────────────────────────────
const validInput = {
  generation: "DDR5",
  capacityGb: 32,
  perStickGb: 16,
  kitCount: 2,
  dataRateMtps: 6000,
  casLatency: 30,
  budgetAud: 200,
};

describe("Task 7 — RAM chassis", () => {
  describe("spec.ts (R1, R2)", () => {
    it("R1: a valid RAM request parses to a Spec", () => {
      const spec = parseRamSpec(validInput);
      expect(spec.fields.generation).toBe("DDR5");
      expect(spec.fields.capacityGb).toBe(32);
    });

    it("R2: an impossible request 'DDR4 @ 8000MHz' is rejected at the door", () => {
      expect(() => parseRamSpec({ generation: "DDR4", capacityGb: 16, dataRateMtps: 8000 })).toThrow(
        SpecInvalidError,
      );
    });

    it("rejects inconsistent kit config (2×16 ≠ 64GB total)", () => {
      expect(() =>
        parseRamSpec({ generation: "DDR5", capacityGb: 64, perStickGb: 16, kitCount: 2, dataRateMtps: 6000 }),
      ).toThrow(SpecInvalidError);
    });

    it("accepts a valid DDR5-6000 spec at the edge of the band", () => {
      expect(() => parseRamSpec({ generation: "DDR5", capacityGb: 16, dataRateMtps: 8400 })).not.toThrow();
    });
  });

  describe("rank.ts (R6)", () => {
    it("R6: ranks by lowest verified price", () => {
      const mk = (price: number): VerifiedResult<RamCandidateData> => ({
        candidate: { key: `k${price}`, source: "umart", data: candidateData({ priceAud: price }) },
        proof: domProof(),
        confidence: { convergence: 1, verification: 1, sourceReliability: 1, overall: 1, flagged: false },
      });
      const ranked = rankByPrice([mk(150), mk(99), mk(200)]);
      expect(ranked.map((r) => r.candidate.data.priceAud)).toEqual([99, 150, 200]);
    });
  });

  describe("policy.ts (R7)", () => {
    const res = (data: Partial<RamCandidateData>): VerifiedResult<RamCandidateData> => ({
      candidate: { key: "k", source: "umart", data: candidateData(data) },
      proof: domProof(),
      confidence: { convergence: 1, verification: 1, sourceReliability: 1, overall: 1, flagged: false },
    });
    it("budget ceiling filters over-budget kits", () => {
      const spec = parseRamSpec({ ...validInput, budgetAud: 100 });
      expect(ramPolicy(res({ priceAud: 90 }), spec)).toBe(true);
      expect(ramPolicy(res({ priceAud: 150 }), spec)).toBe(false);
    });
    it("low-profile-only and grey-import constraints filter accordingly", () => {
      const spec = parseRamSpec({ ...validInput, constraints: { lowProfileOnly: true, excludeGreyImport: true } });
      expect(ramPolicy(res({ lowProfile: true, greyImport: false }), spec)).toBe(true);
      expect(ramPolicy(res({ lowProfile: false }), spec)).toBe(false);
      expect(ramPolicy(res({ lowProfile: true, greyImport: true }), spec)).toBe(false);
    });
  });

  describe("verify via the loop (R3, R4, R5) — fake Umart source, no live network", () => {
    it("R3+R4+R5: wrong-SKU and sold-out drop; a correct in-stock kit gets a proof-shot", async () => {
      const spec = parseRamSpec(validInput);
      const source = fakeUmart([
        // correct + in stock → survives with a proof
        { data: candidateData({ productId: "ok", priceAud: 150 }), live: liveOk(150) },
        // wrong SKU (DDR4) → dropped
        { data: candidateData({ productId: "wrong" }), live: liveWrong() },
        // sold out → dropped (R4)
        { data: candidateData({ productId: "gone", priceAud: 120 }), live: liveSoldOut(120) },
      ]);
      const chassis = createRamChassis({
        source,
        readLive: async (c) => (await source.read(c)) as RamLiveState,
        captureProof: async (c, env) => env.sandbox.run(async () => visionProof(c.key).proof),
      });

      const out = await runLoop(spec as Spec<RamSpecFields>, chassis, { maxIterations: 3, wallClockMs: 5000 }, {
        sandbox: new EphemeralSandbox(),
      });

      // only the correct, in-stock kit survives — each survivor carries a proof (R5)
      expect(out.results).toHaveLength(1);
      expect(out.results[0]!.candidate.data.productId).toBe("ok");
      expect(out.results[0]!.proof.tier).toBe(VerificationTier.Vision);
      expect(out.results[0]!.confidence.flagged).toBe(false);
      expect(out.stoppedBy).toBe("gate");
    });

    it("degradation: when vision capture fails, falls back to the DOM proof and flags confidence", async () => {
      const spec = parseRamSpec(validInput);
      const source = fakeUmart([{ data: candidateData({ productId: "ok", priceAud: 150 }), live: liveOk(150) }]);
      const chassis = createRamChassis({
        source,
        readLive: async (c) => (await source.read(c)) as RamLiveState,
        captureProof: async () => {
          throw new Error("vision capture timed out");
        },
      });
      const out = await runLoop(spec as Spec<RamSpecFields>, chassis, { maxIterations: 2, wallClockMs: 5000 }, {
        sandbox: new EphemeralSandbox(),
      });
      expect(out.results).toHaveLength(1);
      expect(out.results[0]!.proof.tier).toBe(VerificationTier.Dom); // degraded proof
      expect(out.results[0]!.confidence.flagged).toBe(true); // never a silent pass
    });
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────
function candidateData(over: Partial<RamCandidateData> = {}): RamCandidateData {
  return {
    productId: "p1",
    title: "ACME DDR5-6000 32GB (2x16) CL30",
    url: "https://umart.com.au/p1",
    attributes: { generation: "DDR5", capacityGb: 32, perStickGb: 16, kitCount: 2, dataRateMtps: 6000, casLatency: 30 },
    priceAud: 150,
    ...over,
  };
}
function liveOk(priceAud: number): RamLiveState {
  return { availability: "in_stock", priceAud, attributes: candidateData().attributes };
}
function liveSoldOut(priceAud: number): RamLiveState {
  return { availability: "out_of_stock", priceAud, attributes: candidateData().attributes };
}
function liveWrong(): RamLiveState {
  return {
    availability: "in_stock",
    priceAud: 100,
    attributes: { generation: "DDR4", capacityGb: 32, perStickGb: 16, kitCount: 2, dataRateMtps: 3200 },
  };
}
function domProof(): ProofShot {
  return { tier: VerificationTier.Dom, artifactRef: "d", capturedAt: 0, shows: "dom" };
}
function visionProof(key: string): { ok: true; proof: ProofShot; score: number } {
  return { ok: true, proof: { tier: VerificationTier.Vision, artifactRef: `v:${key}`, capturedAt: 0, shows: "vision" }, score: 1 };
}

/** A fake Umart that returns the given candidates, each with its own live state. */
function fakeUmart(
  rows: { data: RamCandidateData; live: RamLiveState }[],
): ISourceProvider<RamCandidateData> {
  const liveByKey = new Map(rows.map((r) => [r.data.productId, r.live]));
  return {
    name: "umart",
    capabilities: { hasApi: false, hasStockFlag: true, rendersClean: true },
    reliability: 0.95,
    observe: async () => rows.map((r) => ({ key: r.data.productId, source: "umart", data: r.data, relevance: 1 })),
    read: async (c: Candidate<RamCandidateData>) => liveByKey.get(c.key) ?? null,
  };
}
