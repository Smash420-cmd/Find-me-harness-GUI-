/**
 * RAM verification contract (Task 7) — the RULES the engine's tiers apply.
 * The engine routes cheapest-first and gates on proof; this file only supplies
 * what each tier CHECKS for RAM. Domain words live here (Law 7).
 *
 *   Correct (right SKU): attributes match the spec → else ghost dropped.
 *   Real (live in-stock): the listing is buyable now → else ghost dropped (R4).
 *   Liveness is re-read every time; the cache holds only the SKU identity (Law 2).
 *
 * Tiers (Umart has no API → Tier 1 skipped by the capability matrix):
 *   Tier 2 DOM    — CHEAP PRE-FILTER (Node-fetch read): confirm SKU + availability
 *                   to drop obvious mismatches without rendering; emit a degraded
 *                   DOM-snapshot proof (lower score).
 *   Tier 3 Vision — AUTHORITATIVE CONFIRMATION on the rendered DOM (F1): the
 *                   capture reads SKU + in-stock off the SAME render it
 *                   screenshots and RE-CHECKS them; if the render disagrees with
 *                   the pre-filter, the render wins (drop). Full score on pass.
 *   If Tier 3 capture fails (infra), the engine falls back to the Tier-2 proof
 *   and flags confidence (never a silent pass); if neither proves it, it drops.
 */
import {
  VerificationTier,
  type Candidate,
  type ProofShot,
  type Spec,
  type TierEnv,
  type TierRule,
} from "../../types/index.js";
import type { RamAttributes, RamCandidateData, RamLiveState, RamSpecFields } from "./types.js";

export interface RamVerifyDeps {
  /** Tier-2 cheap pre-filter read (Node fetch). Always called — never cached (Law 2). */
  readonly readLive: (candidate: Candidate<RamCandidateData>) => Promise<RamLiveState>;
  /**
   * Tier-3 capture inside the sandbox. Returns the proof-shot AND the live state
   * read off the SAME render (F1), so the in-stock + SKU decision is confirmed on
   * exactly the DOM the proof shows. Throws ⇒ engine degrades to the Tier-2 proof.
   */
  readonly captureProof: (
    candidate: Candidate<RamCandidateData>,
    env: TierEnv,
  ) => Promise<{ proof: ProofShot; live: RamLiveState }>;
}

/** Contradiction-only SKU check for the CHEAP layers (SERP titles, slug parses,
 * HTTP pre-reads) — drops only when an attribute is KNOWN and wrong. Absence
 * passes: a title that omits "(2x16GB)" may still be the right kit, and the
 * verify tiers (which use the strict `matchesSpec`) remain the authority. */
export function contradictsSpec(attrs: Partial<RamAttributes>, spec: RamSpecFields): string | null {
  if (attrs.generation !== undefined && attrs.generation !== spec.generation)
    return `generation ${attrs.generation} ≠ ${spec.generation}`;
  if (attrs.capacityGb !== undefined && attrs.capacityGb !== spec.capacityGb)
    return `capacity ${attrs.capacityGb}GB ≠ ${spec.capacityGb}GB`;
  if (spec.dataRateMtps !== undefined && attrs.dataRateMtps !== undefined && attrs.dataRateMtps !== spec.dataRateMtps)
    return `speed ${attrs.dataRateMtps} ≠ ${spec.dataRateMtps}`;
  if (spec.kitCount !== undefined && attrs.kitCount !== undefined && attrs.kitCount !== spec.kitCount)
    return `kit ${attrs.kitCount} ≠ ${spec.kitCount}`;
  if (spec.perStickGb !== undefined && attrs.perStickGb !== undefined && attrs.perStickGb !== spec.perStickGb)
    return `per-stick ${attrs.perStickGb}GB ≠ ${spec.perStickGb}GB`;
  if (spec.casLatency !== undefined && attrs.casLatency !== undefined && attrs.casLatency > spec.casLatency)
    return `CAS ${attrs.casLatency} looser than requested ${spec.casLatency}`;
  const wantForm = spec.constraints?.formFactor ?? "dimm"; // desktop unless asked otherwise
  if (attrs.formFactor !== undefined && attrs.formFactor !== wantForm)
    return `${attrs.formFactor} ≠ ${wantForm}`;
  return null;
}

