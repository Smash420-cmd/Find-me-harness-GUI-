/**
 * GoogleSource — discovers product pages by running a real Google web search.
 * No per-site classifier: we just collect .com.au URLs from search results and
 * let the existing Tier 2 + Tier 3 pipeline verify each one universally.
 *
 * Falls back gracefully to [] if Google detects the browser or the query
 * returns nothing — StaticICE results are still available in that case.
 */
import type { Candidate, ISourceProvider, Spec, SourceCapabilities } from "../../../types/index.js";
import type { RenderProvider } from "../../../providers/index.js";
import { fetchText } from "../../../providers/net.js";
import { parseProductPage, parseRamAttributes } from "./parse.js";
import type { RamAttributes, RamCandidateData, RamLiveState, RamSpecFields } from "../types.js";

// Aggregators and non-retailer .com.au domains to skip
const SKIP = ["staticice", "pricespy", "getpricelist", "google", "youtube", "reddit", "facebook", "twitter", "whirlpool", "gumtree", "devicedeal", "amazon"];

function buildQuery(f: RamSpecFields): string {
  // Use total capacity so "DDR4 32GB RAM 3600MHz" finds kits, not single sticks
  const parts: string[] = [f.generation, `${f.capacityGb}GB`, "RAM"];
  if (f.dataRateMtps) parts.push(`${f.dataRateMtps}MHz`);
  parts.push("buy australia");
  return encodeURIComponent(parts.join(" "));
}

// Unused — kept for observeMore reference; all callers now use buildTargetedQuery
// function buildSpecificQuery(f: RamSpecFields): string { ... }

// Retailers to target directly via Google site: queries.
// Includes specialty stores absent from StaticICE (Scorptec, PLE, Mwave) and smaller retailers.
const TARGETED_RETAILERS = [
  "scorptec.com.au",
  "ple.com.au",
  "mwave.com.au",
  "pccasegear.com.au",
  "jwcomputers.com.au",
  "ramcity.com.au",
  "upgradeable.com.au",
  "shoppingexpress.com.au",
  "skycomp.com.au",
  "i-tech.com.au",
  "bpctech.com.au",
  "pcbyte.com.au",
  "budgetpc.com.au",
  "evatech.com.au",
  "techfast.com.au",
  "harristech.com.au",
  "kogan.com",
  "dicksmith.com.au",
];

function buildTargetedQuery(f: RamSpecFields): string {
  // Use total capacity (capacityGb) so "DDR5 32GB 6000" finds kits, not single sticks
  const parts = [f.generation, `${f.capacityGb}GB`];
  if (f.dataRateMtps) parts.push(String(f.dataRateMtps));
  const sites = TARGETED_RETAILERS.map(r => `site:${r}`).join(" OR ");
  return encodeURIComponent(`${parts.join(" ")} (${sites})`);
}

// Plain search query for direct retailer search endpoints (no Google involved)
function buildRetailerSearchQuery(f: RamSpecFields): string {
  const parts = [f.generation, `${f.capacityGb}GB`];
  if (f.dataRateMtps) parts.push(`${f.dataRateMtps}MHz`);
  return encodeURIComponent(parts.join(" "));
}

// Specialty stores with known search endpoints — bypasses Google entirely
// Each entry: [search URL template using {q} placeholder, retailer hostname]
const RETAILER_SEARCH_ENDPOINTS: Array<[string, string]> = [
  ["https://www.scorptec.com.au/search?q={q}", "scorptec.com.au"],
  ["https://www.ple.com.au/Search?q={q}", "ple.com.au"],
  ["https://www.mwave.com.au/search?q={q}", "mwave.com.au"],
  ["https://www.pccasegear.com/search?q={q}", "pccasegear.com.au"],
  ["https://www.centrecom.com.au/catalogsearch/result/?q={q}", "centrecom.com.au"],
];

// AU retailers without a .com.au domain — allowed through the hostname filter below
const AU_NON_DOTCOMAU = new Set(["kogan.com", "www.kogan.com"]);

// Shared URL filter used by both EXTRACT_JS variants
const EXTRACT_FILTER_JS = `
  function addUrl(href) {
    try {
      const u = new URL(href);
      if (!u.hostname.endsWith('.com.au') && !auExtra.includes(u.hostname)) return;
      if (skip.some(s => u.hostname.includes(s))) return;
      if (u.pathname.length < 5) return;
      u.hash = ''; u.searchParams.delete('srsltid');
      const h = u.href;
      if (!seen.has(h)) { seen.add(h); out.push(h); }
    } catch {}
  }
`;

// JS run inside a regular Google Search results page
const EXTRACT_JS = `(() => {
  const seen = new Set(); const out = [];
  const skip = ${JSON.stringify(SKIP)};
  const auExtra = ${JSON.stringify([...AU_NON_DOTCOMAU])};
  ${EXTRACT_FILTER_JS}
  document.querySelectorAll('#search a[href^="http"], #rso a[href^="http"]').forEach(a => addUrl(a.href));
  return out.slice(0, 20);
})()`;

