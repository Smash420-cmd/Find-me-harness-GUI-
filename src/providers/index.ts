/**
 * Provider interfaces (Plan B.2). Implementations are swappable; the engine
 * depends only on these shapes. `ISourceProvider` lives in types/ because the
 * Chassis contract references it directly.
 */
import type { Candidate, ProofShot } from "../types/index.js";

export interface ILLMProvider {
  readonly name: string;
  /** Returns raw text; the caller MUST Zod-parse before the command path (Law 5). */
  complete: (prompt: string, opts?: { promptHash?: string }) => Promise<string>;
}

/** What to read off the rendered DOM. Domain-free: the caller names the fields
 * and supplies the selectors; the validator returns raw strings and never
 * interprets them (Law 7 — the chassis owns meaning). */
export interface ExtractSpec {
  readonly selector: string;
  /** Attribute to read; omit to read the element's text content. */
  readonly attr?: string;
}

export interface CaptureResult {
  readonly proof: ProofShot;
  /** Raw values read from the SAME render that produced the proof. */
  readonly fields: Record<string, string | null>;
}

/** Browser automation / render / capture — produces the proof-shot AND the raw
 * fields read off the very render it screenshots (so a liveness decision can be
 * confirmed on the same DOM the proof shows — F1). Domain-free. */
export interface IValidationProvider {
  /**
   * Render and capture inside an ISOLATED, EPHEMERAL sandbox (Plan B.4).
   * Torn down after the capture; nothing rendered shares state with the engine.
   * `extract` names the fields to read off the rendered DOM; the returned
   * `fields` are raw strings for the caller to interpret.
   */
  capture: (target: {
    url: string;
    mustShow: string;
    extract?: Record<string, ExtractSpec>;
  }) => Promise<CaptureResult>;
}

/** Memory seam — STUB in v1 (get → miss). Local-first later, behind a benchmark. */
export interface ICacheProvider {
  /** Recall a *fact* only — never liveness (Law 2). */
  get: <T>(key: string) => Promise<{ hit: false } | { hit: true; value: T }>;
  set: <T>(key: string, value: T) => Promise<void>;
}

export type { ISourceProvider, SourceCapabilities } from "../types/index.js";
export type { Candidate, ProofShot };
