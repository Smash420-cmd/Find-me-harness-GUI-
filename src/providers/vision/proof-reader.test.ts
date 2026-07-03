/** Vision-reader parsing tests — the model-facing call needs the API (run later,
 *  funded), but the JSON extraction + coercion that guards against bad model
 *  output is pure and tested here. */
import { describe, expect, it } from "vitest";
import { parseReadingJson } from "./proof-reader.js";
import { buildReaderPrompt, RAM_DOMAIN_HINT } from "./sales-page-guide.js";

describe("proof-reader parsing", () => {
  it("extracts a clean JSON reading", () => {
    const r = parseReadingJson(JSON.stringify({
      pageType: "product", available: "in_stock", availabilityEvidence: "Add to Cart enabled",
      price: 369, currency: "AUD", title: "Klevv CRAS X RGB 32GB", identifiers: ["KD4AGUA80-32A160X"],
      confidence: 0.9, notes: "",
    }));
    expect(r.pageType).toBe("product");
    expect(r.price).toBe(369);
    expect(r.identifiers).toEqual(["KD4AGUA80-32A160X"]);
  });

  it("tolerates prose and code fences around the JSON", () => {
    const r = parseReadingJson('Here is the reading:\n```json\n{"pageType":"product","price":49,"available":"in_stock"}\n```\nDone.');
    expect(r.pageType).toBe("product");
    expect(r.price).toBe(49);
  });

  it("coerces bad shapes safely — never trusts the model", () => {
    const r = parseReadingJson(JSON.stringify({
      pageType: "banana", available: "maybe", price: "not a number", price2: 0,
      identifiers: "just-a-string", confidence: 5,
    }));
    expect(r.pageType).toBe("other"); // invalid enum → safe default
    expect(r.available).toBe("unknown");
    expect(r.price).toBeNull(); // non-number
    expect(r.identifiers).toEqual([]); // non-array
    expect(r.confidence).toBe(1); // clamped
  });

  it("a zero/negative price reads as null (the $0 header-cart trap)", () => {
    expect(parseReadingJson('{"price":0}').price).toBeNull();
    expect(parseReadingJson('{"price":-5}').price).toBeNull();
  });

  it("no JSON at all → honest empty reading, not a throw", () => {
    const r = parseReadingJson("I could not read this page.");
    expect(r.pageType).toBe("other");
    expect(r.confidence).toBe(0);
    expect(r.notes).toContain("no JSON");
  });

  it("the prompt carries the guide, the domain hint, and the shopper's want", () => {
    const p = buildReaderPrompt({ domainHint: RAM_DOMAIN_HINT, want: "a 2x16GB DDR4 3200 kit" });
    expect(p).toContain("Notify Me"); // the ghost rule
    expect(p).toContain("header cart total"); // the $0 rule
    expect(p).toContain("Kit configuration is load-bearing"); // domain hint
    expect(p).toContain("2x16GB DDR4 3200"); // the want
    expect(p).toContain("Report the page's own facts"); // still facts, not verdicts
  });
});
