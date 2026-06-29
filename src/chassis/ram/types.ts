/**
 * RAM domain types. Domain words (`DDR4`, capacity, price, in stock) live ONLY
 * under chassis/ram/ (Constitution Law 7). The engine never sees these.
 */

export type Generation = "DDR4" | "DDR5";

/** The correctness attributes of a memory kit. */
export interface RamAttributes {
  readonly generation: Generation;
  readonly capacityGb: number; // total
  readonly perStickGb?: number;
  readonly kitCount?: number;
  readonly dataRateMtps: number; // e.g. 6000 for DDR5-6000
  readonly casLatency?: number; // primary CL
}

/** A RAM listing candidate (carried as Candidate.data through the engine). */
export interface RamCandidateData {
  readonly productId: string; // SKU / identity — a *fact* (Tier 0 key)
  readonly title: string;
  readonly url: string;
  readonly attributes: RamAttributes;
  readonly priceAud: number; // current listing price (the verified-price basis)
  // optional policy-vocabulary attributes
  readonly brand?: string;
  readonly lowProfile?: boolean;
  readonly rank?: "single" | "dual";
  readonly greyImport?: boolean;
}

/** What a live read of the product page yields (liveness — re-checked every time). */
export interface RamLiveState {
  readonly availability: "in_stock" | "out_of_stock";
  readonly attributes: RamAttributes;
  readonly priceAud: number;
}

export interface RamConstraints {
  readonly lowProfileOnly?: boolean;
  readonly excludeGreyImport?: boolean;
  readonly singleRankOnly?: boolean;
  readonly brandInclude?: readonly string[];
  readonly brandExclude?: readonly string[];
}

export interface RamSpecFields {
  readonly generation: Generation;
  readonly capacityGb: number;
  readonly perStickGb?: number;
  readonly kitCount?: number;
  readonly dataRateMtps: number;
  readonly casLatency?: number;
  readonly budgetAud?: number;
  readonly constraints?: RamConstraints;
}
