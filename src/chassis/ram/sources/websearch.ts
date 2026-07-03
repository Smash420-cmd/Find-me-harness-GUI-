/**
 * WebSearchSource — multi-engine web search ("websearch on crack").
 *
 * Discovery via DuckDuckGo HTML + Bing, queried in parallel with plain HTTP
 * (no browser, no CAPTCHA risk). Candidates are built from SERP RESULT TITLES —
 * which carry the full product name ("Corsair Vengeance 32GB (2x16GB) DDR5
 * 6000MHz CL30") — never from URL-slug guessing. Titles that parse and
 * contradict the spec are dropped here (cheap noise removal); titles that don't
 * parse are kept relaxed and re-checked after the HTTP read.
 */
import type { Candidate, ISourceProvider, Spec, SourceCapabilities } from "../../../types/index.js";
import type { RamAttributes, RamCandidateData, RamLiveState, RamSpecFields } from "../types.js";
import { parseRamAttributes, parseProductPage, extractPartNumber } from "./parse.js";
import { contradictsSpec } from "../verify.js";
import { fetchText } from "../../../providers/net.js";

interface SerpHit {
  readonly url: string;
  readonly title: string;
}

// Hosts that are never a buyable product page.
const JUNK_HOSTS = /(?:^|\.)(?:google|bing|duckduckgo|youtube|reddit|wikipedia|facebook|gumtree|pinterest|whirlpool|ozbargain|staticice)\./i;

/** AU retail host filter: .com.au (or kogan.com) and not a junk host. */
function isRetailHost(host: string): boolean {
  if (JUNK_HOSTS.test(host)) return false;
  return host.endsWith(".com.au") || host === "kogan.com" || host.endsWith(".kogan.com");
}

/** Marketplace search/category pages carry stray JSON-LD prices — only their
 * canonical product paths are trustworthy candidates. */
function isProductUrl(host: string, pathname: string): boolean {
  if (host.includes("amazon.")) return pathname.includes("/dp/");
  if (host.includes("ebay.")) return pathname.includes("/itm/");
  return true;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

/** DuckDuckGo HTML endpoint — results are plain anchors with a uddg= redirect. */
async function searchDuckDuckGo(query: string): Promise<SerpHit[]> {
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=au-en`,
  );
  const hits: SerpHit[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const uddg = /[?&]uddg=([^&"]+)/.exec(m[1]!);
    const url = uddg ? decodeURIComponent(uddg[1]!) : m[1]!;
    if (!url.startsWith("http")) continue;
    hits.push({ url, title: stripTags(m[2]!) });
  }
  return hits;
}

/** Bing web search — <li class="b_algo"><h2><a href>Title</a>. */
async function searchBing(query: string): Promise<SerpHit[]> {
  const html = await fetchText(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=AU&count=30`,
  );
  const hits: SerpHit[] = [];
  const re = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!m[1]!.startsWith("http")) continue;
    hits.push({ url: m[1]!, title: stripTags(m[2]!) });
  }
  return hits;
}

// UI brand values → the token retailers actually print in titles.
const BRAND_QUERY: Record<string, string> = { gskill: "g.skill", teamgroup: "team group" };

function buildQueries(f: RamSpecFields): string[] {
  const kit = f.kitCount && f.perStickGb ? ` ${f.kitCount}x${f.perStickGb}GB` : "";
  const speed = f.dataRateMtps ? ` ${f.dataRateMtps}MHz` : "";
  const rawBrand = f.constraints?.brandInclude?.[0];
  const brand = rawBrand ? ` ${BRAND_QUERY[rawBrand.toLowerCase()] ?? rawBrand}` : "";
  const form = f.constraints?.formFactor === "sodimm" ? " SODIMM" : "";
  const base = `${f.generation} ${f.capacityGb}GB${kit}${speed}${form}${brand} RAM`;
  const queries = [
    `${base} buy australia`,
    `${base} in stock`,
  ];
  // No brand constraint → also hunt the popular performance kits by name, so the
  // board isn't just whatever bare/OEM modules the generic queries surface.
  if (!brand) {
    for (const b of ["G.Skill", "Corsair", "Kingston Fury"]) {
      queries.push(`${b} ${base} price`);
    }
  }
  return queries;
}

// SERP cache — repeat scans (and testing bursts) must not re-hammer the engines
// into bot-walling us. ponytail: in-memory Map with TTL, no eviction beyond TTL.
const SERP_TTL_MS = 5 * 60_000;
const serpCache = new Map<string, { at: number; hits: SerpHit[] }>();

async function cached(engine: string, query: string, run: () => Promise<SerpHit[]>): Promise<SerpHit[]> {
  const key = `${engine}:${query}`;
  const prev = serpCache.get(key);
  if (prev && Date.now() - prev.at < SERP_TTL_MS) {
    console.log(`[websearch] ${engine} "${query}" → ${prev.hits.length} hits (cached)`);
    return prev.hits;
  }
  const hits = await run();
  console.log(`[websearch] ${engine} "${query}" → ${hits.length} hits${hits.length === 0 ? " (0 = possible bot-wall)" : ""}`);
  serpCache.set(key, { at: Date.now(), hits });
  return hits;
}

// Runs in a Playwright page on a Bing SERP — returns "url|title" strings.
const BING_BROWSE_JS = `(() =>
  [...document.querySelectorAll('#b_results li.b_algo h2 a')]
    .slice(0, 30)
    .map(a => a.href + '|' + (a.textContent || '').trim())
)()`;

/** Minimal browse interface — satisfied by PlaywrightValidator. */
export interface SerpBrowser {
  browse: (url: string, extractJs: string) => Promise<string[]>;
}

