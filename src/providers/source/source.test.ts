import { describe, it, expect } from "vitest";
import { tiersForCapabilities, routeRules, BaseSourceProvider } from "./base.js";
import {
  VerificationTier,
  type Candidate,
  type SourceCapabilities,
  type Spec,
  type TierRule,
} from "../../types/index.js";

const rule = (tier: VerificationTier): TierRule<unknown> => ({
  tier,
  proofBearing: tier === VerificationTier.Vision,
  evaluate: async () => ({ ok: true, score: 1 }),
});

describe("Task 6 — source base + capability matrix", () => {
  it("maps declared capabilities to available tiers", () => {
    const full: SourceCapabilities = { hasApi: true, hasStockFlag: true, rendersClean: true };
    expect(tiersForCapabilities(full)).toEqual([
      VerificationTier.Cache,
      VerificationTier.Api,
      VerificationTier.Dom,
      VerificationTier.Vision,
    ]);
  });

  it("hasApi:false ⇒ Tier 1 (API) is skipped", () => {
    const caps: SourceCapabilities = { hasApi: false, hasStockFlag: true, rendersClean: true };
    const tiers = tiersForCapabilities(caps);
    expect(tiers).not.toContain(VerificationTier.Api);
    expect(tiers).toContain(VerificationTier.Dom);
    expect(tiers).toContain(VerificationTier.Vision);
  });

  it("routeRules drops rules for tiers the source cannot serve", () => {
    const caps: SourceCapabilities = { hasApi: false, hasStockFlag: true, rendersClean: true };
    const all = [
      rule(VerificationTier.Cache),
      rule(VerificationTier.Api), // should be dropped
      rule(VerificationTier.Dom),
      rule(VerificationTier.Vision),
    ];
    const routed = routeRules(all, caps).map((r) => r.tier);
    expect(routed).toEqual([VerificationTier.Cache, VerificationTier.Dom, VerificationTier.Vision]);
  });

  it("a concrete source via BaseSourceProvider reports its available tiers", async () => {
    class Demo extends BaseSourceProvider<{ id: string }> {
      readonly name = "demo";
      readonly capabilities: SourceCapabilities = { hasApi: false, hasStockFlag: true, rendersClean: false };
      async observe(_spec: Spec<unknown>): Promise<Candidate<{ id: string }>[]> {
        return [{ key: "x", source: "demo", data: { id: "x" } }];
      }
      async read(_c: Candidate<{ id: string }>) {
        return {};
      }
    }
    const d = new Demo();
    expect(d.availableTiers()).toEqual([VerificationTier.Cache, VerificationTier.Dom]);
    expect((await d.observe({ fields: {} }))[0]!.key).toBe("x");
  });
});
