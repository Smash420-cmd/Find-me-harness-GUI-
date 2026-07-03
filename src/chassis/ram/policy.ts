/**
 * RAM policy filter (Task 4b content for this chassis). The constraint
 * vocabulary is domain-specific (the engine applies it uniformly without knowing
 * the words). Runs after verify, before rank — only ever filters real, verified
 * kits (Spec 002 §4).
 */
import type { Spec, VerifiedResult } from "../../types/index.js";
import type { RamCandidateData, RamSpecFields } from "./types.js";
import { contradictsSpec } from "./verify.js";

/** Constraint predicate shared by the verified-result policy gate (ramPolicy)
 *  and the fast-scan candidate filter (server.ts /api/scan) — both need the
 *  same brand/form-factor/budget rules, checked before the (expensive) proof shot. */
export function matchesConstraints(c: RamCandidateData, fields: RamSpecFields): boolean {
  const { budgetAud, constraints } = fields;

  if (budgetAud !== undefined && c.priceAud > budgetAud) return false;

  // SKU attributes (generation/capacity/kit/speed): a KNOWN contradiction is a
  // hard drop; absence passes here and is re-checked after the live read fills
  // attributes in (streamCandidates) or by the strict verify tiers (the loop).
  if (contradictsSpec(c.attributes, fields) !== null) return false;

  // Form factor: default desktop (dimm) — drop SODIMMs unless explicitly requested.
  const requestedForm = constraints?.formFactor ?? "dimm";
  const candidateForm = c.attributes.formFactor ?? "dimm";
  if (candidateForm !== requestedForm) return false;

  if (!constraints) return true;

  if (constraints.lowProfileOnly && !c.lowProfile) return false;
  if (constraints.excludeGreyImport && c.greyImport) return false;
  if (constraints.singleRankOnly && c.rank !== "single") return false;
  // Brand: match against the WHOLE title, punctuation-stripped — "G.Skill" vs
  // "gskill", "Team Group T-Force" vs "teamgroup". First-token brand parses are
  // garbage ("32GB DDR4 Crucial…" → "32gb"), so never rely on c.brand alone.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hay = norm(`${c.brand ?? ""} ${c.title}`);
  if (constraints.brandExclude?.some(b => hay.includes(norm(b)))) return false;
  if (constraints.brandInclude && !constraints.brandInclude.some(b => hay.includes(norm(b)))) return false;

  return true;
}

export function ramPolicy(
  result: VerifiedResult<RamCandidateData>,
  spec: Spec<RamSpecFields>,
): boolean {
  return matchesConstraints(result.candidate.data, spec.fields);
}
