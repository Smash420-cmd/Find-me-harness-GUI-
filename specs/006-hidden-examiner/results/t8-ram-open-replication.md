# T8 — does the ddr4-open curve replicate? (pre-registered)

Run started 2026-09-09 09:00 AEST. World verified before spending:
`worlds/ram-v1/key.json` reads `certifiedAt: 2026-08-07`, truths 34 / 22 / 33,
traps 13 / 13 / 14. Unchanged since 08-07; no ruling has landed.

## Pre-registration (written BEFORE any episode was run)

T7 (`ram-open-01`) produced this project's first cross-episode improvement on
`ddr4-open`: **0.8857 FAIL -> 0.9429 PASS**, on 157 then 95 tool calls. n=1.
This test asks whether that replicates with a **fresh student id**
(`ram-open-02`), same exam, same cap 120, same model `claude-opus-5`.

Registered predictions:

1. **ep1 fails**, scoring in the **0.83-0.90** band. Reason: the ep1 ceiling is
   not truth coverage — T7 swept **34/34 truths and still failed**. The penalty
   comes from traps/unkeyed, and a cold student has no way to know which pages
   the key refuses.
2. **ep1 includes the memoz `2x16gb-2666-pc-ram` trap.** Its proof shot shows a
   genuine 2x16GB DDR4 kit, so a correct reader submits it.
3. **ep2 > ep1**, and ep2 uses **fewer tool calls** than ep1 — world knowledge is
   what transferred in T7, not judgement.
4. **ep2 sub1 still contains at least one page the judge rejects.** T7's notes
   said "next episode: resubmit minus memoz" and the student did not do it; the
   correction needed judge confirmation. If this repeats, "notes made it faster,
   not righter" survives replication.

Falsifier: if ep1 passes outright, or ep2 <= ep1, the T7 curve was a one-off.

## Key audit (no episodes needed) — the contradiction is WORSE than recorded

Ran `ddr4-gskill`'s 22 truths against `ddr4-open`'s 34. `ddr4-open` is the
**broader** request and subsumes the G.Skill-only one, so every gskill truth must
appear in open. **Two do not:**

| URL | in `ddr4-gskill` | in `ddr4-open` |
|---|---|---|
| `pcbyte.com.au/...ripjaws-v-3600mhz-cl16-ddr4-ram-72183` | TRUTH | **absent** |
| `jbhifi.com.au/...g-skill-trident-z-neo-32gb-2x16gb-ddr4-3200mhz...` | TRUTH | **absent** |

Absent, not trapped: `truth in gskill AND trap in open = 0`. So both are
**unkeyed** in `ddr4-open`, and by the T6d asymmetry (`unknownShown: 2` vs
`missedTruth: 1`) a student that shows them is docked **2 points each** for pages
this same certified key calls correct one exam over.

The 09-02 note recorded only `pcbyte`. **`jbhifi` is new.** Together they are
4 points of available penalty on a 35-point scale - larger than T7's entire ep1
penalty (4). This is not a judgement call; it is an internal contradiction in a
key signed `certifiedAt: 2026-08-07`. **Nothing has been changed on disk.**

### Subsumption is established from the requests themselves, not assumed

- `ddr4-open`: *"find me a 32GB DDR4 kit of 2x16GB sticks for my desktop that I
  can actually buy right now"*
- `ddr4-gskill`: *"find me G.Skill 32GB DDR4 desktop RAM, 2x16GB, in stock
  somewhere I can order today"*

Every page satisfying the gskill predicate satisfies the open predicate - gskill
adds a brand filter and nothing else. So all 22 gskill truths must be open
truths. **20 of 22 are. Two are not.** That is the contradiction.

### One apparent conflict, checked and cleared

A full cross-exam scan found exactly one URL keyed TRUTH in one exam and TRAP in
another:

`centrecom.com.au/klevv-cras-x-rgb-32gb-2-x-16gb-ddr4-3600mhz-cl18-...` -
truth in `ddr4-open`, trap in **both** `ddr4-gskill` and `ddr5-6000`.

**This one is correct.** Klevv is not G.Skill and DDR4-3600 is not DDR5-6000, so
it is a relevance trap in both narrower exams and a genuine truth in the open
one. Recording it because it is the shape a real contradiction would take, and
it is not one. The pcbyte/jbhifi pair is not of this shape: those are
truth-in-narrow, **absent-from-broad**, which subsumption forbids.

`truth in gskill AND trap in open = 0` - the key never actively contradicts
itself in that direction. The defect is omission, not inversion.

## Results

### ep1 — 0.7714 FAIL, with a PERFECT 34/34 truth sweep

`subtype=success`, `is_error=false`, `num_turns=214`, 213 tool calls, 766 s.
**Not truncated** - checked on the stream's final `result` event, per the T6b rule.
(Note `num_turns=214` against `--max-turns 120`: the cap still does not bind the
way the flag reads. Same observation as the T6 notes; not re-opened here.)

Three submissions, scored by hand against `key.json`:

