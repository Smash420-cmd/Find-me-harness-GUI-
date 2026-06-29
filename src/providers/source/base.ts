/**
 * Source base + capability-matrix routing (Task 6, Plan B.2).
 *
 * A source DECLARES what it exposes; the engine routes verification only to the
 * tiers that declaration supports. This is what makes sources pluggable rather
 * than hardcoded: a new source is "declare your capabilities", not "rewrite the
 * loop". The chassis supplies tier RULES; the capability matrix decides which of
 * those tiers are even AVAILABLE for a given source.
 */
import {
  VerificationTier,
  type Candidate,
  type ISourceProvider,
  type SourceCapabilities,
  type Spec,
  type TierRule,
} from "../../types/index.js";

/** Which tiers a source's declared capabilities make available. */
export function tiersForCapabilities(caps: SourceCapabilities): VerificationTier[] {
  const tiers: VerificationTier[] = [VerificationTier.Cache]; // a fact-cache is always usable
  if (caps.hasApi) tiers.push(VerificationTier.Api);
  if (caps.hasStockFlag) tiers.push(VerificationTier.Dom);
  if (caps.rendersClean) tiers.push(VerificationTier.Vision);
  return tiers;
}

/**
 * Drop any chassis-supplied tier rule whose tier this source cannot serve.
 * The engine calls this before verification so an API rule never runs against a
 * source that declared `hasApi:false`.
 */
export function routeRules<TData>(
  rules: ReadonlyArray<TierRule<TData>>,
  caps: SourceCapabilities,
): TierRule<TData>[] {
  const available = new Set(tiersForCapabilities(caps));
  return rules.filter((r) => available.has(r.tier));
}

/** Optional convenience base for concrete sources. */
export abstract class BaseSourceProvider<TData> implements ISourceProvider<TData> {
  abstract readonly name: string;
  abstract readonly capabilities: SourceCapabilities;
  readonly reliability: number = 0.9;

  abstract observe(spec: Spec<unknown>): Promise<Candidate<TData>[]>;
  abstract read(candidate: Candidate<TData>): Promise<unknown>;

  /** The tiers this source can serve, from its declared capabilities. */
  availableTiers(): VerificationTier[] {
    return tiersForCapabilities(this.capabilities);
  }
}