// JS run inside a retailer's own search results page — extracts individual product page URLs.
// Checks each path segment against a known-bad set; also tries product card containers first.
const EXTRACT_PRODUCT_LINKS_JS = `(() => {
  const seen = new Set(); const out = [];
  const BAD = new Set(['search','searches','category','categories','cart','checkout','wishlist','account','createaccount','lostpassword','login','register','compare','dashboard','ticket','support','help','contact','about','blog','news','brand','brands','tag','tags','trending','collection','collections','clearance','deals','offers','sale','new','filter','page']);
  function addHref(href) {
    try {
      const u = new URL(href, location.href);
      if (u.hostname !== location.hostname) return;
      const p = u.pathname;
      if (!p || p === '/' || p === location.pathname) return;
      const segs = p.split('/').filter(Boolean);
      if (!segs.length) return;
      if (segs.some(s => { const l = s.toLowerCase(); return BAD.has(l) || l.includes('category') || l.includes('account') || l.includes('brand') || l.includes('search') || l.includes('catalog') || l.includes('promo') || l.includes('deal') || l.includes('bundle') || /^my[a-z]/i.test(s) || /^page\\d/i.test(s); })) return;
      // Require a product marker: at least one segment with mixed alphanumeric (model/ID) or pure numeric
      if (!segs.some(s => s.length > 4 && /\\d/.test(s) && /[a-zA-Z]/.test(s)) && !segs.some(s => /^\\d+$/.test(s))) return;
      const full = u.origin + p;
      if (!seen.has(full)) { seen.add(full); out.push(full); }
    } catch {}
  }
  // Prefer links inside product card containers
  const cards = document.querySelectorAll('[class*="product"],[class*="item-"],[class*="listing"],[class*="result-"],[data-product],[data-sku]');
  if (cards.length > 2) { cards.forEach(el => { const a = el.tagName==='A'?el:el.querySelector('a'); if(a) addHref(a.href); }); }
  else { document.querySelectorAll('a[href]').forEach(a => addHref(a.href)); }
  return out.slice(0, 8);
})()`;

export class GoogleSource implements ISourceProvider<RamCandidateData> {
  readonly name = "google";
  readonly capabilities: SourceCapabilities = { hasApi: false, hasStockFlag: false, rendersClean: false };
  readonly reliability = 0.75;

  constructor(private readonly validator: RenderProvider) {}

  // Common URL path words that aren't part of a product name
  private static readonly PATH_NOISE = new Set(["products", "product", "buy", "shop", "p", "item", "items", "itm", "detail", "details", "listing", "listings", "store", "catalogue", "catalog"]);

