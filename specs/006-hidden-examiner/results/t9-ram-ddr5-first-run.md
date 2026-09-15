# T9 — first-ever run of `ddr5-6000` (pre-registered)

Run started 2026-09-16 09:00 AEST. No ruling has landed; key verified unchanged
before spending: `certifiedAt: 2026-08-07`, truths 34 / 22 / 33, traps 13 / 13 / 14.

## Why this exam

T7 and T8 both converged on 0.9429 on `ddr4-open`, and T8 showed the missing
2 points are a key omission (`pcbyte 72183`). Two replications on a board with a
known defect say nothing more. `ddr5-6000` has never been run, and the 09-09
structural audit found no defect in it - but that audit could not use the
subsumption check that caught the `ddr4-open` bug, because `ddr5-6000` has no
subsumption partner. **Running a student is the only remaining way to test this
key.** The student is, in effect, an auditor.

Setup: fresh student `ram-d5-01`, `claude-opus-5`, `--max-turns 120`, one
episode per call.

Bar (from `judge.ts` and `key.json`): scale `33*1+1 = 34`, `passMark 0.9`, so a
pass needs **total penalty <= 3**. Weights: missed truth 1, unkeyed 2, ghost /
dead-link 3, wrong-sku / variant-twin 3, irrelevant 5; `category-page`,
`bot-wall`, `oem-opaque`, `parse-trap` all cost 2.

Scores will be recomputed through the **real judge** (`dist/exam/judge.js`), not
by hand - see the correction below for why.

## Pre-registration (written BEFORE any episode was run)

1. **ep1 final submission finds >= 31 of 33 truths.** Opus swept 34/34 on
   `ddr4-open` in all four episodes across T7/T8.
2. **ep1 submits no DDR4 part** - in particular not memoz `2x16gb-2666-pc-ram`,
   which is a trap here on generation alone.
3. **ep1 fails, and at least one page it is penalised for is evidenced genuine
   (in-stock DDR5-6000 2x16GB) on inspection of the recording.** I.e. the key
   omission seen in `ddr4-open` is not a one-off. Falsifier: ep1 passes, or every
   penalised page is a real error.
4. If ep2 runs: **tool calls drop by >= 40%** vs ep1 (T7 -40%, T8 -59%).

## Correction carried from T8

T8 reported "key matching is exact-string" as a defect. **Wrong:**
`src/exam/judge.ts:78` strips `?...`, `#...` and trailing slashes and lowercases
before matching. Retracted in the T8 file and the TEST-PLAN log. The T8 scores
are unaffected. This is why T9 scores through the real judge.

## Results

### ram-d5-01 ep1 — 0.9118 PASS, first episode, zero false positives

`subtype=success`, `is_error=false`, `num_turns=102`, 101 tool calls, **216 s**
(vs 523-766 s per `ddr4-open` episode). Not truncated. Scored through the real
judge (`dist/exam/judge.js`):

| sub | urls | truths | traps | unkeyed | score |
|---|---|---|---|---|---|
| 1 | 7 | 7/33 | 0 | 0 | 0.2353 |
| 2 | 30 | **30/33** | **0** | **0** | **0.9118 PASS** |

Penalty 3 = three missed truths, nothing else. `1 - 3/34 = 0.9118`, **exactly on
the bar** (a fourth miss fails). The runner exits on pass, so this student cannot
show an ep2.

**Every page it showed is a keyed truth.** On this exam the key and the student
agree completely on what was submitted - the opposite of `ddr4-open`, where every
penalised page was a correct one.

sub1 is the familiar shape: 7 good kits, 0.2353. The student read a request for
"a kit" as a shortlist, and only enumerated after coverage feedback.

### Scorecard (ram-d5-01)

| # | prediction | outcome |
|---|---|---|
| 1 | final sub >= 31/33 truths | **MISSED** - 30/33 |
| 2 | no DDR4 part submitted | **HIT** - no non-truth of any kind |
| 3 | ep1 fails, >= 1 penalised page genuine | **FALSIFIED** - passed, nothing penalised but misses |
| 4 | ep2 tool calls -40% | n/a - passed in ep1 |

Prediction 3 was the substantive one and it is cleanly falsified: **no evidence of
a key omission in `ddr5-6000`.** The `ddr4-open` defect looks local to that exam's
construction, not a property of the whole recording.

(further students / adjudication of the 3 missed truths appended below)
