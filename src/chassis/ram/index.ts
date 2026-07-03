/**
 * The RAM chassis — assembles the three mounting-point pieces (spec schema,
 * verify rules, rank) + policy + sources into a Chassis the engine can mount
 * (HARNESSBUILD §A.1). This is the only furnished room.
 */
import type { Chassis, ISourceProvider } from "../../types/index.js";
import { DEFAULT_CONFIDENCE_THRESHOLD } from "../../engine/confidence/index.js";
import { parseRamSpec } from "./spec.js";
import { ramTierRules, type RamVerifyDeps } from "./verify.js";
import { rankByPrice } from "./rank.js";
import { ramPolicy } from "./policy.js";
import type { RamCandidateData, RamSpecFields } from "./types.js";

export interface RamChassisDeps extends RamVerifyDeps {
  /** Pass `sources` for multiple discovery providers (preferred). */
  readonly sources?: ReadonlyArray<ISourceProvider<RamCandidateData>>;
  /** Single-source shorthand — used when only one source is needed. */
  readonly source?: ISourceProvider<RamCandidateData>;
  readonly confidenceThreshold?: number;
}

export function createRamChassis(deps: RamChassisDeps): Chassis<RamSpecFields, RamCandidateData> {
  const allSources = deps.sources ?? (deps.source ? [deps.source] : []);
  return {
    parseSpec: parseRamSpec,
    tierRules: (candidate, spec) => ramTierRules(candidate, spec, deps),
    rank: rankByPrice,
    policy: ramPolicy,
    sources: allSources,
    confidenceThreshold: deps.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
  };
}

/**
 * Convergence context for the conversational door. Tells the model what fields
 * a RAM spec can contain. Domain knowledge — lives in the chassis, never the engine.
 * Changing this string is a logic change (Law 10).
 */
export const RAM_CONV_CONTEXT = `You are helping a user find RAM (computer memory) to buy from an Australian retailer.
Your job is to converge their request into a structured spec via triage questions, then propose it as JSON.

TRIAGE STRATEGY (up to 3 clarifying turns before you must propose):
- First ask about their motherboard or CPU — this tells you DDR generation (DDR4 vs DDR5).
  e.g. "What motherboard do you have?" or "What CPU are you running?"
- Then ask about capacity if still unclear: "How much RAM do you need — 16GB, 32GB?"
- If they truly don't know after your questions, suggest they check their motherboard manual,
  ask someone nearby, or look up their CPU model. Then propose sensible defaults with a warning.

SENSIBLE DEFAULTS (use when triage fails): DDR5, 32GB, 6000 MT/s.

FIELDS you can propose:
  generation: "DDR4" | "DDR5"  (required)
  capacityGb: number            (required, e.g. 16, 32, 64)
  dataRateMtps: number          (optional, e.g. 3200 for DDR4, 6000 for DDR5)
  kitCount: number              (optional, e.g. 2 for a 2-stick kit)
  perStickGb: number            (optional, e.g. 16 for 2x16GB)
  casLatency: number            (optional)
  budgetAud: number             (optional)
  constraints.brandInclude: string[]  (optional)
  constraints.brandExclude: string[]  (optional)

IMPOSSIBLE specs to reject: DDR4 above 5333 MT/s, DDR5 below 4000 MT/s.

ALWAYS reply with exactly ONE JSON object — no prose, no markdown:
  {"action":"propose","fields":{...}}                         when you have enough to go on
  {"action":"propose","fields":{...},"note":"I assumed..."}   when you used defaults
  {"action":"clarify","question":"..."}                       when you need one more piece of info
  {"action":"impossible","reason":"..."}                      when the request is self-contradictory`;

export { parseRamSpec } from "./spec.js";
export { rankByPrice } from "./rank.js";
export { ramPolicy } from "./policy.js";
export { matchesSpec } from "./verify.js";
export type { RamCandidateData, RamSpecFields, RamLiveState, RamAttributes } from "./types.js";
