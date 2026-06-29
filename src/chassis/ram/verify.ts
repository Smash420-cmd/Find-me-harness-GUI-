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
 *   Tier 2 DOM    — live read: confirm SKU + availability; emit a degraded
 *                   DOM-snapshot proof (lower score).
 *   Tier 3 Vision — capture the proof-shot (kit + price + in-stock). Full score.
 *   If Tier 3 capture fails, the engine falls back to the Tier-2 proof and flags
 *   confidence (never a silent pass); if neither proves it, the candidate drops.
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
  /** Live DOM read (Tier 2). Always called — liveness never comes from cache. */
  readonly readLive: (candidate: Candidate<RamCandidateData>) => Promise<RamLiveState>;
  /** Tier-3 capture inside the sandbox → the proof-shot (Playwright in v1). */
  readonly captureProof: (candidate: Candidate<RamCandidateData>, env: TierEnv) => Promise<ProofShot>;
}

/** Correct-SKU rule: does the live listing match what the user asked for? */
export function matchesSpec(attrs: RamAttributes, spec: RamSpecFields): true | string {
  if (attrs.generation !== spec.generation) return `generation ${attrs.generation} ≠ ${spec.generation}`;
  if (attrs.capacityGb !== spec.capacityGb) return `capacity ${attrs.capacityGb}GB ≠ ${spec.capacityGb}GB`;
  if (attrs.dataRateMtps !== spec.dataRateMtps) return `speed ${attrs.dataRateMtps} ≠ ${spec.dataRateMtps}`;
  if (spec.kitCount !== undefined && attrs.kitCount !== spec.kitCount) return `kit ${attrs.kitCount} ≠ ${spec.kitCount}`;
  if (spec.perStickGb !== undefined && attrs.perStickGb !== spec.perStickGb)
    return `per-stick ${attrs.perStickGb}GB ≠ ${spec.perStickGb}GB`;
  // CAS: a tighter (lower) latency than requested is acceptable; looser is not.
  if (spec.casLatency !== undefined && attrs.casLatency !== undefined && attrs.casLatency > spec.casLatency)
    return `CAS ${attrs.casLatency} looser than requested ${spec.casLatency}`;
  return true;
}

const DOM_PROOF_SCORE = 0.7; // degraded proof — weaker than the vision capture
const VISION_PROOF_SCORE = 1.0;

export function ramTierRules(
  candidate: Candidate<RamCandidateData>,
  spec: Spec<RamSpecFields>,
  deps: RamVerifyDeps,
): TierRule<RamCandidateData>[] {
  // Tier 2 — DOM: live correctness + availability; degraded proof.
  const dom: TierRule<RamCandidateData> = {
    tier: VerificationTier.Dom,
    proofBearing: true,
    evaluate: async (c) => {
      const live = await deps.readLive(c); // liveness — every time (Law 2)
      const correct = matchesSpec(live.attributes, spec.fields);
      if (correct !== true) return { ok: false, reason: `wrong SKU: ${correct}` };
      if (live.availability === "out_of_stock") return { ok: false, reason: "sold out" };
      const proof: ProofShot = {
        tier: VerificationTier.Dom,
        artifactRef: `dom:${c.key}`,
        capturedAt: Date.now(),
        shows: `DOM: ${c.data.title} @ $${live.priceAud} in stock`,
      };
      return { ok: true, proof, score: DOM_PROOF_SCORE };
    },
  };

  // Tier 3 — Vision: capture the user-facing proof-shot. Throws ⇒ engine degrades.
  const vision: TierRule<RamCandidateData> = {
    tier: VerificationTier.Vision,
    proofBearing: true,
    evaluate: async (c, env) => {
      const proof = await deps.captureProof(c, env); // sandboxed capture
      return { ok: true, proof, score: VISION_PROOF_SCORE };
    },
  };

  return [dom, vision];
}
