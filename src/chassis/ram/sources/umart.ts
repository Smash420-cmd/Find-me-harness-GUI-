/**
 * The Umart source (Task 8) — the single v1 retailer. Declares its capability
 * matrix { hasApi:false, hasStockFlag:true, rendersClean:true } so the engine
 * routes verification to the Tier 2 (DOM) and Tier 3 (Vision) it can serve.
 * All knowledge of Umart's URLs/markup is confined to this folder (Law 7).
 *
 *   observe → category page for the generation → candidate identities, attributes
 *             parsed from slugs, filtered to those matching the spec; top-K
 *             enriched with live price by reading their product page.
 *   read    → product page → live price + availability (liveness, re-read every
 *             time — never cached, Law 2).
 */
import type { Candidate, ISourceProvider, Spec, SourceCapabilities } from "../../../types/index.js";
import type { ExtractSpec } from "../../../providers/index.js";
import { fetchText } from "../../../providers/net.js";
import { matchesSpec } from "../verify.js";
import type { RamCandidateData, RamLiveState, RamSpecFields } from "../types.js";
import {
  availabilityFromHref,
  cleanTitle,
  parseListing,
  parseProductPage,
  parseRamAttributes,
  priceFromContent,
} from "./parse.js";

const ORIGIN = "https://www.umart.com.au";

/**
 * Selectors the Tier-3 render reads off the page — the SAME DOM it screenshots
 * (F1). Umart microdata: price `content`, availability `href`, the page title.
 * The validator returns these as raw strings; `interpretUmartFields` gives them
 * meaning here in the domain folder (Law 7).
 */
export const UMART_RENDER_SELECTORS: Record<string, ExtractSpec> = {
  priceContent: { selector: 'span[itemprop="price"]', attr: "content" },
  availabilityHref: { selector: 'link[itemprop="availability"]', attr: "href" },
  title: { selector: "title" },
};

/** Interpret the rendered field strings into a live state, using the SAME
 * in-stock + price predicates as the Node-fetch read (so they agree by
 * construction). Falls back to the candidate's known data only when a field is
 * unreadable. */
export function interpretUmartFields(
  fields: Record<string, string | null>,
  candidate: Candidate<RamCandidateData>,
): RamLiveState {
  const priceRaw = priceFromContent(fields.priceContent ?? null);
  const parsed = parseRamAttributes(cleanTitle(fields.title ?? null));
  return {
    availability: availabilityFromHref(fields.availabilityHref ?? null),
    priceAud: Number.isFinite(priceRaw) ? priceRaw : candidate.data.priceAud,
    attributes: parsed?.attributes ?? candidate.data.attributes,
  };
}

/** The proof-shot caption. Built from the RENDER-read live state, never the
 * observe-time price, so the caption on the trust artifact cannot disagree with
 * the screenshot it sits on (F1 re-review). */
export function umartProofCaption(title: string, live: RamLiveState): string {
  return `${title} @ $${live.priceAud} in stock`;
}

/** Category pages per generation (discovered from the live nav). */
const CATEGORY: Record<RamSpecFields["generation"], string> = {
  DDR5: `${ORIGIN}/pc-parts/computer-parts/memory-ram/ddr5-ram-1085`,
  DDR4: `${ORIGIN}/pc-parts/computer-parts/memory-ram/ddr4-ram-659`,
};

export interface UmartSourceOptions {
  /** Max product pages to enrich per observe (cost control). */
  readonly maxCandidates?: number;
  /** Injected fetcher (tests). Defaults to the proxy-aware fetchText. */
  readonly fetchText?: (url: string) => Promise<string>;
}

export class UmartSource implements ISourceProvider<RamCandidateData> {
  readonly name = "umart";
  readonly capabilities: SourceCapabilities = { hasApi: false, hasStockFlag: true, rendersClean: true };
  readonly reliability = 0.95;

  private readonly maxCandidates: number;
  private readonly get: (url: string) => Promise<string>;

  constructor(opts: UmartSourceOptions = {}) {
    this.maxCandidates = opts.maxCandidates ?? 10;
    this.get = opts.fetchText ?? fetchText;
  }

  async observe(spec: Spec<unknown>): Promise<Candidate<RamCandidateData>[]> {
    const fields = spec.fields as RamSpecFields;
    const listingHtml = await this.get(CATEGORY[fields.generation]);
    const items = parseListing(listingHtml, ORIGIN);

    // Cheap pre-filter from slug attributes — only enrich kits that match the spec.
    const matching = items
      .map((it) => ({ it, parsed: parseRamAttributes(it.slug) }))
      .filter((x): x is { it: typeof items[number]; parsed: NonNullable<ReturnType<typeof parseRamAttributes>> } =>
        x.parsed !== null && matchesSpec(x.parsed.attributes, fields) === true,
      )
      .slice(0, this.maxCandidates);

    const candidates: Candidate<RamCandidateData>[] = [];
    for (const { it, parsed } of matching) {
      try {
        const read = parseProductPage(await this.get(it.url));
        if (!Number.isFinite(read.priceAud)) continue; // no price ⇒ skip
        const data: RamCandidateData = {
          productId: it.productId,
          title: read.title || it.slug,
          url: it.url,
          attributes: read.parsed?.attributes ?? parsed.attributes,
          priceAud: read.priceAud,
          ...(parsed.brand ? { brand: parsed.brand } : {}),
        };
        candidates.push({ key: it.productId, source: this.name, data, relevance: 1 });
      } catch {
        // a single product fetch failing doesn't sink the observe pass.
      }
    }
    return candidates;
  }

  /** Live read for verification — fetched fresh every time (Law 2). */
  async read(candidate: Candidate<RamCandidateData>): Promise<RamLiveState> {
    const read = parseProductPage(await this.get(candidate.data.url));
    return {
      availability: read.availability,
      priceAud: Number.isFinite(read.priceAud) ? read.priceAud : candidate.data.priceAud,
      attributes: read.parsed?.attributes ?? candidate.data.attributes,
    };
  }
}