  // Browse a retailer's own search results page and extract product page URLs
  private async browseRetailerSearch(endpointTemplate: string, host: string, query: string, spec?: RamSpecFields): Promise<Candidate<RamCandidateData>[]> {
    const url = endpointTemplate.replace("{q}", query);
    const urls = await this.validator.browse(url, EXTRACT_PRODUCT_LINKS_JS);
    const filtered = urls.filter(u => { try { return new URL(u).hostname.replace(/^www\./, "") === host; } catch { return false; } });
    console.log(`[retailer] ${host}: ${filtered.length} candidate URL(s)`);
    return filtered
      .map(u => {
        const retailer = host;
        const slug = new URL(u).pathname.replace(/\//g, " ").replace(/[-_]/g, " ").trim();
        const parsed = parseRamAttributes(slug);
        // Skip if no RAM keywords in slug — likely an unrelated product (SSD, GPU, cooling, etc.)
        if (!parsed && !/ddr[456]|sdram|dimm|sodimm|\bram\b|memory/i.test(slug)) return null;
        // Skip if URL slug clearly contradicts the requested spec (wrong generation or wrong total capacity)
        if (spec && parsed?.attributes) {
          const a = parsed.attributes;
          if (a.generation && a.generation.toLowerCase() !== spec.generation.toLowerCase()) return null;
          if (a.capacityGb && a.capacityGb !== spec.capacityGb) return null;
        }
        const title = slug.split(" ").filter(w => !GoogleSource.PATH_NOISE.has(w.toLowerCase())).join(" ").trim();
        return {
          key: u, source: this.name,
          data: { productId: u, title, url: u, attributes: parsed?.attributes ?? {} as RamAttributes, priceAud: NaN, retailer },
          relevance: 0.7,
        } as Candidate<RamCandidateData>;
      })
      .filter((c): c is Candidate<RamCandidateData> => c !== null);
  }

  // relaxed=true: include URLs even when parseRamAttributes fails (Phase 1 HTTP read validates them)
  private async fetchCandidates(searchUrl: string, relaxed = false, extractJs = EXTRACT_JS): Promise<Candidate<RamCandidateData>[]> {
    const urls = await this.validator.browse(searchUrl, extractJs);
    console.log(`[google] ${urls.length} .com.au URL(s) from: ${searchUrl}`);
    const candidates: Candidate<RamCandidateData>[] = [];
    for (const url of urls) {
      const slug = new URL(url).pathname.replace(/\//g, " ").replace(/[-_]/g, " ").trim();
      const parsed = parseRamAttributes(slug);
      const retailer = new URL(url).hostname.replace(/^www\./, "");
      const title = slug.split(" ")
        .filter(w => !GoogleSource.PATH_NOISE.has(w.toLowerCase()))
        .join(" ")
        .replace(/\s{2,}/g, " ").trim();
      if (!parsed) {
        if (!relaxed) { console.log(`[google] skip (no RAM attrs): ${url}`); continue; }
        // relaxed: include anyway, Phase 1 HTTP read will validate price/stock
        candidates.push({
          key: url, source: this.name,
          data: { productId: url, title, url, attributes: {} as RamAttributes, priceAud: NaN, retailer },
          relevance: 0.6,
        });
        continue;
      }
      candidates.push({
        key: url, source: this.name,
        data: {
          productId: url, title,
          url, attributes: parsed.attributes, priceAud: NaN,
          ...(parsed.brand ? { brand: parsed.brand } : {}), retailer,
        },
        relevance: 0.8,
      });
    }
    console.log(`[google] ${candidates.length} candidate(s)`);
    return candidates;
  }

  async observe(spec: Spec<unknown>): Promise<Candidate<RamCandidateData>[]> {
    const fields = spec.fields as RamSpecFields;
    const q1 = buildQuery(fields);
    const q3 = buildTargetedQuery(fields);
    const qr = buildRetailerSearchQuery(fields);
    console.log(`[google] observe: web + targeted-google + retailer-direct in parallel`);
    const [c1, c3, ...retailerBatches] = await Promise.all([
      this.fetchCandidates(`https://www.google.com.au/search?q=${q1}&num=20`),
      this.fetchCandidates(`https://www.google.com.au/search?q=${q3}&num=20`, true),
      ...RETAILER_SEARCH_ENDPOINTS.map(([tpl, host]) => this.browseRetailerSearch(tpl, host, qr, fields)),
    ]);
    const seen = new Set<string>();
    // retailer-direct before c3: product pages beat Google category pages for the 1-per-retailer slot
    return [...c1, ...retailerBatches.flat(), ...c3].filter(c => !seen.has(c.key) && seen.add(c.key));
  }

  /** Find More: page 2 of web + targeted-google + retailer-direct. */
  async observeMore(spec: Spec<unknown>): Promise<Candidate<RamCandidateData>[]> {
    const fields = spec.fields as RamSpecFields;
    const q1 = buildQuery(fields);
    const q3 = buildTargetedQuery(fields);
    const qr = buildRetailerSearchQuery(fields);
    console.log(`[google] observeMore: web-p2 + targeted-google + retailer-direct in parallel`);
    const [c1, c3, ...retailerBatches] = await Promise.all([
      this.fetchCandidates(`https://www.google.com.au/search?q=${q1}&num=20&start=10`),
      this.fetchCandidates(`https://www.google.com.au/search?q=${q3}&num=20`, true),
      ...RETAILER_SEARCH_ENDPOINTS.map(([tpl, host]) => this.browseRetailerSearch(tpl, host, qr, fields)),
    ]);
    const seen = new Set<string>();
    return [...c1, ...retailerBatches.flat(), ...c3].filter(c => !seen.has(c.key) && seen.add(c.key));
  }

  async read(candidate: Candidate<RamCandidateData>): Promise<RamLiveState> {
    const read = parseProductPage(await fetchText(candidate.data.url));
    return {
      availability: read.availability,
      priceAud: Number.isFinite(read.priceAud) ? read.priceAud : candidate.data.priceAud,
      attributes: read.parsed?.attributes ?? candidate.data.attributes,
      ...(read.title ? { title: read.title } : {}),
    };
  }

  /** Google search for a specific product title — returns retailer .com.au URLs.
   *  Uses quoted part-number search when a part number is found (most precise);
   *  otherwise falls back to unquoted title search. */
  async searchForTitle(title: string): Promise<string[]> {
    // Extract part number: 8+ char alphanumeric token containing both letters and digits
    const partNum = title.match(/\b([a-z0-9]{8,})\b/gi)
      ?.map(w => w.toUpperCase())
      .find(w => /[A-Z]/.test(w) && /[0-9]/.test(w));
    const q = partNum
      ? encodeURIComponent(`"${partNum}" buy site:.com.au`)
      : encodeURIComponent(`${title} buy site:.com.au`);
    const url = `https://www.google.com.au/search?q=${q}&num=20&gl=au&hl=en`;
    console.log(`[google] deepsearch: ${partNum ? `part# "${partNum}"` : `title "${title}"`}`);
    return this.validator.browse(url, EXTRACT_JS);
  }
}
