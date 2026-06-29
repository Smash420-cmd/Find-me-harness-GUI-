/**
 * EMPTY SCAFFOLD — interfaces only, no behaviour. Do not implement.
 * Each seam is furnished only when its benchmark in the promotion register is
 * met (see /.claude.md). Signatures exist so the shape is visible in the tree.
 */

/** CQRS / event-sourcing seam. Benchmark: real audit need (multi-chassis builds). */
export interface ILedger {
  /** Append an immutable, attributable event (Law 10). Unimplemented in v1. */
  append: (event: { type: string; promptHash?: string; payload: unknown }) => Promise<void>;
}

/** Self-authoring-adapter seam. Benchmark: core proven + immutable test-gate built. */
export interface IAuthoringAdapter {
  /** Propose a new chassis/source adapter. Gated; unimplemented in v1. */
  propose: (intent: string) => Promise<never>;
}
