/** interpretVisionReading — the vision→RAM bridge, fail-closed for the trust floor. */
import { describe, expect, it } from "vitest";
import { interpretVisionReading } from "./vision.js";
import type { ProofReading } from "../../providers/index.js";
import type { Candidate } from "../../types/index.js";
import type { RamCandidateData } from "./types.js";

const candidate = (over: Partial<RamCandidateData> = {}): Candidate<RamCandidateData> => ({
  key: "u", source: "vision",
  data: { productId: "u", title: "fallback title", url: "https://x/p", priceAud: 111, attributes: { generation: "DDR4", capacityGb: 32, dataRateMtps: 3200 }, ...over },
  relevance: 1,
});

const reading = (over: Partial<ProofReading> = {}): ProofReading => ({
  pageType: "product", available: "in_stock", availabilityEvidence: "Add to Cart", price: 369, currency: "AUD",
  title: "G.Skill Ripjaws V 32GB (2x16GB) DDR4 3600MHz CL18", identifiers: ["F4-3600C18D-32GVK"], confidence: 0.9, notes: "", ...over,
});

describe("interpretVisionReading", () => {
  it("in-stock product → in_stock, reader price, title attrs", () => {
    const live = interpretVisionReading(reading(), candidate());
    expect(live.availability).toBe("in_stock");
    expect(live.priceAud).toBe(369);
    expect(live.attributes.kitCount).toBe(2);
    expect(live.title).toContain("Ripjaws V");
  });

  it("out_of_stock reading → out_of_stock", () => {
    expect(interpretVisionReading(reading({ available: "out_of_stock", availabilityEvidence: "Notify Me" }), candidate()).availability).toBe("out_of_stock");
  });

  it("preorder and unknown fail closed", () => {
    expect(interpretVisionReading(reading({ available: "preorder" }), candidate()).availability).toBe("out_of_stock");
    expect(interpretVisionReading(reading({ available: "unknown" }), candidate()).availability).toBe("out_of_stock");
  });

  it("a non-product page is never buyable, whatever it says", () => {
    for (const pageType of ["category", "search", "error", "blocked", "other"] as const) {
      expect(interpretVisionReading(reading({ pageType, available: "in_stock" }), candidate()).availability).toBe("out_of_stock");
    }
  });

  it("price 0 or null falls back to the candidate's price (the $0 trap)", () => {
    expect(interpretVisionReading(reading({ price: 0 }), candidate({ priceAud: 349 })).priceAud).toBe(349);
    expect(interpretVisionReading(reading({ price: null }), candidate({ priceAud: 349 })).priceAud).toBe(349);
  });

  it("unreadable title falls back to candidate attributes", () => {
    const live = interpretVisionReading(reading({ title: null }), candidate());
    expect(live.attributes.generation).toBe("DDR4");
  });
});
