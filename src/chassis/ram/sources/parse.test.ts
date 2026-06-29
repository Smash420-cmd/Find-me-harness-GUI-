import { describe, it, expect } from "vitest";
import { parseRamAttributes, parseListing, parseProductPage } from "./parse.js";

describe("Task 8 — Umart parsing (offline)", () => {
  describe("parseRamAttributes", () => {
    it("parses a full title", () => {
      const r = parseRamAttributes("Corsair 32GB (2x16GB) CMH32GX5M2B6000Z38 Vengeance RGB 6000MHz DDR5 RAM - Grey");
      expect(r).not.toBeNull();
      expect(r!.attributes).toMatchObject({ generation: "DDR5", capacityGb: 32, perStickGb: 16, kitCount: 2, dataRateMtps: 6000 });
      expect(r!.brand).toBe("corsair");
    });

    it("parses from a url slug too", () => {
      const r = parseRamAttributes("gskill-32gb-2x16gb-trident-z5-cl30-6000mhz-ddr5-ram");
      expect(r!.attributes).toMatchObject({ generation: "DDR5", capacityGb: 32, dataRateMtps: 6000, casLatency: 30 });
    });

    it("returns null for non-RAM / missing speed", () => {
      expect(parseRamAttributes("Customise your PC have Umart build it")).toBeNull();
      expect(parseRamAttributes("Some DDR5 cooler with no speed")).toBeNull();
    });
  });

  describe("parseListing", () => {
    it("extracts distinct product identities", () => {
      const html = `
        <a href="/product/corsair-32gb-2x16gb-6000mhz-ddr5-ram-grey-92533">x</a>
        <a href="/product/corsair-32gb-2x16gb-6000mhz-ddr5-ram-grey-92533">dup</a>
        <a href="https://www.umart.com.au/product/gskill-32gb-2x16gb-6000mhz-cl30-ddr5-ram-90000">y</a>`;
      const items = parseListing(html);
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ productId: "92533" });
      expect(items[1]!.url).toBe("https://www.umart.com.au/product/gskill-32gb-2x16gb-6000mhz-cl30-ddr5-ram-90000");
    });
  });

  describe("parseProductPage", () => {
    const html = `
      <title>Corsair 32GB (2x16GB) CMH32GX5M2B6000Z38 Vengeance RGB 6000MHz DDR5 RAM - Grey - Umart.com.au</title>
      <span itemprop="priceCurrency" content="AUD">$</span>
      <span itemprop="price" content="619.00" class="goods-price">619.00</span>
      <link itemprop="availability" href="http://schema.org/InStock">`;

    it("reads price, availability and title attributes", () => {
      const r = parseProductPage(html);
      expect(r.priceAud).toBe(619);
      expect(r.availability).toBe("in_stock");
      expect(r.title).toBe("Corsair 32GB (2x16GB) CMH32GX5M2B6000Z38 Vengeance RGB 6000MHz DDR5 RAM - Grey");
      expect(r.parsed!.attributes.generation).toBe("DDR5");
    });

    it("maps a sold-out listing to out_of_stock", () => {
      const r = parseProductPage(html.replace("InStock", "OutOfStock"));
      expect(r.availability).toBe("out_of_stock");
    });
  });
});
