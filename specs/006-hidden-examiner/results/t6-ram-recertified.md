# T6 — RAM (exam #1) re-run against the certified key: **PASSED, first episode**

**Date:** 2026-08-12 · **Student:** `ram-t6-01` (fresh) · **Model:** `claude-opus-5`
**Exam:** `ddr4-gskill` on `worlds/ram-v1` (key `certifiedAt: 2026-08-07`, verified before spending)

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

## Caveats — do not over-read this

- **Not a controlled A/B.** sonnet→Opus and the recorder fix both moved. The jump
  is real but its cause is not isolated.
- **One exam.** `ddr4-open` (31 of 34) and `ddr5-6000` (30 of 33) were not run.
- **One episode, one student.** See the replication note below.
- Scores remain incomparable across key changes and models, as always.