/** Correct-SKU rule: does the live listing match what the user asked for? */
export function matchesSpec(attrs: RamAttributes, spec: RamSpecFields): true | string {
  if (attrs.generation !== spec.generation) return `generation ${attrs.generation} ≠ ${spec.generation}`;
  if (attrs.capacityGb !== spec.capacityGb) return `capacity ${attrs.capacityGb}GB ≠ ${spec.capacityGb}GB`;
  if (spec.dataRateMtps !== undefined && attrs.dataRateMtps !== spec.dataRateMtps) return `speed ${attrs.dataRateMtps} ≠ ${spec.dataRateMtps}`;
  if (spec.kitCount !== undefined && attrs.kitCount !== spec.kitCount) return `kit ${attrs.kitCount} ≠ ${spec.kitCount}`;
  if (spec.perStickGb !== undefined && attrs.perStickGb !== spec.perStickGb)
    return `per-stick ${attrs.perStickGb}GB ≠ ${spec.perStickGb}GB`;
  // CAS: a tighter (lower) latency than requested is acceptable; looser is not.
  if (spec.casLatency !== undefined && attrs.casLatency !== undefined && attrs.casLatency > spec.casLatency)
    return `CAS ${attrs.casLatency} looser than requested ${spec.casLatency}`;
  return true;
}

/**
 * The single correct-AND-real predicate, applied identically by both tiers
 * (Tier 2 on the Node-fetch read, Tier 3 on the rendered DOM). Returns a drop
 * reason, or null if the candidate is correct and in stock.
 */
export function disqualify(live: RamLiveState, spec: RamSpecFields): string | null {
  const correct = matchesSpec(live.attributes, spec);
  if (correct !== true) return `wrong SKU: ${correct}`;
  if (live.availability === "out_of_stock") return "sold out";
  return null;
}

const DOM_PROOF_SCORE = 0.7; // degraded proof — weaker than the vision capture
const VISION_PROOF_SCORE = 1.0;

export function ramTierRules(
  candidate: Candidate<RamCandidateData>,
  spec: Spec<RamSpecFields>,
  deps: RamVerifyDeps,
): TierRule<RamCandidateData>[] {
  // Tier 2 — DOM: cheap Node-fetch pre-filter. Drops obvious wrong-SKU / sold-out
  // candidates WITHOUT rendering, so only survivors reach the (costly) Tier-3
  // render. Emits a degraded DOM-snapshot proof used only if the render fails.
  const dom: TierRule<RamCandidateData> = {
    tier: VerificationTier.Dom,
    proofBearing: true,
    evaluate: async (c) => {
      const live = await deps.readLive(c); // liveness — every time (Law 2)
      const reason = disqualify(live, spec.fields);
      if (reason) return { ok: false, reason: `${reason} (pre-filter)` };
      const proof: ProofShot = {
        tier: VerificationTier.Dom,
        artifactRef: `dom:${c.key}`,
        capturedAt: Date.now(),
        shows: `DOM: ${c.data.title} @ $${live.priceAud} in stock`,
      };
      return { ok: true, proof, score: DOM_PROOF_SCORE };
    },
  };

  // Tier 3 — Vision: AUTHORITATIVE. Renders once, reads SKU + in-stock off that
  // same render, and RE-CHECKS them. If the render disagrees with the pre-filter
  // (e.g. it sold out in between, or the page differs), the render wins → drop.
  // Throws (infra failure) ⇒ engine degrades to the Tier-2 proof + flags.
  const vision: TierRule<RamCandidateData> = {
    tier: VerificationTier.Vision,
    proofBearing: true,
    evaluate: async (c, env) => {
      const { proof, live } = await deps.captureProof(c, env); // render = decision = proof
      const reason = disqualify(live, spec.fields);
      if (reason) return { ok: false, reason: `${reason} (on rendered DOM)` };
      return { ok: true, proof, score: VISION_PROOF_SCORE };
    },
  };

  return [dom, vision];
}
