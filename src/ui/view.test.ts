import { describe, it, expect } from "vitest";
import { toViewModel } from "./view.js";
import { VerificationTier, type VerifiedResult } from "../types/index.js";
import type { RamCandidateData } from "../chassis/ram/types.js";

function result(price: number, overall: number, flagged: boolean): VerifiedResult<RamCandidateData> {
  return {
    candidate: {
      key: `k${price}`,
      source: "umart",
      data: {
        productId: `${price}`,
        title: `Kit $${price}`,
        url: `https://umart/${price}`,
        attributes: { generation: "DDR5", capacityGb: 32, dataRateMtps: 6000 },
        priceAud: price,
      },
    },
    proof: { tier: VerificationTier.Vision, artifactRef: `/tmp/p${price}.png`, capturedAt: 0, shows: "x" },
    confidence: { convergence: 1, verification: 1, sourceReliability: 1, overall, flagged },
  };
}

describe("Task 9 — wrapper view (projection only, Law 4)", () => {
  it("maps results without re-ordering or filtering (no decision path)", () => {
    const results = [result(619, 0.95, false), result(679, 0.95, false)];
    const vm = toViewModel(results, { stoppedBy: "gate", bestOverall: 0.95 }, (ref) => `data:${ref}`);
    // same count, same order — the view never re-ranks or drops
    expect(vm.results.map((r) => r.priceLabel)).toEqual(["$619.00", "$679.00"]);
    expect(vm.results[0]!.proofUrl).toBe("data:/tmp/p619.png");
    expect(vm.results[0]!.confidencePct).toBe(95);
    expect(vm.results[0]!.flagged).toBe(false);
  });

  it("surfaces the honest sub-threshold label, never hides flagged results (Law 6)", () => {
    const results = [result(150, 0.4, true)];
    const vm = toViewModel(results, { stoppedBy: "no-improvement", bestOverall: 0.4 }, () => "u");
    expect(vm.results).toHaveLength(1); // flagged result is shown, not dropped
    expect(vm.results[0]!.honestLabel).toContain("review");
    expect(vm.note).toContain("honestly flagged");
  });

  it("empty results render the no-ghost-inventory note (Law 1)", () => {
    const vm = toViewModel([], { stoppedBy: "no-improvement", bestOverall: 0 }, () => "u");
    expect(vm.results).toHaveLength(0);
    expect(vm.note).toContain("no ghost inventory");
  });
});
