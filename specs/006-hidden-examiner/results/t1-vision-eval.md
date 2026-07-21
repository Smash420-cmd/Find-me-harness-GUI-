# T1 — Vision eval: BLOCKED (no spend)

**Run:** 2026-07-08 (first Relay run) · **Burn: 0 tokens, $0** — rule 1 honored.

- `STUDENT_API_KEY` is not set (no shell env, no .env in repo) → per iron
  rule 1, no metered spend, box left unchecked.
- Additionally `scripts/eval-reader.mjs` does not exist — even with a key,
  T1 cannot run as written. The plan references it but it was never committed.
  Fix before the next attempt: either commit the script or repoint T1 at the
  vision path exercised by the CLI student (`read_screenshot` via Claude Code
  native vision, covered by T2).

**Next:** user to either set a dedicated metered `STUDENT_API_KEY` and add
`eval-reader.mjs`, or drop T1 as subsumed by T2's read_screenshot usage.
