/**
 * Umart parsing (pure, offline-testable). Domain knowledge of Umart's markup
 * lives ONLY here + umart.ts (Law 7). Three parsers:
 *   - parseRamAttributes: a title/slug → RAM attributes (+ brand)
 *   - parseListing:       a category page → candidate identities
 *   - parseProductPage:   a product page → live price + availability
 */
import type { RamAttributes } from "../types.js";

export interface ParsedRam {
  readonly attributes: RamAttributes;
  readonly brand?: string;
}

/**
 * Parse a kit's attributes from its title OR url slug. Slugs encode everything,
 * e.g. "corsair-32gb-2x16gb-...-6000mhz-ddr5-ram-grey". Returns null if the text
 * is not recognisably a RAM kit (missing generation or speed).
 */
export function parseRamAttributes(text: string): ParsedRam | null {
  const t = text.replace(/[-_]+/g, " ").toLowerCase();

  const gen = /ddr([45])\b/.exec(t);
  const speed = /\b(\d{4,5})\s*mhz\b/.exec(t) ?? /\bddr[45][- ](\d{4,5})\b/.exec(t);
  if (!gen || !speed) return null;

  const generation = (`DDR${gen[1]}` as RamAttributes["generation"]);
  const dataRateMtps = Number(speed[1]);

  // Kit: "2x16gb" → kitCount=2, perStickGb=16, total=32.
  const kit = /\b(\d+)\s*x\s*(\d+)\s*gb\b/.exec(t);
  let kitCount: number | undefined;
  let perStickGb: number | undefined;
  let capacityGb: number;
  if (kit) {
    kitCount = Number(kit[1]);
    perStickGb = Number(kit[2]);
    capacityGb = kitCount * perStickGb;
  } else {
    // Single total like "16gb".
    const total = /\b(\d+)\s*gb\b/.exec(t);
    if (!total) return null;
    capacityGb = Number(total[1]);
  }

  const cl = /\bcl(\d+)\b/.exec(t);
  const casLatency = cl ? Number(cl[1]) : undefined;
  const brand = /^([a-z0-9]+)/.exec(t)?.[1];

  const attributes: RamAttributes = {
    generation,
    capacityGb,
    dataRateMtps,
    ...(perStickGb !== undefined ? { perStickGb } : {}),
    ...(kitCount !== undefined ? { kitCount } : {}),
    ...(casLatency !== undefined ? { casLatency } : {}),
  };
  return { attributes, ...(brand ? { brand } : {}) };
}

export interface ListingItem {
  readonly productId: string;
  readonly slug: string;
  readonly url: string;
}

/** Extract distinct product identities from a category/listing page. */
export function parseListing(html: string, origin = "https://www.umart.com.au"): ListingItem[] {
  const seen = new Set<string>();
  const out: ListingItem[] = [];
  const re = /href="(?:https?:\/\/[^/]+)?\/product\/([a-z0-9-]+?)-(\d+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1]!;
    const productId = m[2]!;
    if (seen.has(productId)) continue;
    seen.add(productId);
    out.push({ productId, slug, url: `${origin}/product/${slug}-${productId}` });
  }
  return out;
}

export interface ProductRead {
  readonly priceAud: number;
  readonly availability: "in_stock" | "out_of_stock";
  readonly parsed: ParsedRam | null;
  readonly title: string;
}

/** Parse a product page: microdata price + availability + title attributes. */
export function parseProductPage(html: string): ProductRead {
  const price = /itemprop="price"[^>]*content="([\d.]+)"/i.exec(html);
  const priceAud = price ? Number(price[1]) : NaN;

  const avail = /itemprop="availability"[^>]*href="[^"]*\/(InStock|OutOfStock|SoldOut|PreOrder|BackOrder)"/i.exec(html);
  const token = (avail?.[1] ?? "").toLowerCase();
  const availability: ProductRead["availability"] = token === "instock" ? "in_stock" : "out_of_stock";

  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const title = (titleMatch?.[1] ?? "").replace(/\s*-\s*Umart\.com\.au\s*$/i, "").trim();

  return { priceAud, availability, parsed: parseRamAttributes(title), title };
}
