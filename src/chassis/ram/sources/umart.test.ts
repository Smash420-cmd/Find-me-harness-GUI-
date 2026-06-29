import { describe, it, expect } from "vitest";
import { UmartSource, umartProofCaption, interpretUmartFields } from "./umart.js";
import { parseRamSpec } from "../spec.js";
import type { Candidate, Spec } from "../../../types/index.js";
import type { RamCandidateData, RamSpecFields } from "../types.js";

// A tiny in-memory Umart: one category page + two product pages.
const LISTING = `
  <a href="/product/corsair-32gb-2x16gb-cmh32gx5m2b6000z38-6000mhz-ddr5-ram-grey-92533">a</a>
  <a href="/product/gskill-32gb-2x16gb-trident-z5-6000mhz-cl30-ddr5-ram-90000">b</a>
  <a href="/product/corsair-64gb-2x32gb-6000mhz-ddr5-ram-91301">too-big</a>`;

const PRODUCT: Record<string, string> = {
  "92533": productHtml("Corsair 32GB (2x16GB) 6000MHz DDR5 RAM - Grey", "619.00", "InStock"),
  "90000": productHtml("G.Skill 32GB (2x16GB) Trident Z5 CL30 6000MHz DDR5 RAM", "289.00", "InStock"),
};

function productHtml(title: string, price: string, avail: string): string {
  return `<title>${title} - Umart.com.au</title>
    <span itemprop="price" content="${price}" class="goods-price">${price}</span>
    <link itemprop="availability" href="http://schema.org/${avail}">`;
}

function fakeFetch(url: string): Promise<string> {
  if (url.includes("/memory-ram/")) return Promise.resolve(LISTING);
  const id = /-(\d+)$/.exec(url)?.[1] ?? "";
  if (PRODUCT[id]) return Promise.resolve(PRODUCT[id]!);
  return Promise.reject(new Error(`404 ${url}`));
}

const spec = parseRamSpec({ generation: "DDR5", capacityGb: 32, perStickGb: 16, kitCount: 2, dataRateMtps: 6000 }) as Spec<RamSpecFields>;

describe("Task 8 — UmartSource (injected fetch)", () => {
  it("declares its capability matrix", () => {
    const s = new UmartSource();
    expect(s.capabilities).toEqual({ hasApi: false, hasStockFlag: true, rendersClean: true });
  });

  it("observe returns spec-matching candidates with a live price, skipping non-matches", async () => {
    const s = new UmartSource({ fetchText: fakeFetch });
    const candidates = await s.observe(spec);
    // the 64GB kit is filtered out (wrong capacity); the two 32GB kits remain
    expect(candidates.map((c) => c.key).sort()).toEqual(["90000", "92533"]);
    const cheap = candidates.find((c) => c.key === "90000")!;
    expect(cheap.data.priceAud).toBe(289);
    expect(cheap.data.attributes).toMatchObject({ generation: "DDR5", capacityGb: 32, dataRateMtps: 6000 });
  });

  it("read returns fresh live state for a candidate", async () => {
    const s = new UmartSource({ fetchText: fakeFetch });
    const [c] = await s.observe(spec);
    const live = await s.read(c!);
    expect(live.availability).toBe("in_stock");
    expect(live.priceAud).toBeGreaterThan(0);
  });

  it("proof caption uses the RENDER-read price, not the observe-time price (F1 re-review)", () => {
    const candidate: Candidate<RamCandidateData> = {
      key: "92533",
      source: "umart",
      data: {
        productId: "92533",
        title: "Corsair 32GB (2x16GB) 6000MHz DDR5 RAM",
        url: "https://umart/92533",
        attributes: { generation: "DDR5", capacityGb: 32, dataRateMtps: 6000 },
        priceAud: 999, // stale observe-time price
      },
    };
    // render reports a DIFFERENT (fresh) price
    const live = interpretUmartFields(
      { priceContent: "619.00", availabilityHref: "http://schema.org/InStock", title: "Corsair 32GB (2x16GB) 6000MHz DDR5 RAM - Umart.com.au" },
      candidate,
    );
    expect(live.priceAud).toBe(619);
    const caption = umartProofCaption(candidate.data.title, live);
    expect(caption).toContain("$619"); // the render price
    expect(caption).not.toContain("999"); // never the stale observe-time price
  });
});
