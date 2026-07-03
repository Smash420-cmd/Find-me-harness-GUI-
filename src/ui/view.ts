/**
 * The wrapper's view layer (Task 9) — PURE projection (Constitution Law 4).
 * It maps engine output to display fields. It makes NO decisions: it does not
 * verify, re-rank, filter, or promote. It preserves the engine's order and
 * faithfully surfaces the honest sub-threshold label (Law 6). All injected IO
 * (the proof image URL) is passed in, so this module is fully pure + testable.
 */
import type { VerifiedResult } from "../types/index.js";
import type { RamCandidateData } from "../chassis/ram/types.js";

export interface ResultView {
  readonly title: string;
  readonly url: string;
  readonly retailer: string;
  readonly priceLabel: string;
  readonly confidencePct: number;
  readonly flagged: boolean;
  readonly honestLabel: string;
  readonly proofUrl: string;
}

export interface RunView {
  readonly results: ResultView[];
  readonly stoppedBy: string;
  readonly note: string;
}

const aud = (n: number): string =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

export function toViewModel(
  results: ReadonlyArray<VerifiedResult<RamCandidateData>>,
  meta: { stoppedBy: string; bestOverall: number },
  proofUrlFor: (artifactRef: string) => string,
): RunView {
  // Map ONLY — order is the engine's, untouched.
  const view: ResultView[] = results.map((r) => ({
    title: r.candidate.data.title,
    url: r.candidate.data.url,
    retailer: r.candidate.data.retailer ?? "Unknown",
    priceLabel: aud(r.candidate.data.priceAud),
    confidencePct: Math.round(r.confidence.overall * 100),
    flagged: r.confidence.flagged,
    honestLabel: r.confidence.flagged
      ? "Below confidence threshold — shown for review"
      : "Verified in stock",
    proofUrl: proofUrlFor(r.proof.artifactRef),
  }));

  const note =
    results.length === 0
      ? "No verified, in-stock kit matched — nothing to show (no ghost inventory)."
      : view.every((v) => v.flagged)
        ? "No high-confidence match; showing best-effort results, honestly flagged."
        : `Showing verified results (stopped by: ${meta.stoppedBy}).`;

  return { results: view, stoppedBy: meta.stoppedBy, note };
}