| sub | urls | truths | traps | unkeyed | score |
|---|---|---|---|---|---|
| 1 | 26 | 23/34 | 1 | 2 | - |
| 2 | 35 | 32/34 | 1 | 2 | - |
| 3 | 38 | **34/34** | 1 | 3 | **0.7714** |

Hand-check of the reported 0.7714, using the T6d weights (`trap 2`,
`unknownShown 2`, `missedTruth 1`, scale 35):
`35 - 2 (memoz trap) - 6 (3 unkeyed) = 27`, and `27/35 = 0.771428...` **Exact
match.** The runner's number is confirmed, not trusted.

### The finding: it scored WORSE than T7 because it was MORE thorough

| | truths found | traps | unkeyed | score |
|---|---|---|---|---|
| T7 `ram-open-01` ep1 | 34/34 | 1 (memoz) | 1 | 0.8857 |
| T8 `ram-open-02` ep1 | 34/34 | 1 (memoz) | **3** | **0.7714** |

Identical truth coverage. Identical trap. The entire 0.1143 gap is **two extra
correct-but-unkeyed pages**. The student was docked 4 points for finding more of
the catalogue.

And this is not an argument about taste - **look at what the three unkeyed pages
actually are:**

1. `pcbyte.com.au/...ripjaws-v-3600mhz-cl16-ddr4-ram-72183` - **certified TRUTH in
   `ddr4-gskill`**
2. `jbhifi.com.au/...g-skill-trident-z-neo-32gb-2x16gb-ddr4-3200mhz...` -
   **certified TRUTH in `ddr4-gskill`**
3. `bunnings.com.au/...trident-z-rgb-32gb-2x-16gb-ddr4-3200...` - evidenced
   2026-09-02 as a genuine buyable match (`Marketplace | Online only`, `$474.53`,
   `Add to Cart`, no sold-out marker)

**Every single page this student was penalised for is one the project has already
established is correct** - two of them by this same key's own certification, one
by direct evidence from the recording. The pre-run audit predicted exactly these
two; the run supplied them unprompted.

**The audit and the episode are independent lines of evidence and they agree.**

### A third, separate defect: the key is URL-fragment sensitive