export class WebSearchSource implements ISourceProvider<RamCandidateData> {
  readonly name = "websearch";
  readonly capabilities: SourceCapabilities = { hasApi: false, hasStockFlag: false, rendersClean: false };
  readonly reliability = 0.7;

  /** Optional real-browser fallback for when plain HTTP gets bot-walled. */
  constructor(private readonly browser?: SerpBrowser) {}

  async observe(spec: Spec<unknown>): Promise<Candidate<RamCandidateData>[]> {
    const fields = spec.fields as RamSpecFields;
    const queries = buildQueries(fields);
    console.log(`[websearch] engines=ddg,bing queries=${JSON.stringify(queries)}`);

    // Engines in parallel, but SERIAL within each engine with a small gap —
    // five simultaneous hits from one IP is exactly what gets us bot-walled.
    const runEngine = async (engine: string, search: (q: string) => Promise<SerpHit[]>): Promise<SerpHit[]> => {
      const all: SerpHit[] = [];
      for (const q of queries) {
        const hits = await cached(engine, q, () =>
          search(q).catch((e) => { console.log(`[websearch] ${engine} error: ${e}`); return [] as SerpHit[]; }),
        );
        all.push(...hits);
        if (hits.length > 0) await new Promise((r) => setTimeout(r, 400));
      }
      return all;
    };

    const batches = await Promise.all([
      runEngine("ddg", searchDuckDuckGo),
      runEngine("bing", searchBing),
    ]);

    // Both engines walled? Retry the primary queries through a real browser —
    // a proper fingerprint usually passes where bare fetch doesn't.
    if (batches.flat().length === 0 && this.browser) {
      console.log(`[websearch] both engines returned 0 — falling back to browser SERP`);
      for (const q of queries.slice(0, 2)) {
        const rows = await this.browser.browse(
          `https://www.bing.com/search?q=${encodeURIComponent(q)}&cc=AU&count=30`,
          BING_BROWSE_JS,
        );
        batches.push(rows.flatMap((row) => {
          const i = row.indexOf("|");
          return i > 0 ? [{ url: row.slice(0, i), title: row.slice(i + 1) }] : [];
        }));
      }
      console.log(`[websearch] browser fallback → ${batches.flat().length} hits`);
    }

    const seen = new Set<string>();
    const out: Candidate<RamCandidateData>[] = [];
    for (const hit of batches.flat()) {
      let host: string;
      try {
        const u = new URL(hit.url);
        host = u.hostname.replace(/^www\./, "");
        if (!isProductUrl(host, u.pathname)) continue;
      } catch { continue; }
      if (!isRetailHost(host)) continue;
      const key = hit.url.split("#")[0]!;
      if (seen.has(key)) continue;
      seen.add(key);

      const parsed = parseRamAttributes(hit.title);
      if (parsed) {
        // Title parsed — drop on a KNOWN contradiction (cheap noise removal);
        // absence of kit/CL info passes, the read/render layers re-check.
        const why = contradictsSpec(parsed.attributes, fields);
        if (why) { console.log(`[websearch] skip (${why}): "${hit.title}"`); continue; }
      } else {
        // Unparsed title: keep only if it names the requested capacity —
        // kills category pages ("DDR5 Desktop RAM", "Shop RAM - JB Hi-Fi").
        const capRe = new RegExp(`\\b${fields.capacityGb}\\s*gb\\b`, "i");
        if (!capRe.test(hit.title) || !/ddr[45]|dimm|\bram\b|memory/i.test(hit.title)) continue;
      }

      out.push({
        key,
        source: this.name,
        data: {
          productId: key,
          title: hit.title,
          url: key,
          attributes: parsed?.attributes ?? ({} as RamAttributes),
          priceAud: NaN,
          ...(parsed?.brand ? { brand: parsed.brand } : {}),
          retailer: host,
        },
        relevance: parsed ? 0.85 : 0.6,
      });
    }
    console.log(`[websearch] ${out.length} candidate(s) after title filter`);
    return out;
  }

  /** Per-SKU price hunt: quoted part-number search on DDG + Bing in parallel.
   * Returns retail product URLs for the read/render pipeline to price-check. */
  async searchForTitle(title: string): Promise<string[]> {
    const part = extractPartNumber(title);
    const q = part ? `"${part}" buy australia` : `${title} price australia`;
    const [ddg, bing] = await Promise.all([
      cached("ddg", q, () => searchDuckDuckGo(q).catch(() => [])),
      cached("bing", q, () => searchBing(q).catch(() => [])),
    ]);
    const seen = new Set<string>();
    return [...ddg, ...bing]
      .flatMap((hit) => {
        try {
          const u = new URL(hit.url);
          const host = u.hostname.replace(/^www\./, "");
          if (!isRetailHost(host) || !isProductUrl(host, u.pathname)) return [];
          const key = hit.url.split("#")[0]!;
          if (seen.has(key)) return [];
          seen.add(key);
          return [key];
        } catch { return []; }
      });
  }

  /** Same HTTP read as GoogleSource — page microdata/JSON-LD price + availability + title attrs. */
  async read(candidate: Candidate<RamCandidateData>): Promise<RamLiveState> {
    const read = parseProductPage(await fetchText(candidate.data.url));
    return {
      availability: read.availability,
      priceAud: Number.isFinite(read.priceAud) ? read.priceAud : candidate.data.priceAud,
      attributes: read.parsed?.attributes ?? candidate.data.attributes,
      ...(read.title ? { title: read.title } : {}),
    };
  }
}
