# Plan 001 — System & Engine (the HOW)

**Artifact:** `plan.md` · **Phase:** 2 (Plan) · **Against:** Spec 001 (engine) ·
**Obeys:** `constitution.md` · **Introduces:** tech stack, architecture, repo
tree, provider interfaces, governance files, security model.

> The plan's job: show *how* each constitution law is honoured by the
> architecture — not just assert it. Where a law maps to a structural fact
> (a directory boundary, a module that owns a gate, a membrane), that fact is
> named here.

---

## B.0 Architecture in one line

Orchestrator logic runs in **Claude Code**; the user-facing wrapper is a **thin
Next.js projection surface** with no decision path. Rendering and proof-shot
capture run in **sandboxed, ephemeral Playwright**. Every LLM output passes
**Zod** before the command path. The engine emits `VerifiedResult`; the
projection layer renders — the engine never reaches into the UI.

## B.1 Repository layout (the seam made visible in the tree)

The engine/chassis line is a **directory boundary**, not a convention. That
boundary *is* the enforcement of Law 7: `engine/` importing from `chassis/` is
the violation `/analyze` looks for.

```text
src/
  ├── composition/          # DI container — wires providers + chassis into engine
  │
  ├── engine/               # GENERAL HEMISPHERE — domain-free, reused by all chassis
  │    ├── converge/        #   two doors → Spec
  │    ├── loop/            #   observe, fan-out, synthesise, gate, bounded retry
  │    ├── verify/          #   tier ROUTING (not rules) + proof-shot capture
  │    ├── confidence/      #   composed score
  │    ├── run/             #   run identity, cancellation, supersede
  │    └── errors/          #   engine-level named errors
  │
  ├── chassis/              # SPECIALIST HEMISPHERE — one folder per domain
  │    └── ram/             #   THE reference chassis (the only furnished room)
  │         ├── spec.ts     #     Zod spec schema
  │         ├── verify.ts   #     correct-SKU + live-stock RULES (tiers' content)
  │         ├── rank.ts     #     lowest verified price
  │         └── sources/    #     one ISourceProvider — Umart
  │
  ├── providers/            # interface implementations (swappable)
  │    ├── llm/             #   AnthropicProvider
  │    ├── validation/      #   PlaywrightValidator (sandboxed, ephemeral)
  │    ├── source/          #   base ISourceProvider + capability matrix
  │    └── cache/           #   STUB — returns miss (empty scaffold)
  │
  ├── seams/                # EMPTY SCAFFOLD — interfaces only, no behaviour
  │    ├── ledger/          #   CQRS/event-sourcing seam (signatures)
  │    └── authoring/       #   self-authoring-adapter seam (gated, unbuilt)
  │
  ├── ui/                   # the WRAPPER — projection only, no logic
  ├── types/                # Spec, Candidate, VerifiedResult, ProofShot
  └── tests/                # unit, e2e, AND property-based
                            #   property tests carry loop invariants E3, E4
```

## B.1a Decentralised `.claude.md` guardrails

Small rules files placed *in the directory they govern*, so Claude Code reads the
right rules at the point of work:

```text
engine/.claude.md        → "Domain-free. Never import from chassis/. Speak only
                            Spec/Candidate/VerifiedResult/ProofShot."
engine/verify/.claude.md → "Tier ROUTING only — never domain rules. The proof-
                            shot gate is the trust floor; human-PR only.
                            Authority on 'verified' = chassis/ram/verify.ts."
chassis/ram/.claude.md   → "Domain rules live HERE. Only place 'SKU', 'price',
                            'in stock' may appear."
ui/.claude.md            → "Projection only. No decision path. Current-run only."
seams/.claude.md         → "Interfaces only. Do not implement. See promotion
                            register to furnish."
```

**Non-Inferables:** each file tells the agent *where the deterministic truth
lives* so it doesn't hallucinate it. `engine/verify/.claude.md` points at
`chassis/ram/verify.ts` as the authority on what counts as verified — the engine
routes, it never invents the rules.

## B.1b The Root Context Matrix (`/.claude.md`)

