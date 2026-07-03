/**
 * CatalogSource — harvests the major AU retailers' OWN category pages.
 *
 * A retailer's "DDR4 Desktop Memory" page is its complete live inventory —
 * far better recall than sampling individual product pages out of search
 * engines. We browse each category with Playwright (they're JS-rendered),
 * pull every product card's link + title, and pipe candidates through the
 * same contradiction filter / read / render verification as every other tool.
 */
import type { Candidate, ISourceProvider, Spec, SourceCapabilities } from "../../../types/index.js";
import type { RamAttributes, RamCandidateData, RamLiveState, RamSpecFields } from "../types.js";
import { parseRamAttributes, parseProductPage } from "./parse.js";
import { contradictsSpec } from "../verify.js";
import { fetchText } from "../../../providers/net.js";

interface CatalogBrowser {
  browse: (url: string, extractJs: string) => Promise<string[]>;
}

// The known category pages per generation. These URLs surface in every scan's
// search results already — now we walk through the door instead of past it.
const CATALOG_PAGES: Record<"DDR4" | "DDR5", string[]> = {
  DDR4: [
    "https://www.scorptec.com.au/product/memory/ddr4-desktop-memory",
    "https://www.centrecom.com.au/ddr4-desktop-ram",
    "https://www.umart.com.au/pc-parts/computer-parts/memory-ram/ddr4-ram-659",
    "https://www.msy.com.au/pc-parts/computer-parts/memory-ram/ddr4-ram-659",
    "https://www.mwave.com.au/memory/pc-ddr4",
    "https://www.ple.com.au/Categories/932/DDR4-Desktop-Memory",
  ],
  DDR5: [
    "https://www.scorptec.com.au/product/memory/ddr5-desktop-memory",
    "https://www.centrecom.com.au/ddr5-desktop-ram",
    "https://www.umart.com.au/pc-parts/computer-parts/memory-ram/ddr5-ram-1085",
    "https://www.msy.com.au/pc-parts/computer-parts/memory-ram/ddr5-ram-1085",
    "https://www.mwave.com.au/memory/pc-ddr5",
    "https://www.ple.com.au/Categories/1188/Memory-RAM/Desktop-Memory/All-DDR5-Memory",
  ],
};

// Runs on the rendered category page: every same-host product link whose
// anchor text looks like a RAM title. Returns "url|title" rows.
const EXTRACT_CARDS_JS = `(() => {
  const seen = new Set(); const out = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const text = (a.getAttribute('title') || a.textContent || '').replace(/\\s+/g, ' ').trim();
    if (text.length < 18 || !/ddr[45]/i.test(text) || !/\\d+\\s*gb/i.test(text)) continue;
    try {
      const u = new URL(a.href, location.href);
      if (u.hostname !== location.hostname) continue;
      if (u.pathname === location.pathname || u.pathname === '/') continue;
      const full = u.origin + u.pathname;
      if (seen.has(full)) continue; seen.add(full);
      out.push(full + '|' + text);
    } catch {}
  }
  return out.slice(0, 50);
})()`;

export class CatalogSource implements ISourceProvider<RamCandidateData> {
  readonly name = "catalog";
  readonly capabilities: SourceCapabilities = { hasApi: false, hasStockFlag: false, rendersClean: true };
  readonly reliability = 0.95; // the retailer's own inventory page

  constructor(private readonly browser: CatalogBrowser) {}

  async observe(spec: Spec<unknown>): Promise<Candidate<RamCandidateData>[]> {
    const fields = spec.fields as RamSpecFields;
    // These are desktop categories — a SODIMM request gets nothing from here.
    if (fields.constraints?.formFactor === "sodimm") return [];
    const pages = CATALOG_PAGES[fields.generation];
    console.log(`[catalog] browsing ${pages.length} retailer category page(s) for ${fields.generation}`);

    const batches = await Promise.all(
      pages.map(async (pageUrl) => {
        const host = new URL(pageUrl).hostname.replace(/^www\./, "");
        const rows = await this.browser.browse(pageUrl, EXTRACT_CARDS_JS);
        console.log(`[catalog] ${host}: ${rows.length} product card(s)`);
        const out: Candidate<RamCandidateData>[] = [];
        for (const row of rows) {
          const i = row.indexOf("|");
          if (i <= 0) continue;
          const url = row.slice(0, i);
          const title = row.slice(i + 1);
          const parsed = parseRamAttributes(title);
          if (parsed) {
            const why = contradictsSpec(parsed.attributes, fields);
            if (why) { console.log(`[catalog] skip (${why}): "${title}"`); continue; }
          } else if (!new RegExp(`\\b${fields.capacityGb}\\s*gb\\b`, "i").test(title)) {
            continue; // unparsed and doesn't even name the capacity
          }
          out.push({
            key: url,
            source: this.name,
            data: {
              productId: url,
              title,
              url,
              attributes: parsed?.attributes ?? ({} as RamAttributes),
              priceAud: NaN,
              ...(parsed?.brand ? { brand: parsed.brand } : {}),
              retailer: host,
            },
            relevance: parsed ? 0.9 : 0.7,
          });
        }
        return out;
      }),
    );

    const seen = new Set<string>();
    const all = batches.flat().filter((c) => !seen.has(c.key) && seen.add(c.key));
    console.log(`[catalog] ${all.length} candidate(s) across retailers`);
    return all;
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
}
