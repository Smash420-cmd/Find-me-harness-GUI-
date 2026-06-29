/**
 * Composed confidence (Task 5, Constitution Law 11). Confidence is NEVER a bare
 * number: three stages contribute and the overall is their composition.
 *   - convergence: how well the candidate matched intent
 *   - verification: strength of the passing verification (degraded < full)
 *   - sourceReliability: trust in the source
 *
 * Composition is MULTIPLICATIVE — the weakest link drags the whole down, so a
 * degraded verification or a flaky source is honestly reflected, never hidden.
 * Results below threshold are FLAGGED, never dropped or promoted (Law 6 / E5).
 */
import type { Confidence } from "../../types/index.js";

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export function composeConfidence(
  parts: { convergence: number; verification: number; sourceReliability: number },
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): Confidence {
  const convergence = clamp01(parts.convergence);
  const verification = clamp01(parts.verification);
  const sourceReliability = clamp01(parts.sourceReliability);
  const overall = convergence * verification * sourceReliability;
  return {
    convergence,
    verification,
    sourceReliability,
    overall,
    flagged: overall < threshold,
  };
}
