# Autonomous weekly test plan (Relay)

One test per weekly Relay run (Wed 09:00 AEST), in order, until all are ticked.
Each run: do the FIRST unchecked test, size it to one 5-hour Max window, record
results, tick the box, commit, and write a short findings note. Then stop.

## Iron rules for every run

1. **Credential: ONLY a dedicated metered `STUDENT_API_KEY`.** Verified against
   Anthropic's terms (2026-07): the exam is SDK code, so it may use a real API
   key (Commercial Terms — allowed, unambiguous) but must NEVER use the business
   `ANTHROPIC_API_KEY`, and must NEVER use a Pro/Max OAuth token — using a
   subscription OAuth token with the SDK is a Consumer-ToS violation that has led
   to ACCOUNT SUSPENSIONS. Do NOT probe for or borrow a Max/session token. If
   `STUDENT_API_KEY` is not set: DO NOT SPEND — write a one-line note that no
   sanctioned key is set, leave every box unchecked, stop. (Relay scheduling the
   official Claude Code CLI is fine; feeding a Max token to the SDK student is
   not — that distinction is the whole ballgame.)
2. **MEASURE THE BURN — this is the point of the early runs.** Record and report
   prominently, at the top of the results file AND in the one-line Log entry:
   total model tokens used (sum the per-episode `tokens NNNK (NN% cached)`
   readouts + any vision calls), total wall-clock minutes, and episodes/calls
   made. We scale future runs on this number, not on assumptions — my cost
   estimates have been unreliable, so the measured figure governs.
3. **Adaptive scaling within a run.** Size to ONE 5-hour Max window. Run
   episode 1 first, read its token/cache line.
   - If the just-finished test used LITTLE (wall-clock well under ~45 min and
     modest tokens) AND another test is unchecked, CONTINUE to the next test in
     the same run — cascade while comfortable headroom remains in the window.
     Stop with margin to spare; never risk clipping.
   - If a test is heavier than expected, do just that one (or fewer episodes),
     and record why. Better a small complete result than a clipped one.
   - T1 (vision eval) is tiny — always also start T2 after it if a credential
     works. The real burn signal is T2's first Sonnet student episode.
4. **Commit results** to `specs/006-hidden-examiner/results/<test>.md` and tick
   the box(es) here. Never commit `students/` or `worlds/` (gitignored — scraped
   content, secret-leak risk).
5. Work on branch `006-hidden-examiner`. `worlds/ram-v1` and `worlds/books-v1`
   are local (regenerate via `scripts/record-world.mjs` / `record-urls.mjs` if
   missing — live web, no API). `worlds/books-v1/key.json` is signed.
6. **After the first run that spends anything, the user reviews the measured
   burn and may bump episode counts here.** Leave the plan easy to scale: the
   `--episodes N` in each test is the knob.

## The tests (do the first unchecked one)

- [ ] **T1 — Vision eval.** If a dedicated metered key is set, run
  `READER_API_KEY=$STUDENT_API_KEY node scripts/eval-reader.mjs` and record the
  scorecard: does the vision reader read the audit screenshots correctly
  (page-type + availability)? This is the product linchpin. If `STUDENT_API_KEY`
  is not set, STOP per rule 1 (no sanctioned key → no spend). Do NOT source a
  subscription token.

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
