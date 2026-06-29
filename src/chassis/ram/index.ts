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
  readonly source: ISourceProvider<RamCandidateData>;
  readonly confidenceThreshold?: number;
}

export function createRamChassis(deps: RamChassisDeps): Chassis<RamSpecFields, RamCandidateData> {
  return {
    parseSpec: parseRamSpec,
    tierRules: (candidate, spec) => ramTierRules(candidate, spec, deps),
    rank: rankByPrice,
    policy: ramPolicy,
    sources: [deps.source],
    confidenceThreshold: deps.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
  };
}

export { parseRamSpec } from "./spec.js";
export { rankByPrice } from "./rank.js";
export { ramPolicy } from "./policy.js";
export { matchesSpec } from "./verify.js";
export type { RamCandidateData, RamSpecFields, RamLiveState, RamAttributes } from "./types.js";
