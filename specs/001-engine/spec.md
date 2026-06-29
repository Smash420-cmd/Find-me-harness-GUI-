# Spec 001 — The Engine (general hemisphere)

**Artifact:** `spec.md` · **Phase:** 1 (Specify) · **Scope:** the WHAT + WHY,
**no tech stack** · **Governs:** everything identical across every chassis ·
**Obeys:** `constitution.md` (all 11 laws)

> The engine is everything that is identical across every chassis. It contains
> **no domain word** — no `RAM`, no `price`, no `SKU`. It speaks only in `Spec`,
> `Candidate`, `VerifiedResult`, `ProofShot`. (Constitution Law 7.)

---

## Why this exists

The harness inverts ordinary search: **AI proposes, the engine disposes.** A
model can *suggest* candidates cheaply and fuzzily, but suggestions are noise
until something proves they are **correct** (the right thing) and **real**
(actually available). The engine is that proving machine — the thin, reusable
loop that filters the noise and proves what's real, then hands verified,
proof-carrying results to whatever chassis asked.

The value is the seam: build the proving loop **once**, domain-free, and every
future domain (RAM, GPUs, anything) is a small chassis that bolts on — not a new
codebase. This spec defines that loop and the contract a chassis must satisfy to
mount it.

---

## The mounting-point contract (what a chassis must supply)

A chassis provides exactly three things, and nothing else:

1. **Spec schema** — what a valid request looks like in this domain.
2. **Verification contract** — deterministic: is this candidate **correct**
   (the right thing) and **real** (actually available)?
3. **Ranking** — what "best" means here, over verified survivors only.

Plus the **sources** the fan-out may consume for this domain.

The engine returns, to any chassis, a stream of `VerifiedResult` — each carrying
a `ProofShot` and a composed `Confidence`. **The engine never knows what domain
it is serving.**

---

## The loop (behaviour, as testable claims)

```
converge(intent) → Spec
   → observe(Spec)          # broad, cheap candidate gathering
   → fanOut(candidates)     # parallel, bounded, per-capture timeout
   → verify(each)           # CHASSIS contract, via tiered escalation
   → policyFilter(spec)     # user constraints, on verified candidates only
   → synthesise()           # drop failures, rank survivors (CHASSIS.rank)
   → confidenceGate()       # composed score: good enough?
       ├─ yes → stream
       └─ no  → loopWider() # bounded: retries ∧ wallclock ∧ improved
   → stream(VerifiedResult) # proof-shots, as they resolve
```

### The two doors (convergence)
Two ways intent becomes a `Spec`; both yield the **same** `Spec`, and everything
after convergence is blind to which door was used:

- **Deterministic door** — structured input maps directly to a `Spec`, zero LLM.
  By construction it *can only produce valid specs*.
- **Conversational door** — dialogue converges to a `Spec` via LLM for fuzzy
  intent, then steps aside. It owns the single clarifying-question path and the
  impossible-spec rejection (→ `SpecInvalidError`).

### Tiered verification (engine routes; chassis supplies the rules)
The engine routes **cheapest-first** through tiers; the chassis supplies the
rules each tier applies. A source's declared capabilities decide which tiers are
available for it.

| Tier | Engine action | Chassis supplies |
| :--- | :--- | :--- |
| 0 Cache | recall a *fact* (never liveness) | what key identifies a candidate |
| 1 API | call source API if declared | how to read the stock flag |
| 2 DOM | fetch HTML | the "unavailable" predicate |
| 3 Vision | capture → **proof-shot** | what the proof must show |

**Graceful degradation:** if a tier fails (capture times out, an API is down),
the engine falls back to the next-cheapest tier that can still verify and
**flags the composed confidence accordingly** — a degraded verification is
allowed; a *missing* one is not. The proof-shot law still holds: if no tier can
produce the required proof, the candidate is **dropped**, not shown degraded.

### Policy filter
A configurable, deterministic filter on the user's own constraints. It runs
**after** verification (only ever filters real, verified candidates) and
**before** ranking. Distinct from verification: verification asks *is it real
and correct?*; policy asks *does the user want this kind of real-correct thing?*
The constraint vocabulary is chassis-specific; the engine applies it uniformly.

---

## Acceptance criteria (the engine's contract — all domain-free, all testable)

| ID | Claim |
| :-- | :--- |
| **E1** | No `VerifiedResult` is emitted without a passing `ProofShot`. |
| **E2** | A superseded run's late results never reach the stream. |
| **E3** | The loop terminates under **all** inputs (max-iterations ∧ wall-clock). |
| **E4** | `loopWider` fires only if the previous pass *improved* the result. |
| **E5** | Every emitted result carries a composed `Confidence`; sub-threshold results (default <85%, chassis-configurable) are **flagged**, never silently dropped or silently promoted. |
| **E6** | No engine module imports from a chassis module (separation law). |

**E3 and E4 are universally-quantified claims** ("for all inputs") — they are to
be proven by property/fuzz testing, not example tests alone.

---

## Named errors (engine vocabulary)

No generic `throw`. Engine-level errors: `SupersededRunError`,
`LoopBudgetExceededError`, `SourceUnavailableError`. Chassis-level errors
(`SpecInvalidError`, `GhostDroppedError`) are thrown *by the contract*; the
engine only **propagates** them. Each maps to UI feedback without string-parsing.

---

## What is explicitly NOT in this spec

- Any domain rule, schema field, source, or ranking metric — those live in a
  **chassis** spec (see 002).
- Tech stack, frameworks, file layout, provider implementations — those are
  **Phase 2 (plan)**, not here.
- Cache implementation, event ledger, self-authoring, a second source — those
  are **scaffold-empty seams**, each a future spec gated by its benchmark.

---

## Traceability

| Source in build docs | Captured here |
| :--- | :--- |
| HARNESSBUILD §A.1 mounting-point contract | "The mounting-point contract" |
| HARNESSBUILD §A.2 loop + E1–E6 | "The loop", "Acceptance criteria" |
| HARNESSBUILD §A.3 two doors | "The two doors" |
| HARNESSBUILD §A.4 tiered verification + degradation | "Tiered verification" |
| HARNESSBUILD §A.5 named errors | "Named errors" |
| Constitution Laws 1,2,6,7,11 | E1, E2, E5, E6; the seam framing |
