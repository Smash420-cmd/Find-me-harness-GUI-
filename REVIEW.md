# Trust-Floor Review & Sign-Off

**Scope:** the two human-gated, trust-bearing modules (Constitution Laws 3 & 8).
**Reviewer:** teamsmashau@gmail.com (repo owner)
**Date:** 2026-06-29
**Branch reviewed:** `claude/please-read-ybtfse`
**Status:** ✅ **SIGNED OFF**, with four recorded decisions and three scoped follow-ups.

> Per the constitution, the agent that produced this work may not sign off its own
> trust floor. This file records the **human** review of:
> - **Task 3** — `src/engine/verify/index.ts` (tier routing + proof-shot gate + sandbox)
> - **Task 7** — `src/chassis/ram/verify.ts` (SKU + live-stock rules), with the
>   in-stock predicate in `src/chassis/ram/sources/parse.ts`

---

## Modules reviewed

| Module | File | What it owns |
| :-- | :-- | :-- |
| Verification core | `src/engine/verify/index.ts` | cheapest-first tier routing; proof-shot gate (Law 1); graceful degradation; `EphemeralSandbox` |
| RAM verify rules | `src/chassis/ram/verify.ts` | `matchesSpec` (correct SKU); Tier-2 live-stock decision; Tier-2/3 proof emission |
| In-stock predicate | `src/chassis/ram/sources/parse.ts` (`parseProductPage`) | maps Umart microdata → `in_stock` / `out_of_stock` |
| Possibility gate | `src/chassis/ram/spec.ts` | rejects impossible specs (e.g. DDR4 @ 8000) before any network |

Tests covering them: `src/engine/verify/verify.test.ts`,
`src/chassis/ram/ram.test.ts`, `src/chassis/ram/sources/parse.test.ts`,
`src/chassis/ram/sources/umart.test.ts`. Suite at sign-off: **57 passing / 1
gated**; `/analyze` seam gate green.

---

## Recorded decisions

### Decision 1 — Vision / liveness split → **HARDEN** (new task)

**Finding.** Today the in-stock decision and the proof-shot come from **two
separate fetches of the product page:**
- **Tier 2 (DOM)** calls `readLive` → `UmartSource.read` → a Node `fetch` of the
  product page, parsed by `parseProductPage`. This fetch makes the authoritative
  **in-stock + price + SKU** decision (`chassis/ram/verify.ts:60–71`).
- **Tier 3 (Vision)** calls `captureProof` → `PlaywrightValidator.capture`, a
  **separate** Playwright render of the same URL, which produces the screenshot
  (`chassis/ram/verify.ts:76–83`).

Because they are two fetches moments apart, the screenshot is **not guaranteed to
be the same render the liveness decision was made on.** A kit could flip state
between the two.

**Decision.** Unify them: the liveness/stock/price decision and the proof-shot
must come from **one render**, so the screenshot shows exactly the DOM the
verification decision was taken on. Tier 3 becomes "render → read-and-decide →
capture," and is the authoritative liveness gate; if the render disagrees with a
cheap pre-check, the render wins.

**Status:** accepted, **scoped as its own task — NOT yet implemented.** Size
estimate recorded below (see "Follow-up F1"). Do not start until separately
approved.

### Decision 2 — Degrade / score constants (0.6 / 0.7 / 1.0) → **ACCEPTED, LOCK THEM**

**Finding.** `DEGRADE_FACTOR = 0.6` (`engine/verify/index.ts:31`),
`DOM_PROOF_SCORE = 0.7` and `VISION_PROOF_SCORE = 1.0`
(`chassis/ram/verify.ts:48–49`) are chosen constants. The current degradation
test asserts only **ordering** (degraded score `<` full), so the constants could
drift unnoticed.

**Decision.** Accept the values. **Add one test that pins the exact degraded
value** (DOM proof 0.7 × degrade 0.6 = **0.42**) so any change to the constants
fails a test loudly.

**Status:** accepted; test addition queued (see "Follow-up F2").

### Decision 3 — Fail-closed stock + SKU predicates → **ACCEPTED as correct**

