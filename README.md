# The Harness

> **AI proposes, the engine disposes.** A domain-free verification engine that
> filters noise and proves what's real. RAM is the reference chassis bolted on to
> prove it runs.

Built spec-first (SDD): the specification is the source of truth; code is the
output that serves it. The engine speaks only `Spec` / `Candidate` /
`VerifiedResult` / `ProofShot` — never a domain word. A domain plugs in as a
**chassis** via a three-part contract (spec schema, verify rules, ranking).

## Governance

| Artifact | Where |
| :-- | :-- |
| Constitution (11 laws) | `.specify/memory/constitution.md` |
| Engine spec / plan | `specs/001-engine/` |
| RAM chassis spec / plan | `specs/002-ram-chassis/` |
| Task list | `specs/tasks.md` |
| Root Context Matrix | `/.claude.md` (+ per-directory `.claude.md`) |

## Layout (the seam is a directory boundary)

```
src/
  engine/     domain-free: run · converge · verify (trust floor) · loop · confidence · errors
  chassis/ram domain rules ONLY here: spec · verify · rank · policy (+ sources, tonight)
  providers/  ILLMProvider · ISourceProvider(+capabilities) · IValidationProvider · ICacheProvider(stub)
  seams/      empty scaffold (ledger, authoring) — interfaces only
  types/      the engine vocabulary
```

## Build status (Phase 4)

| | Task | Status |
| :-- | :-- | :-- |
| 0 | frame — types, interfaces, errors, stubs, guardrails | ✅ |
| 1 | `engine/run` — supersede (E2) | ✅ |
| 2 | `engine/converge` — two doors, schema floor | ✅ |
| 3 | ⭐ `engine/verify` — tier routing + proof gate + sandbox (test-first, human-gated) | ✅ |
| 4 / 4b | `engine/loop` — bounded retry (E3/E4) + policy filter | ✅ |
| 5 | `engine/confidence` — composed score (E5) | ✅ |
| 6 | `providers/source` — capability matrix | ✅ |
| 7 | ⭐ `chassis/ram` — spec / verify / rank (human-gated) | ✅ |
| — | `/analyze` seam gate (E6) | ✅ |
| 8 | `chassis/ram/sources/umart` — live source | ⏳ live env |
| 9 | `ui` wrapper — two doors + proof-shot board | ⏳ live env |
| 10 | end-to-end against Umart | ⏳ live env |

v1 source: **Umart** (umart.com.au) — `{ hasApi:false, hasStockFlag:true, rendersClean:true }`.

## Develop

```bash
npm install
npm run typecheck   # tsc
npm test            # vitest (45 tests; incl. fast-check property tests)
npm run analyze     # /analyze seam gate (no engine→chassis leak)
```

⭐ = human review checkpoint (the trust-bearing modules).