Top-level index mapping the whole governance: root axioms every sub-file
inherits, a directory→governing-file→authority table, and the promotion
register. Itself governed by Law 10 (immutable prompts / attributability):
changing an axiom or a map entry is a logic change and goes through a PR. (Full
content authored as a Task-0 deliverable; structure fixed here.)

## B.2 Provider interfaces

```ts
ILLMProvider        // AnthropicProvider | LocalLLMProvider
ISourceProvider     // a source the fan-out consumes
                    //   + declares capabilities { hasApi, hasStockFlag, rendersClean }
IValidationProvider // browser render / capture — PlaywrightValidator
ICacheProvider      // memory seam — STUB in v1 (get → miss); local-first later
```

**Capability matrix routing:** each `ISourceProvider` *declares what it exposes*;
the engine routes validation to the right tier accordingly. This is what makes
sources pluggable — the RAM chassis doesn't know *which* tier a source uses, only
that it returns a verified result. Source #2 later is "declare its capabilities,"
not "rewrite the loop."

## B.3 Tech stack — build vs. already available

| Concern | Already available (don't build) | You build (the value) |
| :--- | :--- | :--- |
| LLM calls | Anthropic SDK | the prompts + Zod gating around them |
| Browser render / capture | Playwright | tier-3 proof-shot routine + sandboxing policy |
| Schema validation | Zod | the spec schemas + schema-floor enforcement |
| Orchestration runtime | Claude Code | the loop, the gate, bounded-retry logic |
| Frontend shell | Next.js + Tailwind (+ shadcn optional) | proof-shot board + two-door input |
| Cache/store (later) | SQLite local / Supabase if hosted | `ICacheProvider` impl + freshness law |
| Concurrency primitives | language/runtime | run-identity + supersede logic |

**Build-time only, never runtime:** Claude Design (generates wrapper UI),
GitHub Spec Kit / Specify CLI (drives SDD). Neither ships.

**Language/runtime decision:** TypeScript + Node (Next.js wrapper, Playwright,
Zod, Anthropic SDK are all first-class in TS; the seam is expressed cleanly with
TS interfaces and generics). Test runner: Vitest; property tests: fast-check.

## B.4 Operational security

- **Sandboxing** — every Playwright render runs in an **isolated, ephemeral**
  environment, torn down after each capture. The fan-out spins up and discards
  sandboxes; nothing rendered shares state with the engine. *Test: a render
  cannot read or write outside its ephemeral context.*
- **Schema floor** — every LLM output is parsed through Zod *before* it touches
  the command path (Law 5). Render sandbox + schema gate are the two membranes
  between untrusted input (web pages, model output) and the trusted engine.

**Deliberately NOT in v1 (scaffolded, deferred):** Supabase + pgvector, CQRS
event ledger, full quality-gate ledger, circuit breakers (one source → nothing
to break over yet).

---

## How each constitution law is honoured by the architecture

| Law | Architectural fact that enforces it |
| :--- | :--- |
| 1 Proof-shot or no card | The proof-shot gate lives **inside `engine/verify/`**; a `VerifiedResult` cannot be constructed without a `ProofShot` (type-enforced). |
| 2 Liveness re-verifies | Tier 0 cache returns *facts* only; liveness tiers (2/3) run every request — `ICacheProvider` has no path to a liveness value. |
| 3 Human-gated core | `engine/verify/` carries its own `.claude.md` marking it PR-only; changes flagged at `/analyze`. |
| 4 Wrapper renders | `ui/` has **no import** of the command bus; projection only. Separation test asserts no decision path. |
| 5 Schema floor | Zod parse sits at every LLM boundary in `converge/`; unparsed model output cannot reach `loop/`. |
| 6 Honest stops | `confidence/` attaches a composed score + flag to every result; sub-threshold flagged, never dropped/promoted. |
| 7 Seam | **Directory boundary** `engine/` ⊥ `chassis/`; `/analyze` greps for domain words in `engine/`. |
| 8 Test-first core | Task 3 lands failing verification-core tests before implementation. |
| 9 Named errors | `engine/errors/` (engine-level) + chassis throws; no generic `throw`. |
| 10 Attributability | Prompts version-controlled; Root Matrix changes via PR. |
| 11 Composed confidence | `confidence/` composes convergence + verification + source reliability. |
