/** Judge tests (Plan 006 Step 4) — fabricated submissions covering every trap
 *  category, plus the three constitutional properties: determinism (C2),
 *  asymmetric loss (C3), and certification-or-no-grading (C7). */
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { judge, loadKey, type AnswerKey } from "./judge.js";

const KEY: AnswerKey = {
  certifiedBy: "test-magistrate",
  certifiedAt: "2026-07-04",
  passMark: 0.9,
  weights: { missedTruth: 1, ghostShown: 3, wrongShown: 3, irrelevantShown: 5, unknownShown: 2 },
  exams: [
    {
      id: "ddr4-open",
      request: "find me a 32GB DDR4 kit of 2x16GB sticks I can actually buy right now",
      truths: [
        { url: "https://a.shop/kit-1", title: "Kit One 2x16 3200", priceAud: 349 },
        { url: "https://b.shop/kit-2", title: "Kit Two 2x16 3600", priceAud: 369 },
        { url: "https://c.shop/kit-3", title: "Kit Three 2x16 3200", priceAud: 399 },
      ],
      traps: [
        { url: "https://a.shop/notify-me", category: "ghost-listing" },
        { url: "https://b.shop/sodimm", category: "wrong-sku-sodimm" },
        { url: "https://m.shop/massager", category: "irrelevant-item" },
        { url: "https://a.shop/all-ddr4", category: "category-page" },
        { url: "https://d.shop/gone", category: "dead-link" },
      ],
    },
  ],
};

const sub = (...shown: string[]) => ({ examId: "ddr4-open", shown });

describe("the Judge", () => {
  it("perfect board scores 1 and passes", () => {
    const v = judge(sub("https://a.shop/kit-1", "https://b.shop/kit-2", "https://c.shop/kit-3"), KEY);
    expect(v).toEqual({ score: 1, categories: [], pass: true });
  });

  it("is deterministic — same submission, same verdict (C2)", () => {
    const s = sub("https://a.shop/kit-1", "https://a.shop/notify-me");
    expect(judge(s, KEY)).toEqual(judge(s, KEY));
  });

  it("URL normalisation: trailing slash / fragment / case don't change the verdict", () => {
    const clean = judge(sub("https://a.shop/kit-1"), KEY);
    const messy = judge(sub("HTTPS://A.SHOP/kit-1/#ref"), KEY);
    expect(messy).toEqual(clean);
  });

  it("asymmetric loss: showing a ghost costs more than missing a truth (C3)", () => {
    const missedOne = judge(sub("https://a.shop/kit-1", "https://b.shop/kit-2"), KEY);
    const ghostInstead = judge(sub("https://a.shop/kit-1", "https://b.shop/kit-2", "https://a.shop/notify-me"), KEY);
    expect(ghostInstead.score).toBeLessThan(missedOne.score);
  });

  it("irrelevant item is the worst thing you can show", () => {
    const base = ["https://a.shop/kit-1", "https://b.shop/kit-2", "https://c.shop/kit-3"];
    const ghost = judge(sub(...base, "https://a.shop/notify-me"), KEY);
    const massager = judge(sub(...base, "https://m.shop/massager"), KEY);
    expect(massager.score).toBeLessThan(ghost.score);
  });

  it("category hints are plain-outcome language, never item-level, never jargon (C1/C4)", () => {
    const v = judge(sub("https://a.shop/notify-me", "https://b.shop/sodimm", "https://m.shop/massager"), KEY);
    expect(v.categories).toEqual([
      "much of what exists is missing from your answer",
      "something you show cannot actually be purchased right now",
      "something you show is not what was asked for",
      "something you show is not a product for sale",
    ]);
    const all = v.categories.join(" ").toLowerCase();
    for (const jargon of ["ghost", "sku", "trap", "key", "harness", "tier", "specimen", "notify"]) {
      expect(all).not.toContain(jargon);
    }
    for (const c of v.categories) expect(c).not.toMatch(/https?:\/\//);
  });

  it("an unknown URL is unverifiable — penalised, hinted as relevance", () => {
    const v = judge(sub("https://a.shop/kit-1", "https://x.shop/never-seen"), KEY);
    expect(v.categories).toContain("something you show is not a product for sale");
    expect(v.score).toBeLessThan(judge(sub("https://a.shop/kit-1"), KEY).score);
  });

  it("empty submission: pure coverage failure, no pass", () => {
    const v = judge(sub(), KEY);
    expect(v.pass).toBe(false);
    expect(v.categories).toEqual(["much of what exists is missing from your answer"]);
  });

  it("an uncertified key refuses to grade (C7)", () => {
    const dir = mkdtempSync(join(tmpdir(), "key-"));
    const p = join(dir, "key.json");
    writeFileSync(p, JSON.stringify({ ...KEY, certifiedBy: "" }));
    expect(() => loadKey(p)).toThrow(/not certified/);
    writeFileSync(p, JSON.stringify(KEY));
    expect(loadKey(p).certifiedBy).toBe("test-magistrate");
  });
});
