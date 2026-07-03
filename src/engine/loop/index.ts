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
import { routeRules } from "../../providers/source/base.js";

export interface LoopBudget {
  readonly maxIterations: number; // hard cap (E3)
  readonly wallClockMs: number; // hard cap (E3)
}

export interface LoopDeps {
  readonly sandbox: Sandbox;
  readonly now?: () => number; // injectable clock (tests)
  readonly log?: (msg: string) => void; // optional structured logger
  /** Called immediately after each result passes verification AND policy — enables streaming. */
  readonly onResult?: (result: VerifiedResult<unknown>) => void | Promise<void>;
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
  const log = deps.log ?? (() => {});
  const start = now();
  const threshold = chassis.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const reliabilityOf = new Map(chassis.sources.map((s) => [s.name, s.reliability ?? 0.9]));
  const capsOf = new Map(chassis.sources.map((s) => [s.name, s.capabilities]));

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
    const candidates = await fanOut(spec, chassis, log);
    log(`[loop] iteration ${iterations}: ${candidates.length} candidate(s) from fanOut`);

    // verify each via the (human-gated) core; the chassis supplies the tier rules.
    // Policy is applied inline so onResult (streaming) only fires for passing results.
    const verified: VerifiedResult<TData>[] = [];
    for (const candidate of candidates) {
      // Capability-matrix routing (Task 6): only run tiers this source can serve.
      const caps = capsOf.get(candidate.source);
      const rules = chassis.tierRules(candidate, spec);
      const routed = caps ? routeRules(rules, caps) : rules;
      const outcome = await verifyCandidate(candidate, routed, { sandbox: deps.sandbox });
      if (outcome.kind !== "verified") {
        log(`[loop] drop  ${candidate.key} (${candidate.source}): ${outcome.reason}`);
        continue; // ghost dropped — no card.
      }

      const confidence = composeConfidence(
        {
          convergence: candidate.relevance ?? 1,
          verification: outcome.verificationScore,
          sourceReliability: reliabilityOf.get(candidate.source) ?? 0.9,
        },
        threshold,
      );
      log(`[loop] pass  ${candidate.key} (${candidate.source}): score=${outcome.verificationScore.toFixed(2)} confidence=${confidence.overall.toFixed(2)}${confidence.flagged ? " FLAGGED" : ""}`);

      const result: VerifiedResult<TData> = { candidate, proof: outcome.proof, confidence };

      // Policy filter inline — only accept results that pass user constraints.
      if (chassis.policy && !chassis.policy(result, spec)) {
        log(`[loop] policy drop  ${candidate.key}`);
        continue;
      }

      verified.push(result);
      // Stream this result immediately — caller can push to SSE before all candidates finish.
      if (deps.onResult) await deps.onResult(result as VerifiedResult<unknown>);
    }

    const allowed = verified; // policy already applied inline above
    log(`[loop] ${verified.length} verified + policy-passed`);

    // synthesise: rank survivors via the chassis's notion of "best".
    const ranked = chassis.rank(allowed);
    lastResults = ranked;

    const bestOverall = ranked.reduce((m, r) => Math.max(m, r.confidence.overall), 0);

    log(`[loop] ranked ${ranked.length} result(s), bestConfidence=${bestOverall.toFixed(2)}`);

    // confidenceGate: good enough?
    if (ranked.some((r) => !r.confidence.flagged)) {
      log(`[loop] stop: gate satisfied`);
      return { results: ranked, iterations, stoppedBy: "gate", bestOverall };
    }

    // loopWider ONLY if this pass improved (E4); otherwise honest stop.
    if (bestOverall <= previousBest) {
      log(`[loop] stop: no improvement (best=${bestOverall.toFixed(2)} ≤ prev=${previousBest.toFixed(2)})`);
      return { results: ranked, iterations, stoppedBy: "no-improvement", bestOverall };
    }
    previousBest = bestOverall;
  }
}

/** Parallel, bounded candidate gathering across the chassis's sources. */
async function fanOut<TFields, TData>(
  spec: Spec<TFields>,
  chassis: Chassis<TFields, TData>,
  log: (msg: string) => void,
): Promise<Candidate<TData>[]> {
  const batches = await Promise.all(
    chassis.sources.map(async (s) => {
      try {
        const found = await s.observe(spec as Spec<unknown>);
        log(`[fanout] source=${s.name} returned ${found.length} candidate(s)`);
        return found;
      } catch (e) {
        log(`[fanout] source=${s.name} ERROR: ${String(e)}`);
        return [] as Candidate<TData>[]; // a source failing to observe doesn't sink the pass
      }
    }),
  );
  // Deduplicate by key (URL) — StaticICE and Google may return the same product page
  const seen = new Set<string>();
  return batches.flat().filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
}
