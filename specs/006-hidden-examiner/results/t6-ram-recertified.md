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
