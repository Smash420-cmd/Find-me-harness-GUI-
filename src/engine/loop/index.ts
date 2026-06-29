/**
 * The loop (Task 4 + 4b). Domain-free orchestration:
 *
 *   observe → fanOut → verify → policyFilter → synthesise(rank) → confidenceGate
 *     ├─ good enough → return
 *     └─ improved?   → loopWider (bounded)   else → honest stop
 *
 * Termination is guaranteed (E3): `maxIterations` is a hard integer cap and
 * `wallClockMs` a hard time cap, both checked before each pass. `loopWider`
 * fires ONLY when the previous pass improved the best score (E4). A budget
 * breach throws `LoopBudgetExceededError`; an honest stop (no improvement, or
 * gate satisfied) returns the ranked results, each carrying composed confidence
 * (sub-threshold flagged, never dropped — E5).
 */
import {
  type Candidate,
  type Chassis,
  type Sandbox,
  type Spec,
  type VerifiedResult,
} from "../../types/index.js";
import { verifyCandidate } from "../verify/index.js";
import { composeConfidence, DEFAULT_CONFIDENCE_THRESHOLD } from "../confidence/index.js";
import { LoopBudgetExceededError } from "../errors/index.js";

export interface LoopBudget {
  readonly maxIterations: number; // hard cap (E3)
  readonly wallClockMs: number; // hard cap (E3)
}

export interface LoopDeps {
  readonly sandbox: Sandbox;
  readonly now?: () => number; // injectable clock (tests)
}

export type StoppedBy = "gate" | "no-improvement";

export interface LoopOutcome<TData> {
  readonly results: VerifiedResult<TData>[];
  readonly iterations: number;
  readonly stoppedBy: StoppedBy;
  readonly bestOverall: number;
}

export async function runLoop<TFields, TData>(
  spec: Spec<TFields>,
  chassis: Chassis<TFields, TData>,
  budget: LoopBudget,
  deps: LoopDeps,
): Promise<LoopOutcome<TData>> {
  const now = deps.now ?? Date.now;
  const start = now();
  const threshold = chassis.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const reliabilityOf = new Map(chassis.sources.map((s) => [s.name, s.reliability ?? 0.9]));

  let iterations = 0;
  let previousBest = -1;
  let lastResults: VerifiedResult<TData>[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Hard budget caps checked BEFORE doing work — guarantees termination (E3).
    if (iterations >= budget.maxIterations || now() - start >= budget.wallClockMs) {
      throw new LoopBudgetExceededError({ iterations, elapsedMs: now() - start });
    }
    iterations++;

    // observe → fanOut: gather candidates across this domain's sources.
    const candidates = await fanOut(spec, chassis);

    // verify each via the (human-gated) core; the chassis supplies the tier rules.
    const verified: VerifiedResult<TData>[] = [];
    for (const candidate of candidates) {
      const rules = chassis.tierRules(candidate, spec);
      const outcome = await verifyCandidate(candidate, rules, { sandbox: deps.sandbox });
      if (outcome.kind !== "verified") continue; // ghost dropped — no card.

      const confidence = composeConfidence(
        {
          convergence: candidate.relevance ?? 1,
          verification: outcome.verificationScore,
          sourceReliability: reliabilityOf.get(candidate.source) ?? 0.9,
        },
        threshold,
      );
      verified.push({ candidate, proof: outcome.proof, confidence });
    }

    // policyFilter: user constraints, AFTER verify, BEFORE rank (4b). Only ever
    // filters already-verified candidates.
    const allowed = chassis.policy ? verified.filter((r) => chassis.policy!(r, spec)) : verified;

    // synthesise: rank survivors via the chassis's notion of "best".
    const ranked = chassis.rank(allowed);
    lastResults = ranked;

    const bestOverall = ranked.reduce((m, r) => Math.max(m, r.confidence.overall), 0);

    // confidenceGate: good enough?
    if (ranked.some((r) => !r.confidence.flagged)) {
      return { results: ranked, iterations, stoppedBy: "gate", bestOverall };
    }

    // loopWider ONLY if this pass improved (E4); otherwise honest stop.
    if (bestOverall <= previousBest) {
      return { results: ranked, iterations, stoppedBy: "no-improvement", bestOverall };
    }
    previousBest = bestOverall;
  }
}

/** Parallel, bounded candidate gathering across the chassis's sources. */
async function fanOut<TFields, TData>(
  spec: Spec<TFields>,
  chassis: Chassis<TFields, TData>,
): Promise<Candidate<TData>[]> {
  const batches = await Promise.all(
    chassis.sources.map(async (s) => {
      try {
        return await s.observe(spec as Spec<unknown>);
      } catch {
        return [] as Candidate<TData>[]; // a source failing to observe doesn't sink the pass
      }
    }),
  );
  return batches.flat();
}
