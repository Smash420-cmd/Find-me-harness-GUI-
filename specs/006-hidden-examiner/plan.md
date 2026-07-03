# Plan 006 — The Hidden Examiner (+ Spec 007, The Student)

## Architectural decisions

**1. The recording seam is the provider boundary.** The tool belt is not
touched. `fetchText` and `PlaywrightValidator` get record/replay decorators —
the belt talks to a world that is either live (recording) or canned
(replaying). The frozen world is a *provider*, not a fork of the harness
(Law 7: the seam is a boundary, not a rewrite).

**2. Exam code lives outside the four pools.** New top-level `src/exam/`.
The examiner is scaffolding AROUND the harness — the Machine, Orchestrator,
Tool Belt, and GUI never import from it. `src/exam/` may import the harness
(it runs it to mint answer keys); never the reverse. `scripts/analyze-seam.mjs`
gains this rule.

**3. Nothing exam-related enters the Student's context except its
constitution.** Tool descriptions are one neutral line each. Error messages
from replayed tools are the real errors the live web produced (a 403 is a 403).

## Recording format

One directory per world: `worlds/<name>/`

```
worlds/ram-v1/
  manifest.json          # specs under exam, retailers, trap inventory, noise ratio
  key.json               # the answer key (see Step 4) — NEVER readable by Student tools
  fetch/<sha256>.json    # { url, status, body } keyed by hash(url)
  browse/<sha256>.json   # { url, extractJs, result[] } keyed by hash(url + extractJs)
  capture/<sha256>.json  # { url, fields } + <sha256>.png (the proof shot)
  vision/<sha256>.json   # { imageHash, prompt, response } — read_screenshot cache
```

Replay miss policy: in exam mode a miss returns the world's "walled" response
(404/timeout), never a live fetch — the Student cannot escape the snapshot.
In record mode a miss goes live and is written down.

## Steps

### Step 1 — `src/exam/world.ts`: record/replay providers
- `RecordingFetch(fetchText, dir)` and `ReplayFetch(dir)` — same signature as
  `fetchText`.
- `RecordingValidator(validator, dir)` / `ReplayValidator(dir)` — implement
  `IValidationProvider` + `browse`. Replay capture returns the stored fields
  and the stored PNG path.
- Env switch on the server: `WORLD_MODE=record|replay WORLD_DIR=worlds/ram-v1`.
- Check: record a run, replay it, assert byte-identical scan output. This step
  is the harness's regression environment and is worth shipping alone.

### Step 2 — `worlds/ram-v1/`: record the exam world + pin the specimens
- Record 3 specs (DDR4 32GB 2×16 open; + gskill brand; DDR5 32GB 2×16 6000)
  through the full harness against the live web.
- Harvest the trap taxonomy from Spec 006's table: replay-fetch each specimen
  URL from the logs/AUDIT.md into the world (record mode, one-off script
  `scripts/pin-specimens.mjs`). manifest.json labels each with its trap
  category. Preserve the real ~7:1 noise:treasure ratio.

### Step 3 — ⭐ `key.json`: mint and certify the answer key (human-gated)
- Run the harness in replay mode against the world for each exam spec; its
  verdicts (shown items, prices, crown; per-URL drop reasons) become the key.
- Human audit per the AUDIT.md procedure — every key entry eyeballed against
  its stored proof shot. The key file records `certifiedBy` + date.
- A key without certification refuses to grade (loader throws).

### Step 4 — `src/exam/judge.ts`: the Judge (pure function, test-first)
- `judge(submission, key) → { score, categories, pass }`.
- Asymmetric loss (weights in key.json): irrelevant-shown ≫ ghost-shown ≈
  wrong-SKU-shown > real-missed. Crown-on-wrong-item is scored as ghost-shown.
- Category hints only: `coverage | availability | identity | relevance |
  honesty`. Never item-level.
- Deterministic: same submission → same score. Vitest with fabricated
  submissions covering every trap category.

### Step 5 — `src/exam/episode.ts`: the episode runner
- Enforces (never requests): token/tool-call budget, ≤3 submissions, wall
  clock. Episode ends on pass, budget out, or attempts out — honest failure.
- Persistent workspace dir per student (`students/<id>/`): skill files, notes,
  score history. Fresh conversation each episode; runner injects score history
  + episode number at start.
- Stagnation guard: flat best-score across N=3 episodes → runner prepends the
  constitution's rule-6 reminder verbatim.
- Transcript of every episode written to `students/<id>/episodes/<n>.json`
  (the experiment's readout).

### Step 6 — `src/exam/student.ts`: constitution + primitive tools
- System prompt: the constitution from Spec 007, verbatim, nothing else.
- Tools (all replay-backed): `search`, `fetch`, `screenshot`,
  `read_screenshot` (vision via LLM provider, cached in `vision/`),
  `write_file` (workspace-jailed), `submit_answer` (→ Judge).
- Model from env (`STUDENT_MODEL`), Haiku 4.5 default for shakedown.
- Requests phrased naturally (from manifest.json), e.g. "find me a 2x16GB
  DDR4 3200 kit I can actually buy right now".

### Step 7 — Shakedown, then the experiment
- `scripts/exam.mjs --world ram-v1 --student haiku-01 --episodes 20`.
- Shakedown goal: the PROTOCOL survives contact (budgets enforced, no key
  leakage in any tool output, transcripts complete) — not a pass.
- Then the real run on Sonnet. Readouts per Spec 007 C7: score curve,
  episodes-to-pass, submission efficiency, and the skill files themselves.

## Order & gates

1 → 2 → 3⭐ → 4 → 5 → 6 → 7. Step 1 ships value alone (regression worlds).
Steps 3 (key certification) and any change to the Judge's weights are
human-gated — the examiner's integrity is the experiment's integrity.

## Out of scope (this plan)

Live-web exams, exam #2's world (new plan when we get a graduation),
distillation of Student skills back into the harness.
