# Autonomous weekly test plan (Relay)

One test per weekly Relay run (Wed 09:00 AEST), in order, until all are ticked.
Each run: do the FIRST unchecked test, size it to one 5-hour Max window, record
results, tick the box, commit, and write a short findings note. Then stop.

## Iron rules for every run

1. **NEVER use the business `ANTHROPIC_API_KEY`.** Credential precedence for the
   student/eval: `STUDENT_API_KEY` env → a non-business OAuth/Max token available
   to this session (`STUDENT_AUTH_TOKEN`) → otherwise DO NOT SPEND: report what
   credential (if any) the session exposes, leave the box UNchecked, stop.
2. **One 5-hour window max.** Run episode 1, read its printed token/cache line.
   If one episode looks like it would exceed a fraction of the window such that
   the planned count won't fit, reduce the episode count. Better a small
   complete run than a clipped one.
3. **Commit results** to `specs/006-hidden-examiner/results/<test>.md` and tick
   the box here. Never commit `students/` or `worlds/` (gitignored — scraped
   content, secret-leak risk).
4. Work on branch `006-hidden-examiner`. `worlds/ram-v1` and `worlds/books-v1`
   are local (regenerate via `scripts/record-world.mjs` / `record-urls.mjs` if
   missing — live web, no API). `worlds/books-v1/key.json` is signed.

## The tests (do the first unchecked one)

- [ ] **T1 — Credential probe + vision eval.** Determine what non-business
  credential this session can give a Node SDK subprocess. If usable, run
  `READER_API_KEY=<it> node scripts/eval-reader.mjs` (or wire the token) and
  record the scorecard: does the vision reader read the audit screenshots
  correctly (page-type + availability)? This is the product linchpin. If NO
  usable credential, report the finding and STOP (leave unchecked) — this gates
  every later test.

- [ ] **T2 — Sonnet ladder (small).** `STUDENT_MODEL=claude-sonnet-5
  node scripts/exam.mjs --world ram-v1 --exam ddr4-gskill --student sonnet-01
  --episodes 5`. The open question: does a stronger model BUILD skill files /
  use `run_script` to compound across episodes, where Haiku only brute-forced
  effort (see MORNING-REPORT.md)? Record the score curve, the token readout, and
  whether any skill files appeared in the workspace.

- [ ] **T3 — Books transfer test (generality, Spec 007 C8).**
  `STUDENT_MODEL=claude-sonnet-5 node scripts/exam.mjs --world books-v1
  --exam books-v1 --student books-01 --episodes 8`. The real generality signal:
  does the RAM-trained approach transfer to a structurally distant domain
  (ISBN not MPN, different sites) faster than it learned RAM? Record the curve
  and compare episodes-to-progress against T2.

- [ ] **T4 — Deeper Sonnet ladder (only if T2 promising).** 10–15 episodes on
  ram-v1 chasing an actual pass (≥0.9), if a window allows. Record whether it
  passes and what strategy emerged.

## Log

(Each run appends: date, test, outcome, one-line finding.)
