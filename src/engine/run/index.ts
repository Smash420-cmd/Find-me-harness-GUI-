/**
 * Run identity + supersede (Task 1). Each user intent starts a run. Starting a
 * new run on the same lane SUPERSEDES the previous one; any late result from a
 * superseded run must never reach the stream (acceptance criterion E2).
 *
 * Domain-free: a "lane" is just an opaque key (e.g. one browser tab / session).
 */
import { SupersededRunError } from "../errors/index.js";

export interface Run {
  readonly id: string;
  readonly lane: string;
  readonly startedAt: number;
}

let counter = 0;
const newId = (): string => `run-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export class RunRegistry {
  /** lane → the id of the currently-live run on that lane. */
  private readonly live = new Map<string, string>();

  /** Begin a run on a lane, superseding whatever ran there before. */
  begin(lane: string): Run {
    const run: Run = { id: newId(), lane, startedAt: Date.now() };
    this.live.set(lane, run.id);
    return run;
  }

  /** True only if this run is still the live one on its lane. */
  isLive(run: Run): boolean {
    return this.live.get(run.lane) === run.id;
  }

  /**
   * The emission gate (E2): a value from a superseded run is refused here, so it
   * can never reach the stream. Live runs pass their value through untouched.
   */
  guardEmit<T>(run: Run, value: T): T {
    if (!this.isLive(run)) throw new SupersededRunError(run.id);
    return value;
  }

  /** Explicitly cancel a run (e.g. user navigates away). */
  cancel(run: Run): void {
    if (this.live.get(run.lane) === run.id) this.live.delete(run.lane);
  }
}
