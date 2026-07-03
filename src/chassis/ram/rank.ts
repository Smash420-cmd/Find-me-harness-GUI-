/**
 * RAM ranking: confidence first, then price-per-GB as tiebreaker.
 * Price-per-GB avoids blindly picking cheap single-stick kits over better-value
 * dual-channel kits at a similar per-GB cost.
 */
import type { VerifiedResult } from "../../types/index.js";
import type { RamCandidateData } from "./types.js";

function pricePerGb(r: VerifiedResult<RamCandidateData>): number {
  return r.candidate.data.priceAud / r.candidate.data.attributes.capacityGb;
}

export function rankByPrice(
  verified: VerifiedResult<RamCandidateData>[],
): VerifiedResult<RamCandidateData>[] {
  return [...verified].sort((a, b) => {
    const confDiff = b.confidence.overall - a.confidence.overall;
    if (Math.abs(confDiff) > 0.02) return confDiff;
    return pricePerGb(a) - pricePerGb(b);
  });
}
