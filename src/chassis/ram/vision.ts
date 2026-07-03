/**
 * Vision → RAM interpretation (Law 7: the chassis owns meaning). Bridges the
 * domain-free ProofReading into a RamLiveState, the same shape interpretUmartFields
 * produces from regex fields — so the loop's captureProof can swap the flaky
 * per-site regex reader for the vision reader without the engine noticing.
 *
 * Fail-closed by design (this feeds the trust floor): anything the reader could
 * not confirm as a buyable product in stock becomes out_of_stock. A price of 0
 * is a parse artifact, never a price (the $0 header-cart lesson, again).
 */
import type { ProofReading } from "../../providers/index.js";
import type { Candidate } from "../../types/index.js";
import { parseRamAttributes } from "./sources/parse.js";
import type { RamCandidateData, RamLiveState } from "./types.js";

export function interpretVisionReading(
  reading: ProofReading,
  candidate: Candidate<RamCandidateData>,
): RamLiveState {
  // Only a genuine product page that the reader confirms in stock counts as
  // buyable now. category/search/error/blocked pages, preorder, and unknown all
  // fail closed — the render is the last gate, and vision is thorough.
  const availability: RamLiveState["availability"] =
    reading.pageType === "product" && reading.available === "in_stock" ? "in_stock" : "out_of_stock";

  const priceAud =
    reading.price !== null && reading.price > 0 ? reading.price : candidate.data.priceAud;

  const parsed = reading.title ? parseRamAttributes(reading.title) : null;

  return {
    availability,
    priceAud,
    attributes: parsed?.attributes ?? candidate.data.attributes,
    ...(reading.title ? { title: reading.title } : {}),
  };
}