**Finding.** The in-stock predicate (`parse.ts:95–97`) reads `in_stock` **only**
when the microdata is exactly `schema.org/InStock`; anything else — `PreOrder`,
`BackOrder`, `OutOfStock`, or the `itemprop` being **absent** (markup change) —
maps to `out_of_stock` and the candidate is dropped. Likewise SKU attributes are
parsed from the page `<title>`; a title-format change makes `matchesSpec` fail
and the candidate drop.

**Consequence (accepted):** a Umart markup change yields **empty boards, never
wrong ones.** Fail-closed is the correct posture (no ghost inventory, Law 1), but
the failure is **silent** — an outage looks identical to "nothing in stock."

**Decision.** Accept the fail-closed behaviour as correct. **Log a future-spec
note** for a "selectors changed / suspiciously empty" alarm that distinguishes
"genuinely nothing matched" from "our parsing broke."

**Status:** accepted; future-spec note recorded (see "Follow-up F3").

### Decision 4 — Exact capacity / speed / generation matching → **ACCEPTED (product decision)**

**Finding.** `matchesSpec` (`chassis/ram/verify.ts:35–46`) requires **exact**
equality on `generation`, `capacityGb`, and `dataRateMtps` (CAS allows
tighter-than-asked; kit/per-stick checked only when the spec specifies them).
There is no tolerance band — a 6000 request never surfaces a 6400 kit.

**Decision.** Accept as a deliberate product decision: "correct SKU" means what
the user asked for, not "close enough."

**Status:** accepted, no change.

---

## Follow-up register (queued — none started)

| ID | Follow-up | Origin | Type | State |
| :-- | :-- | :-- | :-- | :-- |
| **F1** | Unify Tier-2 liveness decision and Tier-3 proof into a single render | Decision 1 | new task (size below) | awaiting approval |
| **F2** | Add a test pinning the degraded score to 0.42 | Decision 2 | test | queued |
| **F3** | Future-spec: "selectors-changed / suspiciously-empty" alarm | Decision 3 | future spec (gated) | logged, not built |

### F1 size estimate — **Medium**

A contained change; the human-gated **engine** trust floor (`engine/verify/`)
does **not** move — only the chassis tier rules and the validator contract.

**Touched:**
- `src/providers/index.ts` — extend `IValidationProvider.capture` to also return
  the fields read from the render (so the decision and the proof share one DOM).
  *Contract change → ripples to the 3 call sites below.* (~5 lines)
- `src/providers/validation/playwright.ts` — after `goto`, read the
  availability/price/title from the rendered page, then screenshot; return
  `{ proof, fields }`. (~20 lines)
- `src/chassis/ram/verify.ts` — Tier 3 becomes the authoritative liveness gate:
  render → run the in-stock predicate + `matchesSpec` on the **render's** fields →
  `ok:false` (drop) on disagreement, else `ok:true` + proof. Keep Tier-2 Node
  fetch as a **cheap pre-filter** so only survivors are rendered (preserves the
  cost-control tiering). (~40–50 lines reworked)
- `src/ui/server.ts` + `src/e2e/ram.e2e.test.ts` — update the `captureProof`
  wiring to the new return shape. (~10 lines)
- `src/chassis/ram/ram.test.ts` — update the fake `captureProof`/validator to the
  unified contract; the existing R3/R4/R5 + degradation cases stay. (~30 lines)

**Net:** ~4–6 files, ~150 lines, **no change to `engine/verify/`**.
**Effort:** roughly half a day of focused work + a live e2e re-run.
**Main risks / decisions inside F1:**
1. **Cost posture** — recommended: keep Tier 2 as a cheap Node-fetch pre-filter
   and only render survivors in Tier 3 (so we don't pay Playwright for every
   candidate). Confirm this rather than "render every candidate."
2. **Contract shape** — keep `IValidationProvider` domain-free by having the
   caller pass *which selectors to extract*; the validator returns raw strings,
   the chassis interprets them. Preserves the seam (Law 7).
3. Liveness law (Law 2) is strengthened, not weakened: the decision moves onto
   the freshest possible DOM (the one screenshotted).

---

## Sign-off

The two trust-floor modules are **approved for use** as implemented, subject to
the four decisions above. Follow-ups F1–F3 are recorded and **not yet started**;
F1 awaits explicit go-ahead after this size estimate is read.

_Reviewed by teamsmashau@gmail.com on 2026-06-29._
