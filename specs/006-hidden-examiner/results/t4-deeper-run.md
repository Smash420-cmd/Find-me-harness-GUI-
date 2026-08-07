# T4 — Deeper run: chasing an actual pass (≥0.9)

**Date:** 2026-08-07 · **World:** `books-v1` (re-signed key, `certifiedAt 2026-08-07`)
**Student:** `claude-opus-5` via `scripts/exam-cli.mjs` (CLI-on-Max, $0 metered)
**Result: PASSED at episode 2 with a perfect board — score 1.0000.**

## BURN (the headline number)

| | |
|---|---|
| Episodes run | **2** (budgeted 10–15; the runner exits on pass) |
| Student wall-clock | **7.2 min** model time (233s + 196s) |
| Measured Opus rate | **~3.6 min/episode** (3.9 + 3.3) |
| Turns | 73 (36 + 37) |
| Output tokens | 26,405 |
| Input tokens | 122 |
| Cache read | 2,744,731 |
| Cache write | 158,062 |
| Metered spend | **$0.00** |
| API-equivalent | **≈ $9.06** at published Opus rates |
| Total run wall-clock | ~30 min of the 45-min Relay cap |
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

- **ep 1 = 233s (3.9 min), ep 2 = 196s (3.3 min) → ~3.6 min/episode on Opus 5.**
- ~16% slower than sonnet. Revised rule for a 45-min run: **6 episodes safe,
  7 the ceiling** (setup ~8 min + wrap-up ~10 min leaves ~27 min of episode budget).

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

## Replication check

See the appended section below — a second, independent fresh student was run to
distinguish a repeatable pass from a lucky one.
