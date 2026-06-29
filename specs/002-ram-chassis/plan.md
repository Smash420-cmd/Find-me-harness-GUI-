# Plan 002 — RAM Chassis (the HOW)

**Artifact:** `plan.md` · **Phase:** 2 (Plan) · **Against:** Spec 002 (RAM) ·
**Mounts on:** Plan 001 · **Obeys:** `constitution.md` · **Source:** Umart
(umart.com.au)

> RAM supplies the three mounting-point pieces as concrete TS modules under
> `chassis/ram/`. This plan records *how* — the modules, the Umart source
> approach, and the tier rules — while keeping every domain word inside this
> folder (Law 7).

---

## Modules (the chassis surface)

```text
chassis/ram/
  spec.ts      → Zod schema for a RAM request (the specSchema)
  verify.ts    → the verification contract: correct-SKU + live-stock rules,
                 supplied as the content the engine's tiers apply
  rank.ts      → rank(verified) = ascending verified price
  sources/
    umart.ts   → ISourceProvider for Umart; declares capability matrix
  index.ts     → assembles Chassis<RamSpec, RamCandidate>
```

## spec.ts (the schema + possibility rules)

- Zod object: `capacityGb`, `perStickGb?`, `dataRate` (e.g. `DDR5-6000`),
  `generation` (`DDR4`|`DDR5`), `casLatency?`, `kitCount?`, `budgetAud?`,
  `constraints?` (policy vocab).
- **Refinements encode possibility rules** → parse failure raises
  `SpecInvalidError`. Canonical: a DDR4 spec with a data rate outside DDR4's
  feasible band (the "DDR4 @ 8000 MHz" rejection, R2). Generation/data-rate
  consistency is a Zod `.superRefine`, so the structured door cannot express an
  invalid spec by construction.

## verify.ts (correct + real, as tier content)

The engine routes tiers; `verify.ts` supplies what each tier *checks*:

| Tier | Umart-specific rule supplied by verify.ts |
| :--- | :--- |
| 0 Cache | candidate identity key = Umart product id / SKU (a *fact*, never stock). |
| 1 API | **n/a** (Umart `hasApi:false`) — tier skipped. |
| 2 DOM | "unavailable" predicate = the page's out-of-stock indicator; SKU-correctness from parsed product attributes (capacity/speed/gen/timing/kit). |
| 3 Vision | proof-shot must show: the kit title, its AUD price, and an in-stock/buyable state. This capture is the user-facing proof. |

- **Correct** (wrong-SKU → `GhostDroppedError`): parsed attributes must match the
  `RamSpec`.
- **Real** (sold-out → dropped, R4): the live in-stock check; cache never
  satisfies it (Law 2).
- **Graceful degradation:** if Tier 3 capture fails, fall back to Tier 2 and flag
  composed confidence — never a silent pass; if no tier proves it, drop (Law 1).

## rank.ts

`rank(verified) → verified.sort(by verifiedPriceAud ascending)`. Runs over
policy-filtered, verified survivors only. No multi-factor score (out of scope).

## sources/umart.ts (the one source)

- Implements `ISourceProvider<RamCandidate>`.
- **Declares capabilities:** `{ hasApi:false, hasStockFlag:true, rendersClean:true }`.
- `observe(spec)` → candidate listings (search/category fetch).
- `read(candidate)` → product page DOM for Tier 2; hands the page to the
  `IValidationProvider` (Playwright, sandboxed) for Tier 3 capture.
- All Umart selectors/parsing live here — the only place that knows Umart's HTML.

## Policy filter wiring

The RAM constraint vocabulary (low-profile, exclude grey-import, single-rank,
brand include/exclude) is declared by the chassis; the engine's `loop/policy`
applies it after verify, before rank (R7), without knowing the words' meaning.

---

## How RAM honours the laws (chassis side)

| Law | RAM architectural fact |
| :--- | :--- |
| 1 | `verify.ts` Tier 3 is the proof-shot; no proof ⇒ candidate dropped. |
| 2 | Tier 0 keyed on SKU id only; in-stock always via live Tier 2/3. |
| 6/11 | confidence flagged when degraded (Tier 3→2 fallback). |
| 7 | `SKU`/`price`/`in stock` appear **only** under `chassis/ram/`. |
| 9 | `SpecInvalidError` (spec.ts), `GhostDroppedError` (verify.ts). |

## Risks recorded for Phase 4

- Umart capture could be rate-limited/blocked → handled as capability-matrix
  reality check, not a loop change.
- Umart markup may change → isolated to `sources/umart.ts`; a selector update,
  not an engine change.
