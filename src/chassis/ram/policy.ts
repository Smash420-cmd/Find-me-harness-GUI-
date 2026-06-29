/**
 * RAM policy filter (Task 4b content for this chassis). The constraint
 * vocabulary is domain-specific (the engine applies it uniformly without knowing
 * the words). Runs after verify, before rank — only ever filters real, verified
 * kits (Spec 002 §4).
 */
import type { Spec, VerifiedResult } from "../../types/index.js";
import type { RamCandidateData, RamSpecFields } from "./types.js";

export function ramPolicy(
  result: VerifiedResult<RamCandidateData>,
  spec: Spec<RamSpecFields>,
): boolean {
  const c = result.candidate.data;
  const { budgetAud, constraints } = spec.fields;

  if (budgetAud !== undefined && c.priceAud > budgetAud) return false;
  if (!constraints) return true;

  if (constraints.lowProfileOnly && !c.lowProfile) return false;
  if (constraints.excludeGreyImport && c.greyImport) return false;
  if (constraints.singleRankOnly && c.rank !== "single") return false;
  if (constraints.brandExclude && c.brand && constraints.brandExclude.includes(c.brand)) return false;
  if (constraints.brandInclude && (!c.brand || !constraints.brandInclude.includes(c.brand))) return false;

  return true;
}
