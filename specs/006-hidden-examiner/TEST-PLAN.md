# Autonomous weekly test plan (Relay)

One test per weekly Relay run (Wed 09:00 AEST), in order, until all are ticked.
Each run: do the FIRST unchecked test, size it to one 5-hour Max window, record
results, tick the box, commit, and write a short findings note. Then stop.

## Execution model: the `claude` CLI is the student (on Max, free)

The student runs via `scripts/exam-cli.mjs` — each episode is one `claude -p`
invocation whose only tools are the world MCP server (`dist/exam/world-mcp.js`).
This is the ONLY ToS-clean way to run on the Max plan: using the official
`claude` binary on a subscription is permitted; the SDK path (`exam.mjs`) needs
a metered `STUDENT_API_KEY` and must NEVER get a subscription token. Prefer the
CLI path here — it's free on Max and `read_screenshot` becomes Claude Code's
native vision. The MCP server is unit-tested; the exact `claude` flags need one
first-run confirmation (noted in exam-cli.mjs) — the first session can adjust.

## Iron rules for every run

0. **Prime Relay auto-resume at the START of the run** (it only functions when
   primed via the skill/`/` command — a scheduled session won't bounce
   otherwise). Arm it so that if this run hits the 5-hour OR weekly limit
   mid-test, it resumes at the next reset of whichever ceiling it hit and
   continues until the test finishes. Long on-Max runs depend on this.

1. **Credential: ONLY a dedicated metered `STUDENT_API_KEY`.** Verified against
   Anthropic's terms (2026-07): the exam is SDK code, so it may use a real API
   key (Commercial Terms — allowed, unambiguous) but must NEVER use the business
   `ANTHROPIC_API_KEY`, and must NEVER use a Pro/Max OAuth token — using a
   subscription OAuth token with the SDK is a Consumer-ToS violation that has led
   to ACCOUNT SUSPENSIONS. Do NOT probe for or borrow a Max/session token. If
   `STUDENT_API_KEY` is not set: DO NOT SPEND on any SDK-path test — this rule
   gates ONLY SDK-path tests; CLI-on-Max tests spend nothing metered and always
   may run. (Relay scheduling the official Claude Code CLI is fine; feeding a
   Max token to the SDK student is not — that distinction is the whole
   ballgame.) User ruling 2026-07-24: all tests run on the subscription — no
   metered key is planned; any test written against the SDK is miswritten,
   rewrite it for the CLI.
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

- [x] **T1 — Vision eval (on Max, free).** User ruling 2026-07-24: ALL tests
  run on the subscription via the `claude` CLI — no metered key exists or is
  planned. Build a small exam-cli-style wrapper: for each screenshot in
  `worlds/ram-v1/capture/*.png`, one `claude -p` call (native vision via Read,
  no MCP, no other tools) asking page-type + availability as JSON; score
  against the paired capture `.json` metadata and `worlds/ram-v1/vision/*.json`
  truths. Record the scorecard: does vision read the audit screenshots
  correctly? This is the product linchpin. The SDK path
  (`eval-reader.mjs`, branch `feature/vision-reader`) stays parked — it needs a
  metered key we're not creating.

- [x] **T2 — CLI student on RAM (on Max, free).**
  `node scripts/exam-cli.mjs --world ram-v1 --exam ddr4-gskill --student cc-01
  --episodes 5`. First: confirm the `claude` flags work (built-ins hidden, only
  the 7 world tools available) — fix exam-cli.mjs if not, that's expected on the
  first live run. The open question: does the real agent BUILD skill files / use
  run_script to compound, and how far does it climb? Record the curve and any
  skill files. Note: the student is Claude Code (not blank-slate) — measures the
  practical agent, not pure self-teaching.

- [x] **T3 — Books transfer test (generality, Spec 007 C8).**
  `node scripts/exam-cli.mjs --world books-v1 --exam books-v1 --student
  books-cc-01 --episodes 8`. The real generality signal: does the approach
  transfer to a structurally distant domain (ISBN not MPN, different sites)?
  Compare episodes-to-progress against T2.

