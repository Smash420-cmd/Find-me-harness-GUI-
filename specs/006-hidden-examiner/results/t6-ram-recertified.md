# T6 — RAM (exam #1): passed once at 0.9565, **did not replicate** (0.4783)

**Date:** 2026-08-12 · **Students:** `ram-t6-01`, `ram-t6-02` (both fresh) · **Model:** `claude-opus-5`
**Exam:** `ddr4-gskill` on `worlds/ram-v1` (key `certifiedAt: 2026-08-07`, verified before spending)

> **Read the replication section before quoting the 0.9565.** Two fresh students,
> identical setup, same board: **0.9565 (pass) and 0.4783 (fail)**. The gate was
> cleared, but one pass in two attempts is not a graduated protocol.

## Burn

| | |
|---|---|
| Episodes | **1** (runner exits on pass) |
| Wall clock | **192 s** (3.2 min) — episode 1, cold start |
| Turns | 65 |
| Tokens | in 42 · **out 15,891** · cache read 1,406,086 · cache write 264,279 |
| Metered $ | **$0** (Max, CLI student) |
| API-equiv | ≈ $4.20 |
| Fraction of weekly Max quota | negligible — **wall clock remains the only real constraint** |

Cheapest decisive result the project has produced: one episode, 3.2 minutes.

## Result: 0.9565 — the graduation gate is passed

`ddr4-gskill`: **21 of 22 truths, zero traps, zero unknown URLs, in ONE submission.**
`1 − 1/23 = 0.9565` ≥ `passMark 0.9`. Verified independently against `key.json`,
not just read off the runner.

Only miss: the JB Hi-Fi URL — the one truth carrying a `?variant=` query string.

**Exam #1 has never been passed before.** Prior best was 0.6087 (`cc-01`, sonnet,
5 episodes, on a curve that got *worse*: 0.6087 → 0.5652 → 0.5652 → 0.3913 → 0.5652).
Same exam, same 22-truth board — certification changed `ddr4-open` (35→34) and
`ddr5-6000` (34→33) but left `ddr4-gskill` at 22, so this is a clean A/B against
the only RAM baseline in project history.

**0.6087 → 0.9565, and from 13 truths to 21.** Two variables moved at once, though
(sonnet→Opus, and the recorder tri-state fix), so this is not a controlled
attribution — see Caveats.

## This is NOT T4's enumeration

T4's pass was an artefact: `submit_answer` returns the score on a miss, and with
3 truths / `MAX_SUBMISSIONS: 3` a student could add one URL per attempt and read
off the answer. That cannot happen here and did not:

- 22 truths vs `MAX_SUBMISSIONS: 3` — the guard (`world-mcp.ts:180`) has ample margin.
- **One submission.** No judge feedback was ever consumed. There was no loop to exploit.

## What the student actually did — the strategy that emerged

Tool histogram for the single episode:

```
mcp__world__fetch          41
mcp__world__search          8
mcp__world__write_file      6
mcp__world__run_script      5
mcp__world__screenshot      2
mcp__world__read_screenshot 1
mcp__world__submit_answer   1
```

It ran 8 distinct searches, **fetched 41 pages to verify candidates**, saved each
retailer's HTML, then wrote and ran four throwaway parsers (`check.mjs`, `parse.mjs`,
`parse2.mjs`, `parse3.mjs`) to extract spec and stock, spot-checked two pages
through vision, and submitted once. It fetched `bunnings.html` and
`amazon-B07Z86BMCQ.html` and **correctly excluded both** — the zero-trap board was
earned by checking, not by luck.

This is the first time a student in this project has built verification tooling and
converted it straight into a pass.

## The compounding question: still unanswered, and now harder to answer

The brief asks whether anything compounds across episodes. **This run cannot say.**
The runner exits on pass, so there was never an episode 2, and the workspace holds
**no `MEMORY.md` and no `notes.md`** — the student had no reason to write for a
successor it didn't know it would need.

So the T2/T3 no-compounding finding is neither confirmed nor overturned. It is
now *structurally* hard to test on this exam: a gate cleared in one episode
produces no curve at all. Testing compounding needs an exam a good student does
*not* clear first try.

## FLAG FOR PATRICK — the "enumerate the catalogue" concern is now confirmed

The brief flagged this and told me not to fix it. The run settles it empirically.

The request reads *"find me G.Skill 32GB DDR4 desktop RAM, 2x16GB, in stock
somewhere I can order today"*. The winning answer was **21 near-identical kits
across 7 retailers** (MSY, Umart, PCByte, Scorptec, Centrecom, PLE, JB Hi-Fi) —
and the rubric requires it: the bar is 20 of 22, so anything resembling a helpful
reply ("here are the three cheapest in stock") **scores near zero**.

