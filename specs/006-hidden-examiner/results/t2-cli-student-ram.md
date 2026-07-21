# T2 — CLI student on RAM (on Max, free): COMPLETE, no pass, no compounding

**Run:** 2026-07-22, student `cc-01`, world `ram-v1`, exam `ddr4-gskill`, 5 episodes, model sonnet.

## BURN (measured, the point of this run)

| metric | value |
|---|---|
| wall-clock | **17 min** (09:01–09:18) for all 5 episodes |
| model time | 15.5 min |
| turns | 232 total (36–63 per episode) |
| output tokens | **75,111** |
| cache-write tokens | 497,590 |
| cache-read tokens | 9,333,069 |
| fresh input tokens | 316 |
| notional API-equivalent | **≈ $5.80** (Sonnet pricing) |

Weekly-quota fraction: no programmatic weekly meter exists; the 5-hour block
this ran in read $20.96 total via ccusage — and most of that was the Fable
**orchestrator session, which out-burned the exam itself**. The exam alone
(~$6 equivalent) is a rounding error against a Max 20x week: T3 (8 eps ≈ $9)
and T4 (15 eps ≈ $18) both fit trivially. Scaling is governed by wall-clock
(~3.5 min/episode) and the 5-hour block, not tokens.

## Score curve

**0.6087 → 0.5652 → 0.5652 → 0.3913 → 0.5652** — best 0.6087 in episode 1,
never beaten. 14 of 15 possible submissions used. No pass (≥0.9), no upward
trend. The stagnation nudge in episode 5 did not break the plateau.

## The compounding question — answered, and it's the interesting kind of no

Mechanics all work: every episode used the full toolkit (per-episode averages:
~21 fetch, ~16 search, ~8 run_script, ~8 write_file). The student wrote dozens
of small parser scripts (`check*.mjs`, `parse*.mjs`) and ran them over saved
HTML — within-episode tool-building is real and fluent.

**Across episodes it built memory but never used it.** Episode 2 wrote
`episode2-notes.md` — an excellent artifact: it correctly reverse-engineered
the recall-heavy scoring ("more URLs = monotonically better: 3→0.17, 8→0.39,
12→0.57"), listed 12 verified in-stock URLs, diagnosed dead ends (techbuy 404s,
Bunnings JS buybox), and left a numbered next-episode plan. Episodes 3–5
referenced that file **zero times** and no episode ever listed the workspace
(0 readdir calls in any episode) — despite the constitution stating "Files you
write persist between episodes." Each fresh episode re-derived everything from
scratch, re-fetching the same pages under new names (msy.html, msy1, m1…).

Diagnosis: the persistence affordance is stated but nothing cues a fresh
episode that a *past self already left artifacts*, and there is no list/read
file tool — reading own files requires the non-obvious `run_script` +
`fs.readFileSync` hop. Whether to add a cue is a design question, not a bug:
the exam exists to see if the agent discovers this. Recorded as-is.

Note per plan: this student is Claude Code (sonnet), not blank-slate — this
measures the practical agent, not pure self-teaching.

## Shakedown fixes to exam-cli.mjs (expected first-run work, committed)

1. `--tools ""` + `--strict-mcp-config` replace the `--disallowedTools` list —
   verified live: exactly the 7 `mcp__world__*` tools, built-ins hidden, and
   the user's other MCP servers (Gmail/Drive/Supabase) blocked.
2. `spawn` without `shell: true` — on Windows shell-mode word-split the prompt;
   claude received the single word "find". Cost run 1's episode.
3. `--model` flag (default `sonnet`) — session default was Fable, too dear.
4. Usage capture from the stream-json result event → per-episode readout +
   BURN totals (this is where the numbers above come from).
5. `.gitignore`: `students/` now fully ignored (stream logs embed scraped HTML).

## Relay operational lesson (cost the 07-08 and 07-15 runs entirely)

Never run the exam as a background task and end the turn: Relay tears down the
host process at turn end, killing the child `claude` mid-episode with nothing
scored. Episodes must run in the foreground, one `--episodes N` increment per
call. Now in the task NOTES.md.

## Cascade decision

T2 finished with 41 min left in the 5-hour block; T3 needs ~30 min plus
writeup — clipping risk, so per iron rule 3 this run stops here. T3 is next
week's first unchecked test.
