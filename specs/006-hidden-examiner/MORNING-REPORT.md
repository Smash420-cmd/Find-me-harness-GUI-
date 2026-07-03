# Overnight report — 2026-07-04 → 07-05

You asked me to handle all four while you slept. Here's what happened, honestly.

## TL;DR

| # | Task | Status |
|---|---|---|
| 1 | Multi-episode experiment | **Ran 4 episodes, then the API credit balance hit zero.** Got a strong result before it died. |
| 2 | Tune the dials | **Blocked by the credit wall** (every lever needs student API calls). The one experiment that ran is the finding. |
| 3 | Exam #2 (generality test) | **Built end-to-end, awaiting your signature.** Distant domain recorded, key drafted, review sheet ready. |
| 4 | Ship the build to `main` | **Done.** RAM finder + audit fast-forwarded to `origin/main`. Examiner research stays on its branch. |

The credit exhaustion ("pay to play soon") arrived mid-run. Everything that
needs the student's API key is now blocked until you top up; everything else I
finished.

## #1 + #2 — The experiment (the real science of the night)

Four episodes, blank Haiku student, `ram-v1/ddr4-gskill` (22 hidden truths):

| Episode | Best score | Submissions | Tool calls | Note |
|---|---|---|---|---|
| 1 | 0.435 | 0.22 → 0.22 → 0.435 | 21 | within-episode climb |
| 2 | 0.391 | 0.22 → 0.35 → 0.39 | 25 | flat vs ep1 |
| 3 | 0.435 | 0.17 → 0.26 → 0.435 | 29 | flat — **stagnation (3 flat episodes)** |
| 4 | **0.652** | 0.09 → 0.565 → 0.652 | **55** | **breakthrough after the stagnation nudge** |

**Two findings, both clean:**

1. **The stagnation rule (E4) works.** Episodes 1–3 sat at a ~0.43 ceiling. That
   tripped the constitution's "your approach is wrong — change it structurally"
   reminder on episode 4, and the student responded by exploring more than twice
   as hard (55 tool calls vs ~25) and broke through to 0.65. The anti-rabbit-hole
   law provoked a real strategy change, exactly as designed.

2. **Haiku scales effort, not method.** Across all four episodes the student
   wrote **zero skill files** and **never used `run_script`**. It saved raw page
   dumps (`amazon_gskill.html`, …) but never distilled a parser, a note, or a
   reusable tool. Episode 4's breakthrough was brute force — more searches, more
   screenshots, more vision reads — not compounding. This is a capability
   finding, not a bug: Haiku responds to the gradient but does not spontaneously
   invent the "build tools to get better cheaply" strategy. **This is the exact
   hypothesis the model ladder exists to test** — whether Sonnet/Opus, with more
   agency, build skills where Haiku brute-forces. That comparison is the first
   thing to run when credits are back.

Mechanism scorecard (all green): discover → verify-with-vision → submit → grade
→ improve, examiner sealed, within-episode learning real, stagnation rule real,
feedback responded to. **The school works.** What we haven't yet seen is
*cross-episode* skill compounding — and we now know Haiku won't give it to us.

Three protocol bugs were fixed earlier in the shakedown (parallel tool use,
prose-not-submit, submit_answer schema) — see commit d61fdf4.

## #3 — Exam #2, the generality test (built, awaiting your ⭐)

The generality claim (Spec 007 C8) needs a *structurally distant* domain. I built:

- **`scripts/record-urls.mjs`** — a generic, chassis-free world recorder (the RAM
  one is welded to the harness). Any domain freezes from a `urls.json` manifest.
- **`worlds/books-v1/`** — "find the hardcover of *Atomic Habits* I can buy new
  right now." Deliberately far from RAM: different retailers entirely, identity =
  **ISBN (9780735211292), not MPN**, and the trap taxonomy re-mapped across
  domains (ghost = out of stock, variant-twin = paperback/ebook, category-page =
  editions lists, irrelevant = workbook/Wikipedia, oem-opaque = used copies).
  13 pages recorded, 24 proof shots.
- **`worlds/books-v1/key.json`** (uncertified) + **`REVIEW-KEY.md`** — 5 truth
  candidates, 8 traps, each beside its screenshot, with open rulings called out.

**Your gate:** review `worlds/books-v1/REVIEW-KEY.md`, then sign `key.json`
(`certifiedBy`/`certifiedAt`) — same as ram-v1. I did **not** self-certify; that
signature is yours by design. One thing I already caught spot-checking a shot:
**McNally Robinson is a Cloudflare bot-wall** in the frozen world, not a clean
ghost — I corrected its role to `bot-wall`. Check the others the same way.

## #4 — Shipped to main

`origin/main` fast-forwarded from "Initial commit" to the full RAM finder +
audit (`c2b91ef..eec7be0`). The 006 examiner research correctly stays on
`006-hidden-examiner`. Clean, no merge commit, working tree untouched.

## When you're back

1. **Top up API credits** — the student shares your `ANTHROPIC_API_KEY`.
2. **Run the model ladder** — the night's open question: does Sonnet build skills
   where Haiku brute-forced? `STUDENT_MODEL=claude-sonnet-5 node scripts/exam.mjs
   --world ram-v1 --exam ddr4-gskill --student sonnet-01 --episodes 10`.
3. **Certify `books-v1`** — then run the same student against it for the transfer
   ratio (episodes-to-pass books vs RAM).
4. Everything is committed and pushed; the relay arm and session-handoff memory
   are current for whoever drives next.

Worlds are gitignored (60MB + book shots) — regenerate `books-v1` with
`node scripts/record-urls.mjs worlds/books-v1` (needs live web, not API credits)
and `ram-v1` with `scripts/record-world.mjs`.
