# Spec 007 — The Student

## Problem

The harness has a licence (it can drive the Find-Me-X process, deterministically
and provably). It cannot build the car: a new domain today costs a human-led
babysitting campaign. The true goal is an agent that teaches *itself* to build
the machinery — and you can only teach yourself what you can grade yourself on.
Spec 006 provides the grader. This spec defines the learner.

## Goal

A blank-slate agent with primitive tools, no domain context, and no knowledge
of how it is graded, that converges on passing the Hidden Examiner's exam by
building its own skills — and whose skills transfer to a second domain faster
than the first (the test of generality).

The Student inherits the harness's constitution, generalised from a search
loop to a learner's life:

| Harness law | Student equivalent |
|---|---|
| Law 5 — AI proposes, engine disposes | The Student proposes an answer; only the Judge's verdict ends the task. **It can never declare success.** |
| E3 — hard budget caps, termination guaranteed | Episodes have hard budgets. A rabbit hole can consume at most one episode. |
| E4 — widen only on improvement, else honest stop | Score flat across N episodes → the approach is dead; change it structurally. |
| Honest stop | An episode that runs out of budget ends in honest failure, never fake success. |

## The Constitution (the entire system prompt)

Litmus test for every line: **is this a rule of its world, or a hint about the
answer?** Rules in; hints out. Discovering the hints is the exam.

IN (rules of the world):

1. You have these tools: `search`, `fetch`, `screenshot`, `read_screenshot`,
   `write_file`, `submit_answer`. *(No rationale given.)*
2. Serve the user's request.
3. You may call `submit_answer` at most **3 times per episode**. Each returns a
   score, category hints, and pass/fail.
4. **You cannot decide you have succeeded. Only a pass verdict ends the task.**
5. Each episode has a hard budget (time/tokens/tool calls). Your files persist
   between episodes.
6. If your score has not improved across several episodes, your approach is
   wrong — change it structurally, do not refine it.

OUT (exam content — must never appear in any prompt, tool description, or
error message):

- That screenshots are the trust anchor. That availability must be proven.
- That stores have catalog/inventory pages. That part numbers are identity.
- What a good answer looks like. What "verification" means.
- That the judge is a harness, that the domain is RAM, that traps exist.

The task lives entirely in the **user request**, phrased as a real user would:
*"find me a 2×16GB DDR4 3200 kit I can actually buy right now."* A natural
request smuggles in the success criteria the way reality does — the student
that learns to hear "actually buy right now" is learning the right skill.

## Episode lifecycle

```
episode begins (fresh context, persistent workspace mounted)
  → work with primitives; build/refine skill files
  → self-verify until confident        ← scarcity of submissions FORCES
  → spend a submission                    the student to internalise
  → score + category hints + verdict     its own examiner
  → pass? → done. budget/attempts out? → honest failure
episode ends; skills and score history persist; next episode begins
score flat across N episodes → forced structural change (rule 6)
```

Submission scarcity is the load-bearing design choice: with free unlimited
grading the agent hill-climbs on the judge (oracle probing / Goodhart); with
3 per episode it must build internal verification to decide when asking is
worth it — which is the very capability we are trying to grow.

## Cost & test plan (why this is not $1M in tokens)

- **Frozen world (Spec 006)** removes all live fetch/render cost; vision reads
  on cached images are cached. Trials are reproducible.
- **Episode budgets are spend caps.** ~200K in / 20K out per episode:
  Haiku 4.5 ≈ $0.30/episode → a 100-episode convergence experiment ≈ **$30**.
  Sonnet ≈ $1.50/episode ≈ $150. Prompt caching cuts input further.
- **Model ladder:** shake down the protocol with Haiku (cheap student finds
  cheap bugs), run the real question on Sonnet, pay Opus prices only if
  capability blocks convergence. The ladder itself is data: how much raw
  capability does self-teaching require?
- **Micro-world first:** 5–6 retailers, 3 specs, ~20-item key. Scale worlds
  only after passes happen.

## Behavioural claims

**C1 — Blank slate.** The Student starts with no domain context, no harness
artifacts, no sales-page guide, no catalog URLs. Nothing the RAM prototype
learned may leak in (the prototype is faculty, never template).

**C2 — External termination.** No code path allows the Student to end the task
on its own judgment. Pass verdict or nothing.

**C3 — Budgeted submissions.** ≤3 per episode; the count is enforced by the
runner, not requested of the model.

**C4 — Episodic existence.** Hard per-episode budget enforced by the runner.
Workspace (skill files, notes, score history) persists across episodes;
conversation context does not.

**C5 — Stagnation rule.** The runner injects the score history each episode;
the constitution requires structural change after N flat episodes. Persistence
without obsession.

**C6 — Natural-language task.** The request is realistic user phrasing. No
rubric language ("verify availability", "confirm identity") ever appears in it.

**C7 — Measurable outcomes.** The experiment's readouts: score curve over
episodes, episodes-to-pass, submission efficiency (score gained per submission
spent), and the skill files themselves — do they rediscover the catalog-page
door, the notify-me rule, the identity ladder? Do they find something we
didn't?

**C8 — Graduation and the generality test.** Passing exam #1 (RAM world)
graduates the protocol. Generality is claimed only if the same Student (with
its persisted skills) passes exam #2 — a different domain with a hand-verified
key — in materially fewer episodes than exam #1. Skills that don't transfer
were memorisation, not learning.

## Out of scope (v1)

- Live-web operation (the Student trains in the frozen world only).
- Fine-tuning or any weight updates — all learning lives in the skill files.
- Multi-agent students, self-play, or student-as-key-maker (bootstrapping
  waits for a certified graduation).
- Automating the human's design rulings (values questions like "does
  supplier-stock count as available?" are discovered by the Student as
  clusters, escalated as questions — never answered by it).
