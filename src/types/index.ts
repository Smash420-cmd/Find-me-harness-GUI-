/**
 * The vocabulary of the engine. Domain-free (Constitution Law 7).
 * The engine speaks ONLY these words — never `RAM`, `price`, `SKU`.
 */

/** A validated request. Produced by either door; opaque to the engine after convergence. */
export interface Spec<TFields = unknown> {
  readonly fields: TFields;
}

/** A raw, unverified possibility gathered by `observe`. Not trustworthy until verified. */
export interface Candidate<TData = unknown> {
  /** Stable identity for this candidate within its source (a *fact*, never liveness). */
  readonly key: string;
  readonly source: string;
  readonly data: TData;
}

/**
 * The captured evidence that a candidate is real and correct.
 * Constitution Law 1: no result exists without one of these.
 */
export interface ProofShot {
  /** Which tier produced the proof (always the proof-bearing tier, normally 3). */
  readonly tier: VerificationTier;
  /** Opaque handle to the captured artifact (image ref / DOM snapshot id). */
  readonly artifactRef: string;
  /** When the proof was captured — liveness has a timestamp (Law 2). */
  readonly capturedAt: number;
  /** Human-readable note on what the proof shows. */
  readonly shows: string;
}

/** Cheapest-first verification tiers. The engine routes; the chassis supplies rules. */
export enum VerificationTier {
  Cache = 0,
  Api = 1,
  Dom = 2,
  Vision = 3,
}

/**
 * Composed confidence (Constitution Law 11). Never a single bare number —
 * each stage contributes and the overall is their composition.
 */
export interface Confidence {
  readonly convergence: number; // 0..1 — how well the candidate matched intent
  readonly verification: number; // 0..1 — strength of the passing verification (degraded < full)
  readonly sourceReliability: number; // 0..1 — declared/observed source trust
  readonly overall: number; // 0..1 — the composition
  /** True when overall < threshold: shown flagged, never hidden/promoted (Law 6). */
  readonly flagged: boolean;
}

/** What `verify` returns to the engine. */
export type VerificationOutcome<TData = unknown> =
  | { readonly kind: "verified"; readonly candidate: Candidate<TData>; readonly proof: ProofShot; readonly verificationScore: number }
  | { readonly kind: "dropped"; readonly candidate: Candidate<TData>; readonly reason: string };

/** A survivor: verified, proof-carrying, confidence-scored. The engine's output unit. */
export interface VerifiedResult<TData = unknown> {
  readonly candidate: Candidate<TData>;
  readonly proof: ProofShot;
  readonly confidence: Confidence;
}

/** The three-part mounting contract any chassis must satisfy (HARNESSBUILD §A.1). */
export interface Chassis<TFields, TData> {
  /** 1. What a valid request looks like in this domain (Zod schema). */
  readonly parseSpec: (input: unknown) => Spec<TFields>;
  /** 2. Is this candidate correct (right thing) AND real (available)? */
  readonly verify: (candidate: Candidate<TData>, spec: Spec<TFields>, tiers: TierRunner<TData>) => Promise<VerificationOutcome<TData>>;
  /** 3. What "best" means here — over verified survivors only. */
  readonly rank: (verified: VerifiedResult<TData>[]) => VerifiedResult<TData>[];
  /** The user-constraint vocabulary check (domain words; engine applies uniformly). */
  readonly policy?: (result: VerifiedResult<TData>, spec: Spec<TFields>) => boolean;
  /** The sources the fan-out may consume for this domain. */
  readonly sources: ReadonlyArray<ISourceProvider<TData>>;
  /** Sub-threshold flag boundary; defaults to engine default (0.85) if omitted. */
  readonly confidenceThreshold?: number;
}

/**
 * Handed to a chassis `verify` so it can request tier work without owning routing.
 * The engine implements this; the chassis only supplies the per-tier rules.
 */
export interface TierRunner<TData> {
  /** Run a tier check; the engine enforces cheapest-first ordering and degradation. */
  readonly run: (
    candidate: Candidate<TData>,
    tier: VerificationTier,
    rule: TierRule<TData>,
  ) => Promise<TierResult>;
}

/** A single tier's chassis-supplied rule. Returns whether the tier is satisfied. */
export interface TierRule<TData> {
  readonly tier: VerificationTier;
  /** Evaluate the tier for this candidate. Tier 3 must yield a ProofShot when satisfied. */
  readonly evaluate: (candidate: Candidate<TData>) => Promise<TierEvaluation>;
}

export type TierEvaluation =
  | { readonly ok: true; readonly proof?: ProofShot; readonly score: number }
  | { readonly ok: false; readonly reason: string };

export type TierResult =
  | { readonly status: "satisfied"; readonly tier: VerificationTier; readonly proof?: ProofShot; readonly score: number }
  | { readonly status: "unsatisfied"; readonly tier: VerificationTier; readonly reason: string }
  | { readonly status: "tier-failed"; readonly tier: VerificationTier; readonly reason: string };

/** Capabilities a source declares — decides which tiers are available (Plan B.2). */
export interface SourceCapabilities {
  readonly hasApi: boolean;
  readonly hasStockFlag: boolean;
  readonly rendersClean: boolean;
}

export interface ISourceProvider<TData = unknown> {
  readonly name: string;
  readonly capabilities: SourceCapabilities;
  /** Broad, cheap candidate gathering for a spec's intent. */
  readonly observe: (spec: Spec<unknown>) => Promise<Candidate<TData>[]>;
  /** Read a candidate's current state (DOM/page) for verification tiers. */
  readonly read: (candidate: Candidate<TData>) => Promise<unknown>;
}
