/**
 * Named domain errors (Constitution Law 9). No generic `throw new Error(...)`.
 * Each maps cleanly to UI feedback without string-parsing.
 *
 * Engine-level errors live here. Chassis-level errors (`SpecInvalidError`,
 * `GhostDroppedError`) are thrown BY the chassis contract; the engine only
 * propagates them — but their classes are defined here so both hemispheres
 * share one error vocabulary (the classes carry no domain data).
 */

export abstract class HarnessError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// ── Engine-level ────────────────────────────────────────────────────────────

/** A result belongs to a run that has been superseded by a newer one (E2). */
export class SupersededRunError extends HarnessError {
  readonly code = "SUPERSEDED_RUN";
  constructor(readonly runId: string) {
    super(`Run ${runId} was superseded; its results must not emit.`);
  }
}

/** The bounded loop hit its iteration or wall-clock cap (E3). */
export class LoopBudgetExceededError extends HarnessError {
  readonly code = "LOOP_BUDGET_EXCEEDED";
  constructor(readonly detail: { iterations: number; elapsedMs: number }) {
    super(`Loop budget exceeded after ${detail.iterations} iterations / ${detail.elapsedMs}ms.`);
  }
}

/** A source could not be reached. */
export class SourceUnavailableError extends HarnessError {
  readonly code = "SOURCE_UNAVAILABLE";
  constructor(readonly source: string, cause?: unknown) {
    super(`Source '${source}' is unavailable.`);
    if (cause !== undefined) this.cause = cause;
  }
}

/** A render tried to touch state outside its ephemeral sandbox context (Plan B.4). */
export class SandboxViolationError extends HarnessError {
  readonly code = "SANDBOX_VIOLATION";
  constructor(message: string) {
    super(`Sandbox violation: ${message}`);
  }
}

// ── Chassis-level (thrown by the contract, propagated by the engine) ─────────

/** A request is internally impossible / fails the schema (e.g. "DDR4 @ 8000MHz"). */
export class SpecInvalidError extends HarnessError {
  readonly code = "SPEC_INVALID";
  constructor(message: string, readonly issues?: readonly string[]) {
    super(message);
  }
}

/** A candidate failed verification — wrong thing, or no proof of being real. */
export class GhostDroppedError extends HarnessError {
  readonly code = "GHOST_DROPPED";
  constructor(readonly key: string, readonly reason: string) {
    super(`Candidate '${key}' dropped: ${reason}`);
  }
}
