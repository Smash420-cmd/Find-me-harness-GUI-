/**
 * THE VERIFICATION CORE — the trust floor (Constitution Laws 1, 3, 8).
 * Human-PR only (see ./.claude.md). This module ROUTES tiers and GATES on proof;
 * it never contains a domain rule. The chassis supplies what each tier checks.
 *
 * Routing (cheapest-first 0→3):
 *   - tier returns ok:false  → checked & INVALID → the candidate is a ghost → DROP.
 *   - tier THROWS            → could not check (infra) → DEGRADE (flag), keep going.
 *   - tier returns ok:true   → satisfied; proof-bearing tiers may carry a ProofShot.
 *
 * Gate (Law 1): the candidate is emitted only if SOME satisfied tier produced a
 * ProofShot. The highest-tier proof wins. If a higher proof-bearing tier failed
 * and we fell back to a lower proof, the score is reduced — a degraded
 * verification is allowed, a *silent* pass is not. No proof at all ⇒ dropped.
 */
import {
  VerificationTier,
  type Candidate,
  type Sandbox,
  type SandboxContext,
  type TierRule,
  type VerificationOutcome,
} from "../../types/index.js";
import { SandboxViolationError } from "../errors/index.js";

export interface VerifyDeps {
  readonly sandbox: Sandbox;
}

/** Penalty applied to the surviving proof's score when a higher tier degraded. */
const DEGRADE_FACTOR = 0.6;

export async function verifyCandidate<TData>(
  candidate: Candidate<TData>,
  rules: ReadonlyArray<TierRule<TData>>,
  deps: VerifyDeps,
): Promise<VerificationOutcome<TData>> {
  const ordered = [...rules].sort((a, b) => a.tier - b.tier);
  const env = { sandbox: deps.sandbox };

  let best: { tier: VerificationTier; score: number; proofIndex: number } | undefined;
  const proofs: { tier: VerificationTier; ref: import("../../types/index.js").ProofShot }[] = [];
  let degradedAboveBest = false;
  const failedProofTiers: VerificationTier[] = [];

  for (const rule of ordered) {
    let evaluation;
    try {
      evaluation = await rule.evaluate(candidate, env);
    } catch {
      // Could not check this tier (e.g. capture timed out). Degrade, don't drop.
      if (rule.proofBearing) failedProofTiers.push(rule.tier);
      continue;
    }

    if (!evaluation.ok) {
      // Checked and INVALID — wrong thing or not real. This is a ghost. Drop now.
      return { kind: "dropped", candidate, reason: evaluation.reason };
    }

    if (rule.proofBearing && evaluation.proof) {
      const proofIndex = proofs.push({ tier: rule.tier, ref: evaluation.proof }) - 1;
      if (!best || rule.tier > best.tier) {
        best = { tier: rule.tier, score: evaluation.score, proofIndex };
      }
    }
  }

  // Proof-shot gate (Law 1): no proof ⇒ no card.
  if (!best) {
    return {
      kind: "dropped",
      candidate,
      reason: "no proof-shot: no tier could prove the candidate is real and correct",
    };
  }

  // Did a HIGHER proof-bearing tier fail, forcing us down to this proof? → flag.
  degradedAboveBest = failedProofTiers.some((t) => t > best!.tier);
  const score = degradedAboveBest ? best.score * DEGRADE_FACTOR : best.score;

  return {
    kind: "verified",
    candidate,
    proof: proofs[best.proofIndex]!.ref,
    verificationScore: score,
  };
}

/**
 * An isolated, ephemeral render context (Plan B.4). Each `run` gets a fresh,
 * private store; on completion the store is wiped and the context frozen, so a
 * smuggled reference can neither read nor write afterward — a render cannot
 * touch anything outside its own ephemeral context.
 */
export class EphemeralSandbox implements Sandbox {
  async run<T>(work: (ctx: SandboxContext) => Promise<T>): Promise<T> {
    const store = new Map<string, unknown>();
    let live = true;
    const ctx: SandboxContext = {
      set(key, value) {
        if (!live) throw new SandboxViolationError("write after teardown");
        store.set(key, value);
      },
      get(key) {
        if (!live) throw new SandboxViolationError("read after teardown");
        return store.get(key);
      },
    };
    try {
      return await work(ctx);
    } finally {
      store.clear(); // nothing survives the render
      live = false; // the context is dead; any later use throws
    }
  }
}
