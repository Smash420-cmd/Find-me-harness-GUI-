# The Harness — Constitution

**Artifact:** `constitution.md` (top of the stack) · **Phase:** 0 · **Authority:**
non-negotiable. Every `spec.md`, `plan.md`, `tasks.md`, and line of code obeys
this file. A change here is a *logic* change and lands by human PR only.

> **AI proposes, the engine disposes.** The specification is the source of truth;
> code is the generated output that serves it. These laws are what stop the agent
> drifting. They are never violated, never delegated, never silently relaxed.

---

## The Laws

### 1. Proof-shot or no card (No Ghost Inventory)
No `VerifiedResult` is ever emitted, rendered, or counted without a passing
`ProofShot`. If no verification tier can produce the required proof, the
candidate is **dropped** — never shown, never shown "degraded past the proof
gate." There is no inventory without evidence.

### 2. Liveness always re-verifies; recall accelerates facts only
Availability/liveness is re-checked live, every time. The cache may accelerate
*facts* (a SKU, a selector, a key) but **never** liveness. A recalled fact is a
shortcut to where to look — never a substitute for looking.

### 3. Verification core is human-gated
The verification core — tier routing and the proof-shot gate — changes by human
PR only. It is the trust floor. No agent, and no automated process, may alter it
without a human reviewing and signing off the change.

### 4. Wrapper renders, never decides
The UI/wrapper is a projection surface with **no decision path** and no write
path to the command bus. It renders the current run's results and nothing more.
All logic lives behind the seam; the wrapper only shows what the engine emitted.

### 5. Schema floor
Every LLM output passes Zod validation **before** it can touch the command path.
The schema gate and the render sandbox are the two membranes between untrusted
input (model output, web pages) and the trusted engine. Nothing unvalidated
crosses.

### 6. Honest stops
Sub-confidence results are labelled as such — flagged for what they are, never
silently dropped and never silently promoted. The default threshold is 85%
composed confidence (chassis-configurable); below it, a result is shown flagged
for manual review, not hidden.

### 7. Engine/chassis separation (the seam is law)
No engine module references a domain. There is no `RAM`, no `price`, no `SKU`
anywhere in the general hemisphere. The engine speaks only `Spec`, `Candidate`,
`VerifiedResult`, `ProofShot`. The boundary is a **directory boundary**:
`engine/` importing from `chassis/` is the violation `/analyze` (cross-artifact
consistency review) exists to catch.

### 8. Test-first for the core
Verification-core behaviour lands as a **failing test before its
implementation**. The trust floor is proven, not asserted. "No proof-shot ⇒ no
card", "ghost is dropped", and "tier-3 failure falls back and flags confidence,
never silently passes" are written red, then driven green.

### 9. Explicit domain errors
No generic `throw new Error(...)`. Every failure is a named class that maps
cleanly to UI feedback without string-parsing:
- `SpecInvalidError` — request fails the schema/possibility check (chassis).
- `GhostDroppedError` — candidate failed verification / no proof (chassis).
- `SupersededRunError` — a result belongs to a run that was superseded (engine).
- `SourceUnavailableError` — a source could not be reached (engine).
- `LoopBudgetExceededError` — the bounded loop hit its iteration/wall-clock cap
  (engine).

### 10. Attributability + immutable prompts
Every agent decision and tool call is logged and linked to a prompt hash. Prompt
versions are version-controlled alongside code. **A prompt change is a logic
change requiring a PR.** This audit trail is what the human-gating of the
verification core (Law 3) depends on. The Root Context Matrix (`/.claude.md`) is
governed by this law: changing an axiom or a context-map entry goes through a PR.

### 11. Composed confidence
Confidence is never a single number. Each stage contributes — convergence match,
verification pass, source reliability — and the overall score is their
composition. Results below threshold are flagged, not hidden (ties to Law 6).

---

## How the laws bind the stack

| Layer | Bound by |
| :--- | :--- |
| `spec.md` (per feature/chassis) | Laws 1, 2, 6, 11 are its acceptance criteria. |
| `plan.md` | Must *show how* the architecture honours each law (e.g. proof-shot gate lives inside the verification-core module; wrapper has no write path). |
| `tasks.md` | Ordered to respect Laws 7 (frame before furniture) and 8 (core test-first). |
| code | Generated to serve the spec; debugged by fixing the spec/plan above it, not by patching code in isolation. |

## Enforcement & review

- **`/analyze` before `/implement`** runs cross-artifact consistency: every task
  traces to a spec requirement; nothing violates this constitution; **Law 7** is
  checked by flagging any domain reference (`RAM`, `price`, `SKU`) that leaked
  into `engine/`.
- **Review checkpoints are not optional.** The single biggest failure mode of
  spec-driven development is letting the agent verify its own work. A **human**
  signs off constitution adherence and the verification-core tests. Skip the
  checkpoint and the value collapses.

---

## The one-line discipline

**The spec is the source of truth; the engine stays domain-free; the
constitution is never violated; and no checkpoint is delegated to the agent that
produced the work.** Prove it on RAM, regenerate for everything after.
