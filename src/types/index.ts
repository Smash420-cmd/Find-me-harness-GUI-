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
  /**
   * 2. The verification contract, supplied as ordered tier RULES. The engine
   *    routes them cheapest-first and applies the proof-shot gate + degradation;
   *    the chassis only supplies what each tier CHECKS, never the routing.
   */
  readonly tierRules: (candidate: Candidate<TData>, spec: Spec<TFields>) => ReadonlyArray<TierRule<TData>>;
  /** 3. What "best" means here — over verified survivors only. */
  readonly rank: (verified: VerifiedResult<TData>[]) => VerifiedResult<TData>[];
  /** The user-constraint vocabulary check (domain words; engine applies uniformly). */
  readonly policy?: (result: VerifiedResult<TData>, spec: Spec<TFields>) => boolean;
  /** The sources the fan-out may consume for this domain. */
  readonly sources: ReadonlyArray<ISourceProvider<TData>>;
  /** Sub-threshold flag boundary; defaults to engine default (0.85) if omitted. */
  readonly confidenceThreshold?: number;
}

/** What the engine hands a proof-bearing tier rule: an isolated, ephemeral sandbox. */
export interface TierEnv {
  readonly sandbox: Sandbox;
}

/** An isolated, ephemeral render context (Plan B.4). Torn down after each run. */
export interface Sandbox {
  run<T>(work: (ctx: SandboxContext) => Promise<T>): Promise<T>;
}

export interface SandboxContext {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
}

/**
 * A single tier's chassis-supplied rule. The engine routes; this only checks.
 * `proofBearing` rules run inside the sandbox and may return a ProofShot.
 */
export interface TierRule<TData> {
  readonly tier: VerificationTier;
  /** True if this tier can produce the proof a card requires (e.g. Vision). */
  readonly proofBearing: boolean;
  /**
   * Evaluate the tier. Return:
   *  - { ok:true, proof?, score } — satisfied (proof present on proof-bearing tiers);
   *  - { ok:false, reason }       — checked and INVALID (ghost → drop);
   *  - or THROW                   — could not check (infra failure → degrade).
   */
  readonly evaluate: (candidate: Candidate<TData>, env: TierEnv) => Promise<TierEvaluation>;
}

export type TierEvaluation =
  | { readonly ok: true; readonly proof?: ProofShot; readonly score: number }
  | { readonly ok: false; readonly reason: string };

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