Concretely: a student returning the 3 best kits scores `1 − 19/23` = **0.1739**.

So the exam as keyed rewards exhaustiveness and punishes judgement, which is the
opposite of what "find me X" means to a user. `passMark`, weights and
`MAX_SUBMISSIONS` were left untouched — this is Patrick's ruling, and it is the
main thing worth ruling on now that the gate is green.

## Replication: it did not hold (`ram-t6-02`)

A second fresh student, same command, same board, same model:

| | `ram-t6-01` | `ram-t6-02` |
|---|---|---|
| Score | **0.9565 PASS** | **0.4783 fail** |
| Truths shown | 21 / 22 | 14 / 22 |
| Traps | 0 | 0 |
| **Unkeyed URLs** | 0 | **2** |
| URLs submitted | 21 | 16 |
| Wall clock | 192 s | 327 s |
| fetch / search / run_script | 41 / 8 / 5 | **54 / 17 / 12** |
| Turns · output tok | 65 · 15.9K | 36 · 26.4K |

Arithmetic checks out: 8 missed × 1 + 2 unknown × 2 = 12 → `1 − 12/23` = 0.4783.

Two things stand out:

1. **The harder-working student scored worse.** `ram-t6-02` ran 32 % more fetches,
   twice the searches and 2.4× the scripts, took 70 % longer — and finished at half
   the score. Effort is not the variable; *breadth of enumeration at submit time* is.
2. **It submitted the two pages `ram-t6-01` rejected.** `bunnings.com.au` and
   `amazon.com.au` — student 01 fetched both and excluded them; student 02 included
   them and paid 4 points.

So the spread between a pass and a clear fail is one judgement call about two URLs,
plus how much of the catalogue got enumerated. **n=2, one pass — treat the gate as
"cleared once", not "passed".**

## Second flag for Patrick — the key does not cover its own world

Those two URLs are neither truths nor traps: they are **unkeyed**, so `judge.ts`
falls through to `unknownShown: 2` each. They are reachable in the world and a
student can find them, but the key has no opinion on them.

- `bunnings.com.au/...f4-3200c16d-32gtzr` — a hardware chain; excluding it is right,
  but it should be an explicit trap, not an accident of omission.
- `amazon.com.au/g-skill-ripjaws-32gvkc-2x16gb-f4-3600c16d-32gvkc/dp/b07z86bmcq` —
  from the URL alone this reads as **exactly what the request asks for** (G.Skill
  Ripjaws, 2×16 GB, F4-3600C16D-32GVKC). If it is genuinely in stock it is a missing
  *truth*, and student 02 was penalised 2 points for finding a correct answer.

**I did not open either screenshot — I verified only that both are unkeyed and cost
4 points.** Ruling needed; I changed nothing. This is the same class of defect as the
books-v1 and ram-v1 signature problems: the key was certified against the shots it
lists, and says nothing about reachable pages it never listed.

## Caveats — do not over-read this

- **Not a controlled A/B.** sonnet→Opus and the recorder fix both moved. The jump
  is real but its cause is not isolated.
- **One exam.** `ddr4-open` (31 of 34) and `ddr5-6000` (30 of 33) were not run.
- **The pass did not replicate** (0.9565 vs 0.4783 on n=2). This is the single most
  important caveat: quoting 0.9565 alone misrepresents the run.
- Scores remain incomparable across key changes and models, as always.
- Combined burn for both students: **2 episodes, 519 s, 101 turns, 42.3K output,
  $0 metered** (≈ $11 API-equiv).

## What the next run should do

The obvious next step is **n**, not a new test: run 4–6 more fresh single-episode
students on `ddr4-gskill` and report a pass *rate*. Each costs ~3–5 min, and the
runner exits on pass, so a batch is cheap. One pass in two tells you almost nothing;
six tells you whether the protocol graduated or got lucky.

---

# T6b — 2026-08-19: the pass rate was measuring a turn cap, not the student

**Students:** `ram-t6-03`, `ram-t6-04` (default cap), `ram-t6-05` (raised cap) · **Model:** `claude-opus-5`
**Exam:** `ddr4-gskill`, same certified key (`2026-08-07`, re-verified: 34/22/33).

This run set out to buy `n` — turn last week's 1-pass-in-2 into a pass *rate*. It
found something that invalidates the question as posed.

## The finding: `--max-turns 35` truncates students mid-work

