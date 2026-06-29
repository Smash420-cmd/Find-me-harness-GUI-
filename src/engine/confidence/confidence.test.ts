import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { composeConfidence, DEFAULT_CONFIDENCE_THRESHOLD } from "./index.js";

describe("Task 5 — composed confidence (E5, Laws 6 & 11)", () => {
  it("composes three stages into an overall (never a bare number)", () => {
    const c = composeConfidence({ convergence: 1, verification: 1, sourceReliability: 1 });
    expect(c.overall).toBe(1);
    expect(c.convergence).toBe(1);
    expect(c.verification).toBe(1);
    expect(c.sourceReliability).toBe(1);
    expect(c.flagged).toBe(false);
  });

  it("a weak stage drags the overall down (weakest-link / honest)", () => {
    const c = composeConfidence({ convergence: 1, verification: 0.5, sourceReliability: 0.9 });
    expect(c.overall).toBeCloseTo(0.45, 5);
    expect(c.flagged).toBe(true); // below default threshold → flagged, not hidden
  });

  it("sub-threshold results are flagged; at/above are not (E5)", () => {
    expect(composeConfidence({ convergence: 0.9, verification: 0.9, sourceReliability: 0.9 }).flagged).toBe(true); // .729
    expect(composeConfidence({ convergence: 0.95, verification: 0.97, sourceReliability: 0.95 }).flagged).toBe(false); // ~.875
  });

  it("property: overall is always in [0,1] and flagged iff overall < threshold", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b, c) => {
          const conf = composeConfidence({ convergence: a, verification: b, sourceReliability: c });
          expect(conf.overall).toBeGreaterThanOrEqual(0);
          expect(conf.overall).toBeLessThanOrEqual(1);
          expect(conf.flagged).toBe(conf.overall < DEFAULT_CONFIDENCE_THRESHOLD);
        },
      ),
    );
  });
});
