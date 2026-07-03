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
  if (!gen) return null;
  const generation = (`DDR${gen[1]}` as RamAttributes["generation"]);

  // Speed, most-explicit first: "3200MHz" / "6000MT/s" > "DDR4-3200" >
  // "PC4 21300" bandwidth (÷8 → data rate) > a bare 4-digit number in the
  // generation's plausible band ("2x16GB 2666 PC RAM" writes it bare).
  let dataRateMtps: number | undefined;
  let partCl: number | undefined;
  const mhz = /\b(\d{4,5})\s*(?:mhz|mt\/s)\b/.exec(t) ?? /\bddr[45][- ](\d{4,5})\b/.exec(t);
  // G.Skill part numbers encode speed+CL: "F4-3600C18D-32GVK" = DDR4-3600 CL18.
  const gskillPart = /\bf[45] (\d{4})c(\d{2})/.exec(t);
  if (mhz) {
    dataRateMtps = Number(mhz[1]);
  } else if (gskillPart) {
    dataRateMtps = Number(gskillPart[1]);
    partCl = Number(gskillPart[2]);
  } else {
    const pc = /\bpc[45][- ]?(\d{5})\b/.exec(t);
    if (pc) {
      const rate = Number(pc[1]) / 8;
      // PC ratings are rounded bandwidths (21300/8 = 2662.5 → 2666) — snap to the known ladder.
      const LADDER = [2133, 2400, 2666, 2933, 3000, 3200, 3600, 4000, 4400, 4800, 5200, 5600, 6000, 6400, 7200, 8000];
      dataRateMtps = LADDER.reduce((best, r) => (Math.abs(r - rate) < Math.abs(best - rate) ? r : best), LADDER[0]!);
    } else {
      const band = gen[1] === "4" ? { min: 1866, max: 4400 } : { min: 3600, max: 8800 };
      const bare = [...t.matchAll(/\b(\d{4})\b/g)].map((m) => Number(m[1])).find((n) => n >= band.min && n <= band.max);
      if (bare) dataRateMtps = bare;
    }
  }
  if (dataRateMtps === undefined) return null;

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

  const cl = /\bcl(\d+)\b/.exec(t) ?? /\bc(\d{2})\b/.exec(t);
  const casLatency = cl ? Number(cl[1]) : partCl;
  const brand = /^([a-z0-9]+)/.exec(t)?.[1];
  // Laptop markers first ("so dimm" with a space is common in slug/OEM titles),
  // then explicit desktop markers; otherwise honestly unknown — never guess.
  const formFactor: RamAttributes["formFactor"] | undefined =
    /\bso[- ]?dimm\b|\blaptop\b|\bnotebooks?\b/i.test(t) ? "sodimm"
    : /\budimm\b|\bdimm\b|\bdesktop\b/i.test(t) ? "dimm"
    : undefined;

  const attributes: RamAttributes = {
    generation,
    capacityGb,
    dataRateMtps,
    ...(perStickGb !== undefined ? { perStickGb } : {}),
    ...(kitCount !== undefined ? { kitCount } : {}),
    ...(casLatency !== undefined ? { casLatency } : {}),
    ...(formFactor !== undefined ? { formFactor } : {}),
  };
  return { attributes, ...(brand ? { brand } : {}) };
}

/** Extract a manufacturer part number from a title — the most precise search
 * key for a per-SKU price hunt (e.g. "KF432C16BBK2/32", "KD4AGU880-32A160X").
 * Excludes spec/unit tokens ("3200MT/S", "3600MHZ", "32GB") and prefers the
 * LONGEST candidate — real part numbers are long; spec tokens are short. */
export function extractPartNumber(title: string): string | undefined {
  const candidates = (title.match(/\b([a-z0-9][a-z0-9/-]{6,})\b/gi) ?? [])
    .map((w) => w.toUpperCase())
    .filter((w) =>
      /[A-Z]/.test(w) && /[0-9]/.test(w) &&
      !/^(DDR[45]|PC[45]-?\d+)$/.test(w) &&
      !/^\d+(GB|TB|MHZ|MTS|MT\/S|W|V|CL\d+)$/.test(w), // digits + a unit is a spec, not a part
    );
  return candidates.sort((a, b) => b.length - a.length)[0];
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

// ── Field interpreters (shared by the Node-fetch pre-filter AND the render) ───
// These are the single source of truth for the in-stock + price predicates, so
// the cheap pre-filter and the authoritative render decision agree by construction.

/** The in-stock predicate (fail-closed): in_stock ONLY for exactly schema.org/InStock. */
export function availabilityFromHref(href: string | null): "in_stock" | "out_of_stock" {
  const m = /\/(InStock|OutOfStock|SoldOut|PreOrder|BackOrder)\b/i.exec(href ?? "");
  return (m?.[1] ?? "").toLowerCase() === "instock" ? "in_stock" : "out_of_stock";
}

/** Price from a microdata `content` value (e.g. "619.00"). NaN if absent/unparseable. */
export function priceFromContent(content: string | null): number {
  if (content == null || content.trim() === "") return NaN;
  return Number(content);
}

/** Strip the retailer suffix (" - retailer.com.au") from a page <title>. */
export function cleanTitle(raw: string | null): string {
  return (raw ?? "").replace(/\s*-\s*\S+\.com\.au\s*$/i, "").trim();
}

/** Parse a product page (HTML): microdata price + availability + title attributes.
 *  Tier 2 only — Tier 3 (Playwright) is always authoritative.
 *  Checks microdata (Umart/MSY), then JSON-LD (Shopify/JB Hi-Fi), then optimistic.
 *  No text-based fallback — Shopify themes embed "Sold out" as i18n keys regardless
 *  of actual stock status, causing false positives on in-stock items. */
export function parseProductPage(html: string): ProductRead {
  // Microdata price (Umart/MSY platform)
  const price = /itemprop="price"[^>]*content="([\d.]+)"/i.exec(html);
  // JSON-LD price (Shopify etc.) as fallback
  const jsonLdPrice = /"price"\s*:\s*"([\d.]+)"/i.exec(html);
  const priceAud = priceFromContent(price?.[1] ?? jsonLdPrice?.[1] ?? null);

  // Microdata availability (itemprop="availability" href="schema.org/...")
  const avail = /itemprop="availability"[^>]*href="([^"]*)"/i.exec(html);
  // JSON-LD availability ("availability": "https://schema.org/InStock")
  const jsonLdAvail = /"availability"\s*:\s*"(https?:\/\/schema\.org\/[^"]+)"/i.exec(html);

  let availability: "in_stock" | "out_of_stock";
  if (avail) {
    availability = availabilityFromHref(avail[1] ?? null);
  } else if (jsonLdAvail) {
    availability = /InStock/i.test(jsonLdAvail[1] ?? "") ? "in_stock" : "out_of_stock";
  } else {
    availability = "in_stock"; // optimistic — no structured data, let Playwright decide
  }

  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const title = cleanTitle(titleMatch?.[1] ?? null);

  return { priceAud, availability, parsed: parseRamAttributes(title), title };
}
