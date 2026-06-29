# Tasks — The Harness v1 (RAM on the engine)

**Artifact:** `tasks.md` · **Phase:** 3 (Tasks) · **Against:** Plans 001 + 002 ·
**Obeys:** `constitution.md` · **Discipline:** every task ends **green** (a
passing test); ordered for the **seam** (frame before furniture) and **test-first
for the core**.

> Everything past Task 10 is **not a task** — it is a future spec, each gated by
> its benchmark (the promotion register). Do not build ahead of the benchmark.

---

## Ordered tasks (each ends green)

### Task 0 — Frame: types + interfaces + named errors + empty stubs
**Build:** `types/` (`Spec`, `Candidate`, `VerifiedResult`, `ProofShot`,
`Confidence`, `VerificationOutcome`); all provider interfaces (`ILLMProvider`,
`ISourceProvider` w/ capability decl, `IValidationProvider`, `ICacheProvider`);
the `Chassis<TSpec,TCandidate>` interface; named error classes (engine:
`SupersededRunError`, `LoopBudgetExceededError`, `SourceUnavailableError`;
chassis: `SpecInvalidError`, `GhostDroppedError`); empty stubs (`ICacheProvider.get`
→ miss); the Root Context Matrix `/.claude.md` + the decentralised `.claude.md`
files; project scaffolding (TS, Vitest, fast-check, lint).
**Done when:** project compiles; `ICacheProvider.get` returns miss; every error
class exists and is thrown nowhere yet; `.claude.md` files in place.
**Layer:** frame. **Traces:** Plan B.1, B.1a, B.1b, B.2; Laws 7, 9.

### Task 1 — `engine/run`: run identity + supersede
**Build:** run-id issuance, cancellation, supersede semantics.
**Done when:** a superseded run's results **never emit** (E2) → `SupersededRunError`
on the late path. **Layer:** engine. **Traces:** Spec E2; Law (run integrity).

### Task 2 — `engine/converge`: the two doors
**Build:** `fromStructured(fields)→Spec` (valid by construction) and
`fromConversation(turns,llm)→Spec` (LLM behind a Zod gate; owns clarifying-Q +
impossible-spec rejection).
**Done when:** structured door **cannot** produce an invalid `Spec`; convo door
rejects an impossible spec → `SpecInvalidError`; **no unparsed LLM output reaches
the command path** (Law 5). **Layer:** engine. **Traces:** Spec A.3; Laws 5, 9.

### Task 3 — ⭐ Verification core (TEST-FIRST, human-gated)
**Build:** tier **routing** (0→3, cheapest-first) + the proof-shot gate +
graceful degradation, rendering in an **ephemeral sandbox**. Tier *rules* come
from the chassis; this module only routes and gates.
**Test-first (write red, then green):**
- "no proof-shot ⇒ no card" (E1)
- "ghost is dropped" (`GhostDroppedError`)
- "tier-3 fail ⇒ fall back to tier-2 **+ flag confidence**, never silent pass"
- "a render cannot read/write outside its ephemeral context" (sandbox escape)
**Done when:** all the above pass; `VerifiedResult` is unconstructable without a
`ProofShot`. **Layer:** engine (**human-gated**, PR-only). **Traces:** Spec E1;
Plan B.4; Laws 1, 3, 8.

### Task 4 — `engine/loop`: observe→fanout→synthesise→gate→bounded retry
**Build:** the loop with four independent stop conditions and `loopWider`.
**Done when:** four stop conditions tested; **property test** — terminates for
**all** inputs (E3) and `loopWider` fires **only if improved** (E4); budget breach
→ `LoopBudgetExceededError`. **Layer:** engine. **Traces:** Spec E3, E4; Law 9.

### Task 4b — `engine/loop`: policy filter
**Build:** configurable user-constraint filter.
**Done when:** runs **after** verify, **before** rank; filters **only**
already-verified candidates. **Layer:** engine. **Traces:** Spec policy filter; R7.

### Task 5 — `engine/confidence`: composed score
**Build:** compose convergence-match + verification-pass + source-reliability.
**Done when:** every result carries a composed `Confidence`; sub-threshold
(<85%, chassis-configurable) **flagged**, never dropped/promoted (E5). **Layer:**
engine. **Traces:** Spec E5; Laws 6, 11.

### Task 6 — `providers/source` base + capability matrix
**Build:** base `ISourceProvider` with capability declaration; engine routing
honours it.
**Done when:** a source declares caps and the engine routes to the correct tier
(e.g. `hasApi:false` ⇒ Tier 1 skipped). **Layer:** provider. **Traces:** Plan B.2.

### Task 7 — ⭐ `chassis/ram`: spec.ts + verify.ts + rank.ts
**Build:** RAM Zod schema w/ possibility refinements; correct-SKU + live-stock
rules as tier content; lowest-verified-price rank.
**Done when:** valid RAM spec validates (R1); impossible spec rejected (R2,
"DDR4 @ 8000MHz"); verify drops wrong-SKU (R3) + sold-out (R4); rank = ascending
verified price (R6). **Layer:** chassis. **Traces:** Spec 002 R1–R6; Law 7.

### Task 8 — `chassis/ram/sources/umart.ts`: the one source
**Build:** Umart `ISourceProvider`; observe + read; declares
`{hasApi:false, hasStockFlag:true, rendersClean:true}`.
**Done when:** renders + reads a live Umart product page; declares its caps; all
Umart selectors isolated here. **Layer:** chassis. **Traces:** Plan 002 sources.

### Task 9 — `ui`: two-door input + proof-shot board
**Build:** structured form + conversational input; proof-shot board.
**Done when:** **wrapper has no decision path** (separation test); renders
**current-run only**. **Layer:** wrapper. **Traces:** Spec doors; Law 4.

### Task 10 — End-to-end
**Build:** wire composition → real query against Umart.
**Done when:** real query → real store → proof-shots stream in, ranked by verified
price, composed confidence shown, honest sub-threshold labelling (R5, R8).
**Layer:** e2e. **Traces:** Specs 001+002 end-to-end.

### `/analyze` gate — runs **before** implement (Phase 4)
**Checks:** no `engine/`→`chassis/` import / no domain word in `engine/` (E6);
every task traces to a spec line; no constitution violation. **Traces:** Law 7.

---

## Dependency order (what blocks what)

```
0 (frame)
├─ 1 run ──────────────┐
├─ 2 converge ─────────┤
├─ 3 verify-core ★ ────┼─→ 4 loop ─→ 4b policy ─→ 5 confidence ─┐
├─ 6 source-base ──────┘                                        │
└─ 7 ram-chassis ★ ──→ 8 umart-source ─────────────────────────┤
                                                                │
                                          9 ui ─────────────────┤
                                                                ▼
                                                            10 e2e
                                              (preceded by /analyze)
```

★ = human review checkpoint (Tasks 3 and 7 are the trust-bearing modules; a
human signs off the verification-core tests and the RAM contract).

## Promotion register (NOT tasks — future specs, gated)

| Empty room | Benchmark to furnish |
| :--- | :--- |
| `providers/cache` | verify-loop hits its reliability bar |
| source #2 | source #1 (Umart) solid → declare caps (no loop change) |
| `seams/ledger` | real audit need (multi-chassis builds) |
| `seams/authoring` | core proven + immutable test-gate built |
| build-platform | enough chassis coexist |
