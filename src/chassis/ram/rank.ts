/**
 * RAM ranking (Task 7): lowest verified price among genuinely available kits.
 * Runs over verified, policy-filtered survivors only. No multi-factor build
 * score — that is a build-platform concern, out of scope (Spec 002 §3).
 */
import type { VerifiedResult } from "../../types/index.js";
import type { RamCandidateData } from "./types.js";

export function rankByPrice(
  verified: VerifiedResult<RamCandidateData>[],
): VerifiedResult<RamCandidateData>[] {
  return [...verified].sort((a, b) => a.candidate.data.priceAud - b.candidate.data.priceAud);
}
