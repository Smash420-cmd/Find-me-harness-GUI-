# T4 — Deeper run: chasing an actual pass (≥0.9)

**Date:** 2026-08-07 · **World:** `books-v1` (re-signed key, `certifiedAt 2026-08-07`)
**Student:** `claude-opus-5` via `scripts/exam-cli.mjs` (CLI-on-Max, $0 metered)
**Result: PASSED at episode 2 with a perfect board — score 1.0000.**

## BURN (the headline number)

Totals across **3 student episodes** — 2 for the pass, 1 for the replication:

| | |
|---|---|
| Episodes run | **3** (budgeted 10–15; the runner exits on pass) |
| Student wall-clock | **10.6 min** model time (233s + 196s + 204s) |
| Measured Opus rate | **~3.5 min/episode** (3.9 / 3.3 / 3.4) |
| Turns | 112 (36 + 37 + 39) |
| Output tokens | 38,864 |
| Input tokens | 172 |
| Cache read | 3,642,293 |
| Cache write | 225,244 |
| Metered spend | **$0.00** |
| API-equivalent | **≈ $12.60** at published Opus rates |
| Total run wall-clock | ~25 min of the 45-min Relay cap |
| Weekly Max quota | negligible — see below |

**Fraction of the weekly Max quota:** the two student episodes are a rounding
error against the weekly ceiling. The active 5-hour block read **$24.96 across
1h01m** with the orchestrating session included, and the student is the *smaller*
half of that. Consistent with T2/T3: **quota has never been the binding
constraint on this test — the 45-minute Relay wall clock is.** Optimise future
runs for minutes, not tokens.

## The measured Opus episode rate (this was unknown before today)

The "~3.1 min/episode, 6 safe / 8 ceiling" rule was **sonnet-only and void** since
`1f0964a` flipped the student to `claude-opus-5`. No Opus episode had ever been
timed. Timed exactly one before sizing any batch, per the brief:

- **233s / 196s / 204s across the three episodes → ~3.5 min/episode on Opus 5**
  (3.9 min for the very first, which pays the cold-start; ~3.3 thereafter).
- ~13% slower than sonnet's 3.1. Revised rule for a 45-min run: **6 episodes safe,
  7 the ceiling** (setup ~8 min + wrap-up ~10 min leaves ~27 min of episode budget).
- Practical note: size from **3.9 min** for the first episode, 3.4 for the rest.

## The curve

| Episode | Best score | Note |
|---|---|---|
| 1 | 0.7500 | one missed truth |
| 2 | **1.0000** | perfect board — **PASS** (passMark 0.9) |

Winning submission (episode 2, second of its three allowed):

```
https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299
https://www.barnesandnoble.com/w/atomic-habits-james-clear/1129201155
https://www.christianbook.com/atomic-habits-proven-build-break-ones/james-clear/9780735211292/pd/211299
```

Exactly the three keyed truths, zero traps shown. The pass is real, not a
scoring artefact — verified against `key.json` by hand, not just taken from the
judge's number. The student's *first* submission that episode was Amazon alone
(0.5000); it then widened the board and hit 1.0000 on the second.

## World verified before launch (per the brief's stop condition)

`worlds/` is gitignored, so the corrected key exists only on this machine.
Confirmed before spending anything:

- `certifiedAt: 2026-08-07`, `certifiedBy: Patrick` ✓
- **truths = 3** — amazon, christianbook, barnesandnoble ✓
- **traps = 10**, including the demoted `booksamillion` and `thirdplacebooks` ✓
- `npm run build` clean ✓

No re-audit performed — the 2026-08-05 analysis is settled and was not re-derived.

## What this does and does not mean

**Not comparable to T1–T3.** Different truth set (3, not 5), different denominator
(scale 4, not 6), and Opus 5 rather than sonnet. This is a **fresh curve**, not a
continuation, and reading 1.0000 against T3's 0.6667 as compounding would be wrong
on all three axes at once.

**The honest caveat: this passed cheaply.** Two episodes against a 10–15 episode
budget. Under the corrected key, `passMark 0.9` requires a perfect board, and a
perfect board is now only three URLs wide — a student that finds all three on any
single episode passes outright. The exam measures "can it assemble a small clean
board", which it can, rather than "can it climb". Per the standing note, flagging
this rather than re-tuning the key: **the fallback if books-v1 is now too thin is
re-recording with Playwright to restore genuinely discoverable truths, not moving
the pass mark.**

## Replication check — the pass is repeatable, and that is the problem

One pass cannot distinguish a real capability from a lucky episode, so a second
**independent fresh student** (`books-t4b`, clean state dir) was run against the
same world. It did better:

| Student | Episodes to pass | Final |
|---|---|---|
| `books-t4` | 2 | 1.0000 |
| `books-t4b` | **1** | 1.0000 |

2 of 2 students reached a perfect board; the second did it on its **first ever
episode**, with no prior state to learn from. Burn for the replication: 39 turns,
12,459 output tokens, 204s.

### Why it is cheap — verified in source, not inferred

`books-t4b`'s three submissions within that single episode:

| # | Board | Score |
|---|---|---|
| 1 | amazon | 0.5000 |
| 2 | amazon + barnesandnoble | 0.7500 |
| 3 | amazon + barnesandnoble + christianbook | **1.0000** |

It hill-climbed to a perfect board *inside one episode* by widening the board and
watching the number rise. That is possible because **`submit_answer` returns the
score and the category feedback to the student** — `src/exam/world-mcp.ts:85-94`
runs the judge in-process and replies with `verdict.score` plus
`verdict.categories` whenever the board is not yet passing. Confirmed by reading
the handler, not assumed from the curve.

So the exam currently pays out on a graded-feedback loop with
`MAX_SUBMISSIONS: 3`. With **3 truths and 3 submissions**, one guess per truth is
exactly enough to solve the board with no cross-episode learning at all. That is
the mechanism behind both passes.

### What this means for the test's purpose

T4 asked "does it pass ≥0.9, and what strategy emerges?" The literal answer is
**yes, in 1–2 episodes**, and the strategy that emerged is *in-episode hill
climbing on judge feedback* — not the compounding across episodes the exam was
built to detect. T2 and T3 both found no compounding; T4 does not overturn that,
because it never needed to compound.

**Recommendation (Patrick's call — nothing changed on disk):** the corrected key
is correct, but it left the board narrow enough that the feedback loop trivialises
it. Two independent levers, in order of preference:

1. **Re-record books-v1 with Playwright** to restore genuinely discoverable
   truths — the standing fallback, and the one that fixes depth rather than
   masking it. Playwright produced the successful captures previously.
2. **Reduce `MAX_SUBMISSIONS` to 1**, or withhold the numeric score from the
   verdict. Either kills the in-episode search and forces the student to commit
   a board on judgement. Cheap to try; a one-env-var change in `exam-cli.mjs`.

Do **not** raise `passMark` — a perfect board already scores 1.0000, so there is
nothing above it to move to.