`scripts/exam-cli.mjs:72` hard-coded `--max-turns 35`. Result subtypes across all
five students on this board:

| student | cap | result subtype | tool calls | submissions | score |
|---|---|---|---|---|---|
| `ram-t6-01` | 35 | `success` | 64 | 1 | **0.9565 PASS** |
| `ram-t6-02` | 35 | `error_max_turns` | 97 | 1 | 0.4783 |
| `ram-t6-03` | 35 | `error_max_turns` | 109 | **0** | 0 |
| `ram-t6-04` | 35 | `error_max_turns` | 82 | **0** | 0 |
| `ram-t6-05` | **120** | `success` | 167 | 2 | **0.9130 PASS** |

**Three of the four students at the shipped default never submitted at all** — they
were killed mid-verification. Checked directly: `ram-t6-03`'s last calls were
`write_file parse10.mjs` → `run_script parse10.mjs` (its 10th parser, still parsing
Scorptec/Bunnings HTML); `ram-t6-04` was writing `amz.mjs`. Neither was looping or
stuck. They were working.

**The student that passed at the default was the one that did the least work** — 64
tool calls, the lowest of all five. The cap does not select for correctness; it
selects for brevity.

So "1 pass in 2" from last week, and "1 pass in 4" this week, are **not pass rates**.
They are the rate at which a student happens to finish under a budget most students
exceed.

## The control: given room, the student finds everything

`ram-t6-05`, identical except `--max-turns 120`:

- submission 1: 18/22 truths, 2 unkeyed → 0.6522
- submission 2: **22 of 22 truths, zero traps** → **0.9130 PASS**

`1 − 2/23 = 0.913`; the only penalty left is a single unkeyed URL (below). It found
**every truth on the board** — including the JB Hi-Fi `?variant=` URL that
`ram-t6-01` missed.

Between the two submissions it dropped the unkeyed `amazon.com.au` URL and added
four truths. That is legitimate refinement on judge feedback, **not T4's
enumeration** — with 22 truths and `MAX_SUBMISSIONS: 3` a board cannot be read off,
and the guard (`world-mcp.ts:180`) has ample margin.

## The unkeyed-URL flag is now costing real points

Last week I flagged that `bunnings.com.au` and `amazon.com.au` are reachable but
**neither truth nor trap**, so `judge.ts` falls through to `unknownShown: 2`. On a
board where the student now finds 22/22 truths, that gap is the *entire* remaining
penalty: a perfect truth sweep scores 0.913 instead of 1.0 because of one unkeyed
Bunnings page.

Still unruled, and I still have not opened either screenshot — verified only that
both are unkeyed and cost 2 points each.

## What changed in the repo

`scripts/exam-cli.mjs` — `--max-turns` is now a CLI arg, **default unchanged at 35**:

```js
"--max-turns", arg("max-turns", "35"),
```

Nothing else moved. `passMark`, weights and `MAX_SUBMISSIONS` untouched, per the
brief's flag-don't-fix rule. **I did not change the default** — whether 35 is the
intended budget is Patrick's call, and every historical number was measured under it.

## Consequences for every prior RAM number

T2's `cc-01` curve (0.6087 → 0.5652 → 0.5652 → 0.3913 → 0.5652, "a curve that got
*worse*") was measured under this same cap. **Those episodes may have been truncated
too** — a declining curve is exactly what you would see if longer, more thorough
attempts got cut off. That reading is unverified: I did not re-open `cc-01`'s streams
for `error_max_turns`. It is a 2-minute check and the next run should do it before
anyone cites the no-learning finding again.

## Burn

3 episodes this run: 275 s + 214 s + 521 s = **1010 s (16.8 min)**, 79.5K output
tokens, ~15.8M cache read, **$0 metered** (≈ $19 API-equiv). Cumulative T6: 5
students, 8.6 min of model time beyond that. Wall clock remains the only constraint.

## Next

1. **Replicate the raised-cap control** — `ram-t6-05` is n=1. Run 3–4 more at
   `--max-turns 120` for a real pass rate. ~8.7 min each; budget 2 per 45-min run.
2. **Grep the T2 streams for `error_max_turns`** before citing that curve again.
3. Rule on the unkeyed URLs and on whether 35 was ever the intended budget.

## Follow-up, same run: T2's "curve got worse" is partly a truncation artifact

