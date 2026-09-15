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

### ram-d5-02 (second fresh student) — 0.9118 PASS, identical score

`subtype=success`, 127 turns, 126 tool calls, 300 s.

| sub | urls | truths | score |
|---|---|---|---|
| 1 | 7 | 7/33 | 0.2353 |
| 2 | 29 | 29/33 | 0.8824 FAIL |
| 3 | 30 | **30/33** | **0.9118 PASS** |

Zero traps and zero unkeyed pages again. **Two independent students, different
paths (2 vs 3 submissions, 101 vs 126 tool calls), land on exactly 0.9118.**
sub1 was 7 urls for both - the same "shortlist first" reading of the request.

### What the misses are: a JB Hi-Fi discoverability wall, not a key defect

| missed truth | d5-01 | d5-02 |
|---|---|---|
| jbhifi `corsair-vengeance-rgb-6000mhz-...-2x16gb-grey` | missed | missed |
| jbhifi `kingston-fury-beast-ddr5-rgb-...-cl36-ram-white` | missed | missed |
| jbhifi `klevv-fit-v-32gb-...-cl28-...-black` | found | missed |
| scorptec `113814-kf560c36bbe2ak2-32` | missed | found |

`ddr5-6000` has exactly **3 JB Hi-Fi truths**. d5-01 missed 2 of them, d5-02
missed **all 3**. Of the 8 total misses across both students, **7 are JB Hi-Fi.**

This is a property of the recording, not of the key or the students. The JB pages
are ~1.09 MB Shopify blobs whose stock state is buried in serialized JSON
(`dimension7: 'In stock'`, `variants:[{...price:68900...}]`) with `Refurbished`,
`Sold out`, `Unavailable` and `Pre-order` all appearing elsewhere in the same
document as unrelated menu strings. Neither student was penalised for anything it
showed - **the entire residual on this exam is JB Hi-Fi parsing.**

Traced in the stream: **d5-01 never mentioned any of its three missed URLs at
all.** They were not fetched and rejected; they were never reached. Both are
reachable in-world - the corsair page is linked from the recorded staticice
search, the kingston page from the recorded Google search, and scorptec 113814
from the recorded scorptec category page.

### One relevance question for Patrick (not a defect)

`scorptec 113814` is keyed a **truth**, and its recorded body does show
`"availability":"https://schema.org/InStock"`, `aria-label="Add to cart"` and
`"price": "699"`. But its own meta description reads *"Kingston FURY Beast RGB
Black 32GB 6000MHz DDR5, CL36, **Refurbished**, Dual Kit, XMP 3.0"*, and the
request asks for a kit *"for a new desktop build"*. Its capture also carries
`_visiblePrice: 250` against a page price of 699 - the known `_visiblePrice` bug,
already on record.

A student that excludes refurbished stock from a new build is being reasonable
and would lose a point for it. **Flagging, not fixing** - this is a judgement
call about the request, exactly the class of thing I do not decide.

### ram-d5-03 (third fresh student) — 0.8824 FAIL. Passing is not reliable here.

`subtype=success`, 128 turns, 127 tool calls, 471 s.

| sub | urls | truths | score |
|---|---|---|---|
| 1 | 19 | 19/33 | 0.5882 |
| 2 | 27 | 27/33 | 0.8235 |
| 3 | 29 | **29/33** | **0.8824 FAIL** |

Still zero traps and zero unkeyed - **all three students went 3-for-3 on
precision; not one submitted a single page the key rejects.** d5-03 simply found
one truth fewer than the bar allows.

**It ran out of submissions, not out of ability.** The curve 0.5882 -> 0.8235 ->
0.8824 was still climbing when it hit `MAX_SUBMISSIONS: 3`. Contrast the
`ddr4-open` students, which passed on submission 2 of 3.

### Pass rate: 2 of 3. And the misses are the same pages every time.

| missed truth | d5-01 | d5-02 | d5-03 |
|---|---|---|---|
| jbhifi corsair-vengeance-rgb | **miss** | **miss** | **miss** |
| jbhifi kingston-fury-beast-...-white | **miss** | **miss** | **miss** |
| jbhifi klevv-fit-v | found | **miss** | **miss** |
| scorptec 113814 (refurbished) | **miss** | found | **miss** |

10 misses across 3 students. **8 are JB Hi-Fi, 2 are the refurbished scorptec
listing. Nothing else was ever missed by anyone.** Two JB pages were missed by
all three.

So `ddr5-6000` behaves like a 30-truth exam with a 3-truth JB Hi-Fi tail that
Opus cannot reliably parse, plus one debatable refurbished unit. The bar of 30 of
33 sits exactly on that tail, which is why two students land precisely on 0.9118
and the third lands one point under. **The margin between pass and fail on this
exam is entirely JB Hi-Fi HTML.**

