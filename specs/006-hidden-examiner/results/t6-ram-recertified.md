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