I ran the 2-minute check recommended above rather than leaving it for next week.
`students/cc-01` (T2, sonnet, the project's canonical no-learning result):

| episode | result subtype | tool calls | score |
|---|---|---|---|
| 1 | `success` | 57 | 0.6087 |
| 2 | **`error_max_turns`** | 69 | 0.5652 |
| 3 | `success` | 62 | 0.5652 |
| 4 | **`error_max_turns`** | 52 | **0.3913** |
| 5 | `success` | 38 | 0.5652 |

**Two of the five episodes were truncated, and one of them is the 0.3913 dip** that
has been cited as evidence the student got *worse* over time. It did not get worse
in episode 4; it got cut off.

Read only the three clean episodes: **0.6087 → 0.5652 → 0.5652.** So:

- **"The curve got worse" is dead.** That framing rested on a truncated point and
  should stop being repeated (it is in the brief, the TEST-PLAN Log, and NOTES).
- **"No compounding" survives, weakened.** Three uncontaminated episodes show flat,
  slightly-down, and no improvement. That is still no learning — but it is a much
  weaker claim than a decline, and it rests on n=3.

This does not overturn T2's conclusion. It removes the most dramatic evidence for it.

## Replication attempt `ram-t6-06` — partial, and the unkeyed URL is now decisive

Killed at 600 s by **my own Bash tool timeout, not by the harness or the turn cap**
— it was still working, with 2 of its 3 submissions unused. One submission banked:

**21 of 22 truths, zero traps, one unkeyed URL → 0.8696.**

`1 − 3/23`, where the 3 is 1 missed truth + **2 for the unkeyed Bunnings page**.

That single unkeyed URL is the whole difference between failing and passing:
without it the same board scores `1 − 1/23` = **0.9565, a pass.**

Both raised-cap students independently submitted the Bunnings URL (`ram-t6-05` in
submission 1, `ram-t6-06` in its only one). It is not one student's misjudgement —
the world surfaces it and students repeatedly conclude it belongs. It is keyed as
neither truth nor trap, so it silently costs 2 under `unknownShown`.

**This escalates the unkeyed-URL flag from "costs points" to "decides pass/fail".**

Raised-cap tally so far: `ram-t6-05` **0.9130 PASS** (22/22 truths), `ram-t6-06`
0.8696 on a truncated-by-tooling run (21/22). Neither missed on capability; both were
limited by the key's coverage or by a clock. **Still n=2 — replicate before quoting
a rate.** Next run: 2 students at `--max-turns 120`, and give each a >10-minute
timeout (these take 520–600 s+).

---

# T6c — 2026-08-26: at a workable cap, everyone who finished passed

**Students:** `ram-t6-07`, `ram-t6-08` · `--max-turns 120` · `claude-opus-5` ·
key re-verified `certifiedAt: 2026-08-07`, 34/22/33.

## Raised-cap tally (all four students to date)

| student | outcome | truths | traps | unkeyed | score |
|---|---|---|---|---|---|
| `ram-t6-05` | finished | 22/22 | 0 | 1 | **0.9130 PASS** |
| `ram-t6-06` | killed by my 600 s Bash timeout | 21/22 | 0 | 1 | 0.8696 |
| `ram-t6-07` | finished | 21/22 | 0 | 0 | **0.9565 PASS** |
| `ram-t6-08` | killed by my 600 s Bash timeout | 21/22 | 0 | 1 | 0.8696 |

**Both students that were allowed to finish passed. 2 of 2.** The two that did not
were killed by *my Bash tool's 10-minute ceiling* — not the harness, not the turn
cap, not the exam — each with 2 of its 3 submissions still unused.

Both truncated students sat at 0.8696, and in both cases **the sole penalty was the
unkeyed Bunnings URL**. Whether they would have recovered is not something I can
claim: they were never allowed to try. `ram-t6-07` shows the recovery path exists.

Note the tooling bias: a 600 s ceiling **systematically under-reports** the pass
rate, because a student is killed at whatever it has banked so far.

## `ram-t6-07`: the winning move is to delete correct-looking answers

| submission | shown | truths | unkeyed | score |
|---|---|---|---|---|
| 1 | 18 | 18/22 | 0 | 0.8261 |
| 2 | 24 | **21/22** | **3** | **0.6957** — more truths, worse score |
| 3 | 21 | 21/22 | 0 | **0.9565 PASS** |

Submission 2 found three *more* truths than submission 1 and scored *lower*, because
it added three unkeyed URLs (mwave, amazon.com.au, bunnings) at minus 2 each.
Submission 3 passed by **deleting them again**.

So the strategy the exam actually rewards is: propose, get punished for pages that
match the request, then remove them until the number goes up. That is judge-gaming,
not finding RAM. It is the same shape as T4's enumeration, one level up — and unlike
T4 it is not blocked by the `MAX_SUBMISSIONS` guard, because it needs only 3 tries.

## The key omits genuine product pages — now with evidence

Last week I flagged this without opening anything. This week I read the recorded
bodies. Of 10 reachable-but-unkeyed pages whose titles match G.Skill 32 GB, seven are
search-engine result pages (bing, duckduckgo, staticice) — fine to leave unkeyed,
though arguably they should be explicit traps. **Three are real product pages:**

- **`bunnings.com.au/...f4-3200c16d-32gtzr`** — title `G.Skill Trident Z RGB
  32GB(2x 16GB) DDR4-3200 Memory [F4-3200C16D-32GTZR] - Bunnings Australia`, body
  reads `Marketplace | Online only` then the price and `Add to Cart`. **This is
  exactly what the request asks for**: G.Skill, 32 GB, 2x16, DDR4, orderable today.
  It is priced absurdly (474.53 AUD against keyed truths at ~349) but the request
  says nothing about price, and `judge.ts` never reads `priceAud`. Correcting my
  earlier note: I assumed "a hardware chain, excluding it is right" — the recorded
  page says otherwise.
- **`scorptec.com.au/.../78085-f4-3600c16d-32gtznc`** — `G.Skill F4-3600C16D-32GTZNC
  Trident Z Neo 32GB 3600MHz DDR4 | Scorptec`. **Same retailer as three keyed
  truths**, same product family, unkeyed.
- **`amazon.com.au/...B07Z86BMCQ`** — `G.Skill RipjawsV 2x16GB 3600 MHz DIMM DDR4`.
  Right part; **stock state I could not determine** — the availability block's text
  did not survive the recording in a form I could read by grep, and there is no
  capture screenshot. Genuinely unresolved, not quietly assumed.

**Neither Bunnings nor Amazon has a capture screenshot at all** (`capture/` has no
record for either URL), so they cannot be adjudicated the way the books-v1 and
ram-v1 audits were. That is itself the gap: the key was certified against the shots
it lists, and these pages have none.

`mwave.com.au` product URLs are recorded with **zero-length bodies** — only its
`trending/32gb-ddr4-ram` category page has content. So the mwave URL `ram-t6-07`
submitted is both unkeyed *and* bodyless.

## Amazon resolved: it is un-adjudicable, and that is a recording defect

I said above that Amazon's stock state "could not be determined". Ran that to
ground rather than leaving it hanging. In the full 1,079,917-byte recorded body:

| marker | present? |
|---|---|
| `in stock` (any case) | **no** |
| `Currently unavailable` | **no** |
| `id="add-to-cart-button"` | **no** |
| `id="buy-now-button"` | **no** |
| `outOfStock` | **no** |

The `availability_feature_div` exists but is **empty** — its next sibling is the
following feature div. Amazon renders its buybox client-side and `recordingFetch`
captured the pre-JS HTML, so the entire availability region is missing.

So this is not "I could not find it". **It is not there for anyone** — no student
can determine buyability from this page either, and no reviewer could certify it.

That splits the three unkeyed product pages cleanly:

- **Bunnings — adjudicable and matching.** Its body carries the price and
  `Add to Cart`. It should be keyed, and on the request's literal terms it looks
  like a truth.
- **Scorptec 78085 — adjudicable** (normal recorded product page, same retailer as
  three keyed truths). Should be keyed.
- **Amazon B07Z86BMCQ — NOT adjudicable from this recording.** Keying it either way
  would be a guess. It needs re-recording through the Playwright-rendered DOM (the
  path `recordingFetch` already uses for 403s) before anyone can rule on it.

## What this means for the ruling

The unkeyed URLs are no longer a scoring curiosity. They are:

1. **Deciding pass/fail** — the sole penalty on both truncated students.
2. **Teaching the wrong lesson** — the pass came from removing matching products.
3. **At least partly correct answers** — Bunnings on the request's literal terms.

Still nothing changed on disk: `passMark`, weights, `MAX_SUBMISSIONS` and the key are
untouched, and I did not move the `--max-turns` default off 35.

## Burn

2 episodes: 506 s + 600 s (killed) = **18.4 min**, ~39K output on the completed one,
**$0 metered**. Cumulative RAM work across 08-12 / 08-19 / 08-26: 8 students.

## Next

1. **Rule on the three unkeyed product pages** — this now gates any honest RAM number.
2. **Re-run 06 and 08 with a budget over 600 s** to convert the pass rate from 2-of-2
   into 4-of-4 or find a real failure. The Bash tool caps at 600 s, so this needs
   either a smaller `--max-turns` (~90) or a different invocation path.
3. Compounding remains untested — the runner still exits on pass.