This is the T6 lesson again, from the other side: **passing once is not passing
reliably** - and here the variance is not in the student's judgement (precision
was perfect every time) but in whether it happened to crack one more 1.09 MB
Shopify blob before its third submission.


### ram-d5-03 ep2 — 0.9412 PASS. Compounding beat the one-shot ceiling.

`subtype=success`, 125 turns, 124 tool calls, 578 s. Curve **0.8824 -> 0.9412**.

| sub | urls | truths | score |
|---|---|---|---|
| 1 | 29 | 29/33 | 0.8824 |
| 2 | 31 | **31/33** | **0.9412 PASS** |

It opened ep2 by re-submitting its ep1 board (29 urls, exactly where it left off)
and then **recovered two of the JB Hi-Fi pages it had missed** - the corsair and
the klevv. Still missing: the JB kingston page and the refurbished scorptec unit.

**This is the first time in the project that an episode-2 student beat what any
one-shot student achieved.** d5-01 and d5-02 both topped out at 0.9118 in a
single episode; d5-03 reached **0.9412** by continuing. The extra episode bought
a second budget of 3 submissions and a second pass at the JB blobs, which is
exactly where its deficit was.

Its `notes.md` shows what carried over - a verified world model:

> *"NO category/listing pages exist ... Only exact product URLs + a few cached
> SERP pages resolve. Discovery channels that work: the `search` tool,
> cat-staticice.html ... Corpus of 2x16GB DDR5-6000 product pages (45): PLE 8,
> MSY 8, Umart 8, Scorptec 7, Centrecom 8, ComputerAlliance 1, CPL 1,
> **JB Hi-Fi 2**"*

Note the last figure: its own corpus recorded **2** JB Hi-Fi pages when the key
has **3** truths there. The notes propagated an incomplete census, and the one JB
truth absent from that census is the one it still missed in ep2. **World
knowledge compounded, and so did a gap in it.** A sharper version of the T7/T8
finding: notes transfer whatever they contain, errors included.

## Summary — four episodes, three students, one exam

| student | episodes | best | pass | traps | unkeyed |
|---|---|---|---|---|---|
| ram-d5-01 | 1 | 0.9118 | PASS | 0 | 0 |
| ram-d5-02 | 1 | 0.9118 | PASS | 0 | 0 |
| ram-d5-03 | 1 | 0.8824 | fail | 0 | 0 |
| ram-d5-03 | 2 | **0.9412** | **PASS** | 0 | 0 |

- **Precision was perfect in all 10 submissions.** Not one page was shown that
  the key rejects - no traps, no unkeyed. On `ddr4-open` every penalised page was
  a correct one; here there were no penalised pages at all beyond misses.
- **`ddr5-6000` shows no sign of the `ddr4-open` key defect.** Pre-registered
  prediction 3 is cleanly falsified. The omission bug looks local to
  `ddr4-open`'s construction, not a property of the recording.
- **Recall, not judgement, is the binding constraint**, and it is concentrated:
  8 of 10 misses are JB Hi-Fi, 2 are the refurbished scorptec unit.
- **Pass rate 2 of 3 at one episode; the one failure passed at two.**

## Open items this run adds

1. **Rule on `scorptec 113814`** - keyed a truth, genuinely in stock, but
   **refurbished**, against a request for *"a new desktop build"*. Cost 2 of the
   10 misses. Not a defect; a question about the request.
2. **JB Hi-Fi pages are effectively a parsing wall** (~1.09 MB, stock state in
   serialized JSON, with `Refurbished`/`Sold out`/`Unavailable`/`Pre-order` all
   present as unrelated menu strings). 3 of 33 truths sit behind it and the pass
   bar sits exactly on them. Worth deciding whether that is the intended
   difficulty or an artefact of recording Shopify pages.
3. Unchanged and still blocking from T8: **add `pcbyte 72183` and
   `jbhifi trident-z-neo` to `ddr4-open`'s truths** (subsumption forces it), and
   **rule on memoz `2x16gb-2666-pc-ram`**.

## Burn

| | d5-01 | d5-02 | d5-03 ep1 | d5-03 ep2 | total |
|---|---|---|---|---|---|
| turns | 102 | 127 | 128 | 125 | **482** |
| output tokens | 18,880 | 24,474 | 37,045 | 41,331 | **121,730** |
| wall clock | 216 s | 300 s | 471 s | 578 s | **26.1 min** |
| metered $ | 0 | 0 | 0 | 0 | **$0** |

Four episodes inside one 45-minute box. `ddr5-6000` episodes run **216-578 s**
against `ddr4-open`'s 523-766 s, so this exam is roughly half the cost per
episode, and every episode stayed under the 600 s Bash ceiling. **Quota was again
not the constraint.**
