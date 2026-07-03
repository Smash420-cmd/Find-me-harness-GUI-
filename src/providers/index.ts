/**
 * Provider interfaces (Plan B.2). Implementations are swappable; the engine
 * depends only on these shapes. `ISourceProvider` lives in types/ because the
 * Chassis contract references it directly.
 */
import type { Candidate, ProofShot } from "../types/index.js";

export interface ILLMProvider {
  readonly name: string;
  /** Returns raw text; the caller MUST Zod-parse before the command path (Law 5). */
  complete: (prompt: string, opts?: { promptHash?: string; system?: string }) => Promise<string>;
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

/** What a vision model reads off a rendered sales page (the proof shot). Domain-
 * free: the same reader interprets any retailer, because a human doesn't need a
 * per-site brain to read a page. The chassis maps `identifiers` to its own
 * identity notion (MPN for RAM, ISBN for books) and validates `price`/
 * `available` through the existing deterministic gates — the reader is a
 * WITNESS, not a judge (Law 5). Every claim is auditable against the same
 * screenshot it was read from (F1). */
export interface ProofReading {
  /** Is this even a buyable product page? category/search/error/blocked pages self-declare. */
  readonly pageType: "product" | "category" | "search" | "error" | "blocked" | "other";
  readonly available: "in_stock" | "out_of_stock" | "preorder" | "unknown";
  /** What the reader actually saw (an enabled Add-to-Cart, a Notify-Me form, "Sold out"…). */
  readonly availabilityEvidence: string;
  readonly price: number | null; // the product price, not a cart total or installment
  readonly currency: string | null;
  readonly title: string | null;
  /** Visible SKU / MPN / ISBN / Model#, verbatim — the identity anchor. */
  readonly identifiers: string[];
  readonly confidence: number; // 0..1
  /** Honesty note: what could NOT be read, why unknown, page problems. */
  readonly notes: string;
}

/** Reads structured fields off a proof-shot image. Implemented by a vision LLM
 * guided by the sales-page reading guide; swappable/mockable for tests. */
export interface IProofReader {
  /** `domainHint` is a thin per-chassis appendix (e.g. "RAM: kit config is
   * load-bearing; SODIMM = laptop"). `imageBase64` is the same PNG the proof
   * shot shows. */
  read: (imageBase64: string, opts?: { domainHint?: string; want?: string }) => Promise<ProofReading>;
}

/** Memory seam — STUB in v1 (get → miss). Local-first later, behind a benchmark. */
export interface ICacheProvider {
  /** Recall a *fact* only — never liveness (Law 2). */
  get: <T>(key: string) => Promise<{ hit: false } | { hit: true; value: T }>;
  set: <T>(key: string, value: T) => Promise<void>;
}

export type { ISourceProvider, SourceCapabilities } from "../types/index.js";
export type { Candidate, ProofShot };