sub2 submitted `...desktop-ram?variant=40428679037129` (the exact string in
`ddr4-gskill`'s truth list). sub3 submitted the same product as
`...desktop-ram`, bare. Both landed as unkeyed in `ddr4-open`, but note that the
bare form would **also** miss in `ddr4-gskill`, where the variant-suffixed form is
the keyed truth. Matching is exact-string. A student that normalises a tracking
parameter off a URL is marked wrong for the same page. Flagged, not fixed.

### Scorecard against the pre-registration

| # | prediction | outcome |
|---|---|---|
| 1 | ep1 fails, **0.83-0.90** | **MISSED** - failed, but **0.7714**, below the band |
| 2 | ep1 includes the memoz trap | **HIT** |
| 3 | ep2 > ep1, on fewer tool calls | pending |
| 4 | ep2 sub1 still contains a rejected page | pending |

Prediction 1 missed, and **the reason it missed is the finding**. I sized the band
from T7's ep1 on the assumption that a perfect truth sweep sets the ceiling. It
does not: with truth coverage maxed at 34/34, the score is determined entirely by
how many *additional correct pages* the student is unlucky enough to find. The
band was wrong because the metric does not behave the way I modelled it.


### ep2 — 0.9429 PASS. The curve replicates, and the ceiling is the key's, not the student's.

`subtype=success`, `is_error=false`, `num_turns=89`, 88 tool calls, 523 s.
Not truncated.

| sub | urls | truths | traps | unkeyed | score |
|---|---|---|---|---|---|
| 1 | 39 | 34/34 | 1 (memoz) | 4 | 0.7143 |
| 2 | 35 | **34/34** | **0** | **1** | **0.9429** |

Hand-checked: sub2 `35 - 2 = 33`, `33/35 = 0.942857...` Exact match.

**The single page holding sub2 below a perfect score is
`pcbyte.com.au/...ripjaws-v-3600mhz-cl16-ddr4-ram-72183` - a certified TRUTH in
`ddr4-gskill`.**

So the passing submission is: every truth found, no traps, and one "wrong" answer
that this same key, signed `certifiedAt: 2026-08-07`, calls correct in the
neighbouring exam. **Score it without the contradiction and it is 1.0000.**

### Replication result

| | ep1 | ep2 | tool calls |
|---|---|---|---|
| T7 `ram-open-01` | 0.8857 | **0.9429** PASS | 157 -> 95 |
| T8 `ram-open-02` | 0.7714 | **0.9429** PASS | 213 -> 88 |

**The curve replicates.** Two students, fresh ids, different ep1 paths and
different ep1 scores, both improve across episodes and **both land on exactly
0.9429.** Not approximately - identically.

That convergence is the point. `0.9429` is `33/35`. Two independent runs stop 2
points short of perfect, and in T8 the missing 2 points are provably one
contradictory key entry. **0.9429 is the board's ceiling for a correct student,
not the student's ceiling.** The T7 result should be re-read the same way: it was
never a student improving toward 1.0; it was a student converging on the highest
score this key permits.

### Final scorecard against the pre-registration

| # | prediction | outcome |
|---|---|---|
| 1 | ep1 fails, 0.83-0.90 | **MISSED** - 0.7714, below the band |
| 2 | ep1 includes the memoz trap | **HIT** |
| 3 | ep2 > ep1, on fewer tool calls | **HIT** - 0.7714 -> 0.9429, 213 -> 88 calls |
| 4 | ep2 sub1 still contains a rejected page | **HIT** - sub1 kept memoz, 0.7143; only sub2 dropped it |

3 of 4. Prediction 4 matters most: **the "notes made it faster, not righter"
finding from T7 replicates exactly.** The student carried a written plan into ep2,
still submitted the memoz trap in sub1, and only removed it after the judge
marked it down. World knowledge transferred (88 calls vs 213). Judgement did not.
n=2 now, not n=1.

## What this run implies about the "enumerate the catalogue" question

The brief asks me to flag, not fix, whether "show 31 of 34 truths" is the intended
reading of *"find me a 32GB DDR4 kit ... that I can actually buy right now"*.
This run makes the cost of that framing concrete rather than theoretical:

- ep1 sub2 (32 truths, 2 unkeyed) and ep1 sub3 (34 truths, 3 unkeyed) **scored
  identically at 0.7714.** Finding two more genuine products was worth exactly as
  much as finding one more correct-but-unkeyed one cost.
- The student read that tie and wrote in its own notes: *"bunnings marketplace
  listing (added in sub3, score unchanged => likely bad)"*. **The metric taught it
  to distrust a real, buyable listing.**
- A user asking that question wants a few good kits. Returning the 3 best scores
  0.1739 (recorded T6c). Returning all 38 findable pages, including 3 the project
  has evidenced as genuine, scores 0.7714. Returning 35 - having deleted a correct
  answer - passes.

**The board rewards deleting correct answers.** That was inferred in T6c/T6d from
score arithmetic; here it is observed end to end, with the student stating the
inference in its own words.

## Recommendation (no files changed)

Nothing on disk was modified. `passMark`, weights and `MAX_SUBMISSIONS` are
untouched, per the standing instruction.

Ranked for Patrick:

1. **Add `pcbyte 72183` and `jbhifi ...?variant=40428679037129` to `ddr4-open`'s
   truths.** Not a judgement call - subsumption makes it forced. This alone turns
   T8 ep2 into 1.0000 and is the difference between "graduation gate passed" and
   "passed except for a key bug".
2. **Rule on memoz `2x16gb-2666-pc-ram`** (open since 2026-08-07). Both T7 and T8
   passes were bought by dropping it. If it is a real product, both passes are
   contaminated.
3. **Rule on bunnings and amazon `B07Z86BMCQ`.** Bunnings is evidenced buyable;
   amazon is un-adjudicable until re-recorded through the Playwright DOM.
4. **Decide whether URL matching should normalise query strings** - currently
   `?variant=` vs bare is two different pages to the key.
5. **Then rule on the enumeration framing.** Worth doing after 1-4, because fixing
   the key changes what the framing actually costs.

## Burn

| | ep1 | ep2 | total |
|---|---|---|---|
| turns | 214 | 89 | 303 |
| output tokens | 56,515 | 40,856 | 97,371 |
| cache read | 20,510,726 | 4,127,521 | 24,638,247 |
| wall clock | 766 s | 523 s | **21.5 min** |
| metered $ | 0 | 0 | **$0** |

Both episodes ran on Max via the `claude` CLI. **Quota was again not the
constraint** - the whole test, two full episodes plus the audit, fit in a
45-minute box with time to spare. ep1 at 766 s exceeded the 600 s Bash tool
ceiling and had to be backgrounded; that is now the operational limit to plan
around, not the quota.


## Cascade: `ddr5-6000` audited too (cheap, no episodes)

Time remained, so I ran the same structural checks on the third exam, which has
never been run.

Request: *"find me a 32GB DDR5-6000 kit (2x16GB) for a new desktop build that is
genuinely available"*. 33 truths, 14 traps.

- Overlap with `ddr4-open`'s truths: **0** - correct, the generations are disjoint.
- Truths whose URL advertises DDR4 or a DDR4 speed (`ddr4`, `-3200`, `3600mhz`,
  `2666`): **0**.
- Truths with no `ddr5` in the URL: **0**.
- Seller spread: centrecom 8, ple 7, scorptec 6, msy 4, umart 4, jbhifi 3,
  computeralliance 1.

**No defect found.** But state the limit honestly: the check that caught the
`ddr4-open` bug was **subsumption**, and `ddr5-6000` has no subsumption partner -
it is disjoint from both DDR4 exams rather than broader or narrower than either.
So the strongest available test is not applicable here, and "clean" means "clean
on every check that can be run without episodes", not "certified".

One useful consequence for open ruling #2: memoz `2x16gb-2666-pc-ram` is keyed a
trap in `ddr5-6000` as well, but it is a **DDR4-2666** part, so there it is
correctly a trap whatever Patrick rules. **The memoz ruling only moves
`ddr4-open` and `ddr4-gskill`.**
