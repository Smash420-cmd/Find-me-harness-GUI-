/**
 * RAM SKU identity — the "is this the same product?" logic for Search 2.
 *
 * This is domain meaning (Law 7) and belongs in the chassis, not the GUI where
 * it grew up. The ladder, strongest evidence first:
 *   1. part-number containment — F4-3600C18D-32GVK is globally unique; stores
 *      mangle punctuation, so compare alphanumeric-normalised.
 *   2. brand + product-line tokens — "gskill"+"trident"+"rgb" separates a
 *      Trident Z RGB from a spec-identical Ripjaws V when the title has no MPN.
 *   3. (page body) — the MPN is often in the specs table / meta / JSON-LD even
 *      when the title omits it; one extra GET before giving up, because
 *      rejecting outright could hide the genuinely cheapest listing.
 * Attributes-alone is NOT identity here — that's the pseudo-spec contradiction
 * gate, which is a different question ("right kind of thing") from identity
 * ("this exact product").
 */
import { extractPartNumber, parseRamAttributes } from "./sources/parse.js";
import type { RamSpecFields } from "./types.js";

export interface SkuIdentity {
  readonly part?: string;
  readonly tokens: string[];
}

const SKU_STOPWORDS = new Set([
  "ram", "memory", "desktop", "gaming", "kit", "series", "module", "dual",
  "channel", "pin", "dimm", "udimm", "sodimm", "black", "white", "grey",
  "gray", "red", "silver", "for", "and", "with", "edition",
]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Extract the identity signature of a chosen product from its title. */
export function skuIdentityOf(title: string): SkuIdentity {
  const part = extractPartNumber(title);
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !/\d/.test(w) && !SKU_STOPWORDS.has(w));
  return { ...(part ? { part } : {}), tokens };
}

/** Tiers 1–2: does the page TITLE prove it's this product? part | line | null. */
export function identityMatches(id: SkuIdentity, pageTitle: string): "part" | "line" | null {
  const n = norm(pageTitle);
  if (id.part && n.includes(norm(id.part))) return "part";
  if (id.tokens.length > 0 && id.tokens.every((t) => n.includes(t))) return "line";
  return null;
}

/** Tier 3: the title failed — is the part number in the page BODY? One GET,
 * only for title mismatches. `getText` is injected (the chassis stays testable;
 * the caller passes its fetch). */
export async function identityInBody(
  id: SkuIdentity,
  url: string,
  getText: (url: string) => Promise<string>,
): Promise<boolean> {
  if (!id.part) return false;
  const html = await getText(url).catch(() => "");
  return norm(html).includes(norm(id.part));
}

/** Derive an identity gate (pseudo-spec) from a chosen card's title, so
 * "find best price for THIS" runs the same contradictsSpec / unconfirmable-SKU
 * gates the scan uses. Undefined when the title doesn't parse as RAM. */
export function pseudoSpecFromTitle(title: string): RamSpecFields | undefined {
  const parsed = parseRamAttributes(title);
  if (!parsed) return undefined;
  const a = parsed.attributes;
  return {
    generation: a.generation,
    capacityGb: a.capacityGb,
    ...(a.kitCount !== undefined ? { kitCount: a.kitCount } : {}),
    ...(a.perStickGb !== undefined ? { perStickGb: a.perStickGb } : {}),
    ...(a.dataRateMtps !== undefined ? { dataRateMtps: a.dataRateMtps } : {}),
    ...(a.formFactor === "sodimm" ? { constraints: { formFactor: "sodimm" as const } } : {}),
  };
}
