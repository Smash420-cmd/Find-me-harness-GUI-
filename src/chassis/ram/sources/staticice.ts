/**
 * StaticIceSource — uses staticice.com.au as the finder. StaticICE aggregates
 * all major AU PC retailers (Umart, MSY, PLE, Scorptec, Centrecom, …) in one
 * query and does NOT filter ghost inventory, so the Playwright verifier (Law 1)
 * gets the full candidate set to cull.
 *
 * v1 scope: Umart + MSY only — they run the same ecommerce platform so the
 * existing microdata selectors + interpretUmartFields work unchanged. Other
 * retailers are filtered out until their interpreters are written.
 */
import type { Candidate, ISourceProvider, Spec, SourceCapabilities } from "../../../types/index.js";
import { fetchText } from "../../../providers/net.js";
import { parseProductPage, parseRamAttributes, extractPartNumber } from "./parse.js";
import type { RamCandidateData, RamLiveState, RamSpecFields } from "../types.js";

const STATICICE_SEARCH = "https://www.staticice.com.au/cgi-bin/search.cgi?stype=1&etype=1&q=";

// Affiliate redirect hosts — URLs that go through a redirector rather than
// pointing at the actual product page. Playwright would follow them but the
// candidate URL and title would be wrong, so skip them.
const BLOCKED_HOSTS = new Set(["t.cfjump.com", "www.cfjump.com"]);

interface RawItem {
  readonly retailer: string;
  readonly title: string;
  readonly url: string;
  readonly priceAud: number;
  readonly inStock: boolean;
}

/** Parse StaticICE search results HTML into raw items. */
function parseStaticIce(html: string, maxItems: number): RawItem[] {
  const out: RawItem[] = [];
  const seen = new Set<string>();

  // Each product row: <a alt="RETAILER: Click to see the latest price for TITLE(StockStatus)" ... href="...linkid=2&newurl=ENCODED_URL...">$PRICE</a>
  const re = /<a\s+alt="([^"]+)"\s+title="[^"]*"\s+href="[^"]*linkid=2&newurl=([^&"]+)[^"]*"\s+target="_blank">([\$\d,.]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < maxItems) {
    const alt = m[1]!;
    const encodedUrl = m[2]!;
    const priceText = m[3]!;

    // alt: "RETAILER: Click to see the latest price for TITLE(StockStatus)"
    const altMatch = /^([^:]+):\s*Click to see the latest price for\s+(.+)$/i.exec(alt);
    if (!altMatch) continue;

    const retailer = altMatch[1]!.trim();
    // Strip stock status suffix: "(In Stock)", "(Out of Stock)", "(Pre-Order...)"
    const titleRaw = altMatch[2]!
      .replace(/\((In\s*Stock|Out\s*of\s*Stock|Pre[-\s]?Order[^)]*|Back\s*Order[^)]*)\)\s*$/i, "")
      .replace(/\s+-\s*$/, "") // strip trailing " -" separator in alt text
      .trim();
    // StaticICE only tags items it KNOWS are unavailable — unlabelled = potentially available.
    const inStock = !/Out\s*of\s*Stock|Pre[-\s]?Order|Back\s*Order|Sold\s*Out/i.test(alt);

    const url = decodeURIComponent(encodedUrl);
    let hostname: string;
    try { hostname = new URL(url).hostname; } catch { continue; }

    if (BLOCKED_HOSTS.has(hostname)) continue;
    // Skip category/search pages — StaticICE sometimes links to listing pages not product pages
    if (/searchcat|show_cat\.php|cat_id=|\/category\/|sort_order=|\/(memory|ram)\/?$/i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const priceAud = Number(priceText.replace(/[$,]/g, ""));
    if (!Number.isFinite(priceAud) || priceAud <= 0) continue;

    out.push({ retailer, title: titleRaw, url, priceAud, inStock });
  }
  return out;
}

/** Build a StaticICE search query from RAM spec fields.
 *  Uses total kit capacity: "DDR4 32GB RAM 3200MHz" matches 2×16GB kits,
 *  not 2×8GB kits whose titles also happen to contain "16GB". */
// UI brand values → the token retailers actually print in titles.
const BRAND_QUERY: Record<string, string> = { gskill: "g.skill", teamgroup: "team" };

function buildQuery(fields: RamSpecFields): string {
  const parts: string[] = [fields.generation, `${fields.capacityGb}GB`, "RAM"];
  if (fields.dataRateMtps) parts.push(`${fields.dataRateMtps}MHz`);
  const brand = fields.constraints?.brandInclude?.[0];
  if (brand) parts.unshift(BRAND_QUERY[brand.toLowerCase()] ?? brand);
  return encodeURIComponent(parts.join(" "));
}

export interface StaticIceSourceOptions {
  readonly maxCandidates?: number;
  readonly fetchText?: (url: string) => Promise<string>;
}

export class StaticIceSource implements ISourceProvider<RamCandidateData> {
  readonly name = "staticice";
  readonly capabilities: SourceCapabilities = { hasApi: false, hasStockFlag: true, rendersClean: true };
  readonly reliability = 0.9;