- [ ] **T4 — Deeper run (only if T2 promising).** 10–15 episodes chasing an
  actual pass (≥0.9). Auto-resume (rule 0) lets this span multiple windows and
  self-complete. Record whether it passes and what strategy emerged.

Note: the SDK path (`scripts/exam.mjs`) remains available for a clean-science
blank-slate run, but only with a dedicated metered `STUDENT_API_KEY` — never on
Max. Default to the CLI path above.

## Log

(Each run appends: date, test, outcome, one-line finding.)

- 2026-07-08 · T1 · BLOCKED — no `STUDENT_API_KEY` anywhere AND `scripts/eval-reader.mjs` doesn't exist; $0 spent (results/t1-vision-eval.md). Run then died: exam launched in background, Relay killed it at turn end.
- 2026-07-15 · T2 · LOST — same background-kill mistake; student was mid-episode-1 (had saved 2 pages) when the host exited. Zero scores.
- 2026-07-22 · T2 · DONE — curve 0.61→0.57→0.57→0.39→0.57, no pass, **no compounding: ep2 wrote excellent strategy notes, eps 3–5 never read them (0 workspace listings)**. Burn: 75K output tok / 232 turns / 17 min ≈ $5.80 API-equiv — negligible vs weekly Max; wall-clock is the real constraint (~3.5 min/ep). Flags verified (7 world tools only). Stopped before T3: 41 min block headroom < ~30 min needed.
- 2026-07-29 · T3 · DONE (catch-up run; 09:00 run killed by the 45-min wall clock at ep 7/8 with nothing committed) — curve 0.5→0.5→0.6667→0.5→0.5→0.6667→0.5→0.6667, best 0.6667, no pass. **The method transfers**: a structurally distant domain scored *higher* than T2's RAM world (0.6667 vs 0.6087) and peaked sooner (ep 3 vs ep 1). **But 2 of the 5 truths (booksamillion, thirdplacebooks) are in `urls.json` yet never returned by `search`** — the student cannot submit what it cannot discover, so 0.6667 may be the world's ceiling, not the student's. **T2's "never reads its notes" conclusion does not generalise**: this student wrote `MEMORY.md`+`notes.md`, read them back via `readmem.mjs` (ep 7) / `parse_bn*.mjs` (ep 8), reverse-engineered the scoring model, A/B-tested with its 3 submissions — and still landed exactly where ep 3 did. Reading the notes is not sufficient for compounding. Burn: 106.9K output / 288 turns / 25.1 min model time / 7.1M cache read ≈ $5.45 API-equiv, $0 metered. **Runner: `submissions.jsonl` is OVERWRITTEN (`exam-cli.mjs:37 rmSync`), but episodes resume from `state.json` (`:47`)** — scores survive a kill, raw submission lines don't. Calibration: ~3.1 min/episode, ~8 min setup, ~10 min wrap-up → **6 episodes safe, 8 is the ceiling for one 45-min run.**
- 2026-07-29 · T1 · DONE — 83 screenshots, one `claude -p` each. **Vision is right and the recorded DOM truth is wrong**: raw agreement price 58/81, addToCart 64/83, inStock 71/83, pageType 79/83 — but on 8 PNGs opened by hand across all 6 disagreement classes, vision matched the pixels 8/8 and the capture field never did. Root cause `playwright.ts:132-152`: `_visiblePrice` = first `$N` in whole-DOM innerText (13/14 Scorptec captures read "250"; real prices 319–789) or the struck-through RRP (5/5 Centrecom), `_outOfStock` regex hits filter labels and one sold-out store row (8 of 10 recorded OOS are false), `_addToCart` matches any DOM button while the shot is a 1280×720 crop. **Worst: a 404 and an eBay error page both recorded `_outOfStock:false` → certify as in-stock.** Burn: 18.9K output / 12 min / ≈$2.00 API-equiv, $0 metered — the cheapest test yet.
