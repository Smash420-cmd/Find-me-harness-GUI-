/**
 * Task 3 — Verification core. TEST-FIRST (Constitution Law 8): these claims are
 * written before the implementation and are the trust floor (Law 3, human-gated).
 *
 * Claims under test:
 *   E1  no proof-shot ⇒ no card
 *       ghost is dropped (checked-and-invalid → dropped)
 *       tier-3 fail ⇒ fall back to tier-2 + flag confidence, never silent pass
 *       a render cannot read/write outside its ephemeral context (sandbox escape)
 */
import { describe, it, expect } from "vitest";
import { verifyCandidate, EphemeralSandbox } from "./index.js";
import { VerificationTier, type Candidate, type TierRule, type ProofShot } from "../../types/index.js";
import { SandboxViolationError } from "../errors/index.js";

const candidate: Candidate<{ label: string }> = {
  key: "c1",
  source: "test",
  data: { label: "thing" },
};

function proof(tier: VerificationTier, shows: string): ProofShot {
  return { tier, artifactRef: `art-${tier}`, capturedAt: Date.now(), shows };
}

// ── Helpers to build synthetic, domain-free tier rules ───────────────────────
type Rule = TierRule<{ label: string }>;

const cacheIdentity = (): Rule => ({
  tier: VerificationTier.Cache,
  proofBearing: false,
  evaluate: async () => ({ ok: true, score: 1 }), // a recalled *fact*, no proof
});

const visionProof = (score = 1): Rule => ({
  tier: VerificationTier.Vision,
  proofBearing: true,
  evaluate: async (_c, env) =>
    env.sandbox.run(async () => ({ ok: true, proof: proof(VerificationTier.Vision, "kit+price+instock"), score })),
});

const visionTimesOut = (): Rule => ({
  tier: VerificationTier.Vision,
  proofBearing: true,
  evaluate: async () => {
    throw new Error("capture timed out"); // infra failure → degrade, not drop
  },
});

const domProof = (score = 0.8): Rule => ({
  tier: VerificationTier.Dom,
  proofBearing: true,
  evaluate: async (_c, env) =>
    env.sandbox.run(async () => ({ ok: true, proof: proof(VerificationTier.Dom, "dom snapshot"), score })),
});

const domSoldOut = (): Rule => ({
  tier: VerificationTier.Dom,
  proofBearing: false,
  evaluate: async () => ({ ok: false, reason: "sold out" }), // checked & invalid → ghost
});

const deps = () => ({ sandbox: new EphemeralSandbox() });

describe("Task 3 — verification core (the trust floor)", () => {
  it("E1: a candidate with no proof-bearing tier is DROPPED (no proof ⇒ no card)", async () => {
    const out = await verifyCandidate(candidate, [cacheIdentity()], deps());
    expect(out.kind).toBe("dropped");
  });

  it("a satisfied proof-bearing tier yields a VERIFIED result carrying its proof", async () => {
    const out = await verifyCandidate(candidate, [cacheIdentity(), visionProof()], deps());
    expect(out.kind).toBe("verified");
    if (out.kind === "verified") {
      expect(out.proof.tier).toBe(VerificationTier.Vision);
      expect(out.verificationScore).toBe(1);
    }
  });

  it("ghost: a tier that checks and finds it INVALID drops the candidate", async () => {
    const out = await verifyCandidate(candidate, [domSoldOut(), visionProof()], deps());
    expect(out.kind).toBe("dropped");
    if (out.kind === "dropped") expect(out.reason).toContain("sold out");
  });

  it("degradation: tier-3 fails ⇒ fall back to tier-2 proof + FLAG (lower) score, never silent pass", async () => {
    const full = await verifyCandidate(candidate, [domProof(0.8), visionProof(1)], deps());
    const degraded = await verifyCandidate(candidate, [domProof(0.8), visionTimesOut()], deps());

    expect(full.kind).toBe("verified");
    expect(degraded.kind).toBe("verified"); // still a card — tier-2 proof exists
    if (full.kind === "verified" && degraded.kind === "verified") {
      // fell back to the DOM proof, not the vision proof
      expect(degraded.proof.tier).toBe(VerificationTier.Dom);
      // and it is NOT passed off at full confidence — strictly lower than the undegraded run
      expect(degraded.verificationScore).toBeLessThan(full.verificationScore);
      // F2: pin DEGRADE_FACTOR so it can't drift — 0.8 (tier-2 score) × 0.6 = 0.48.
      expect(degraded.verificationScore).toBeCloseTo(0.48, 5);
    }
  });

  it("proof-shot law still holds under degradation: tier-3 fails AND no other proof ⇒ DROPPED", async () => {
    const out = await verifyCandidate(candidate, [cacheIdentity(), visionTimesOut()], deps());
    expect(out.kind).toBe("dropped"); // no tier could produce the proof
  });

  describe("ephemeral sandbox (Plan B.4)", () => {
    it("a render cannot read or write outside its ephemeral context (after teardown)", async () => {
      const sandbox = new EphemeralSandbox();
      let leaked: { set: (k: string, v: unknown) => void } | undefined;
      await sandbox.run(async (ctx) => {
        ctx.set("x", 1);
        expect(ctx.get("x")).toBe(1);
        leaked = ctx; // try to smuggle the context out
        return null;
      });
      // The smuggled context is dead after teardown — no read or write escapes.
      expect(() => leaked!.set("y", 2)).toThrow(SandboxViolationError);
    });

    it("two runs never share state (isolation)", async () => {
      const sandbox = new EphemeralSandbox();
      await sandbox.run(async (ctx) => {
        ctx.set("secret", 42);
        return null;
      });
      const seen = await sandbox.run(async (ctx) => ctx.get("secret"));
      expect(seen).toBeUndefined();
    });
  });
});