  private readonly maxCandidates: number;
  private readonly get: (url: string) => Promise<string>;

  constructor(opts: StaticIceSourceOptions = {}) {
    this.maxCandidates = opts.maxCandidates ?? 10;
    this.get = opts.fetchText ?? fetchText;
  }

  async observe(spec: Spec<unknown>): Promise<Candidate<RamCandidateData>[]> {
    const fields = spec.fields as RamSpecFields;
    const query = buildQuery(fields);
    console.log(`[staticice] query: "${decodeURIComponent(query)}"`);

    const html = await this.get(`${STATICICE_SEARCH}${query}`);
    const items = parseStaticIce(html, this.maxCandidates * 4); // over-fetch, filter below
    console.log(`[staticice] ${items.length} raw result(s) from StaticICE`);

    const inStock = items.filter((i) => i.inStock);
    console.log(`[staticice] ${inStock.length} potentially available, ${items.length - inStock.length} skipped (explicitly out-of-stock/pre-order)`);

    const formFactor = fields.constraints?.formFactor;
    const candidates: Candidate<RamCandidateData>[] = [];
    for (const item of inStock) {
      // Respect formFactor constraint: skip SODIMMs when DIMM (desktop) is requested
      if (formFactor === "dimm" && /sodimm/i.test(item.title)) {
        console.log(`[staticice] skip (sodimm, wanted dimm): "${item.title}" (${item.retailer})`);
        continue;
      }
      const parsed = parseRamAttributes(item.title);
      if (!parsed) {
        console.log(`[staticice] skip (no attrs): "${item.title}" (${item.retailer})`);
        continue;
      }
      // Skip if total capacity doesn't match the requested spec
      if (parsed.attributes.capacityGb !== fields.capacityGb) {
        console.log(`[staticice] skip (capacity ${parsed.attributes.capacityGb}GB ≠ ${fields.capacityGb}GB): "${item.title}" (${item.retailer})`);
        continue;
      }
      console.log(`[staticice] candidate: "${item.title}" @ $${item.priceAud} — ${item.retailer} — ${item.url}`);

      const data: RamCandidateData = {
        productId: item.url, // URL is the unique identity across retailers
        title: item.title,
        url: item.url,
        attributes: parsed.attributes,
        priceAud: item.priceAud,
        ...(parsed.brand ? { brand: parsed.brand } : {}),
        retailer: item.retailer,
      };
      candidates.push({ key: item.url, source: this.name, data, relevance: 1 });

      if (candidates.length >= this.maxCandidates) break;
    }
    console.log(`[staticice] ${candidates.length} candidate(s) forwarded to verify`);
    return candidates;
  }

  /** Per-SKU price hunt: search StaticICE by part number, falling back to a
   * brand/line name query — StaticICE listings don't always carry the MPN
   * (e.g. Klevv's KD4AGU880-32A160X returns 0, "klevv cras rgb 32gb" returns
   * the whole market). Returns every potentially-available listing. */
  async searchForTitle(title: string): Promise<Candidate<RamCandidateData>[]> {
    const part = extractPartNumber(title);
    let items: ReturnType<typeof parseStaticIce> = [];
    if (part) {
      console.log(`[staticice] SKU hunt: "${part}"`);
      items = parseStaticIce(await this.get(`${STATICICE_SEARCH}${encodeURIComponent(part)}`), 40).filter((i) => i.inStock);
    }
    if (items.length === 0) {
      // Name fallback: brand + line words + capacity ("klevv cras rgb 32gb")
      const words = title.replace(/\[[^\]]*\]/g, " ").split(/\s+/);
      const nameWords = words.filter((w) => /^[a-z.]+$/i.test(w) && w.length >= 2).slice(0, 3);
      const cap = words.find((w) => /^\d+gb$/i.test(w.replace(/[(),]/g, "")));
      const q = [...nameWords, cap ?? "", "RAM"].join(" ").replace(/\s+/g, " ").trim();
      console.log(`[staticice] SKU hunt fallback: "${q}"`);
      items = parseStaticIce(await this.get(`${STATICICE_SEARCH}${encodeURIComponent(q)}`), 40).filter((i) => i.inStock);
    }
    console.log(`[staticice] SKU hunt: ${items.length} potentially-available listing(s)`);
    return items.map((item) => ({
      key: item.url,
      source: this.name,
      data: {
        productId: item.url,
        title: item.title,
        url: item.url,
        attributes: parseRamAttributes(item.title)?.attributes ?? ({} as RamCandidateData["attributes"]),
        priceAud: item.priceAud,
        retailer: item.retailer,
      },
      relevance: 1,
    }));
  }

  /** Live re-read of the retailer product page (Law 2 — never cached). */
  async read(candidate: Candidate<RamCandidateData>): Promise<RamLiveState> {
    const read = parseProductPage(await this.get(candidate.data.url));
    return {
      availability: read.availability,
      priceAud: Number.isFinite(read.priceAud) ? read.priceAud : candidate.data.priceAud,
      attributes: read.parsed?.attributes ?? candidate.data.attributes,
    };
  }
}
