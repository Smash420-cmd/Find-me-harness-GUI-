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

/** Browser automation / render / capture — produces the proof-shot. */
export interface IValidationProvider {
  /**
   * Render and capture inside an ISOLATED, EPHEMERAL sandbox (Plan B.4).
   * Torn down after the capture; nothing rendered shares state with the engine.
   */
  capture: (target: { url: string; mustShow: string }) => Promise<ProofShot>;
}

/** Memory seam — STUB in v1 (get → miss). Local-first later, behind a benchmark. */
export interface ICacheProvider {
  /** Recall a *fact* only — never liveness (Law 2). */
  get: <T>(key: string) => Promise<{ hit: false } | { hit: true; value: T }>;
  set: <T>(key: string, value: T) => Promise<void>;
}

export type { ISourceProvider, SourceCapabilities } from "../types/index.js";
export type { Candidate, ProofShot };
