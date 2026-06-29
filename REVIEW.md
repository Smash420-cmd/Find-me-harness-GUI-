# Trust-Floor Review & Sign-Off

**Scope:** the two human-gated, trust-bearing modules (Constitution Laws 3 & 8).
**Reviewer:** repo owner
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

**Decision.** Liveness is **confirmed on the same render that produces the
proof-shot.** Tier 2 remains a **cheap Node-fetch pre-filter** (drops obvious
wrong-SKU / sold-out candidates without rendering); Tier 3 renders the survivors
once and is the **authoritative confirmation on that rendered DOM** — it
re-checks SKU + in-stock on the very DOM it screenshots, and only that render
backs the card. If the render disagrees with the cheap pre-filter, the render
wins (drop).

**Status:** accepted and **approved for implementation** (design calls as in F1
below). Because it modifies `chassis/ram/verify.ts`, the post-F1 verify rules
require a **separate re-review** before they are signed again (this sign-off
covers only the pre-F1 code).

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
| **F1** | Confirm liveness on the same render that produces the proof-shot (Tier 2 cheap pre-filter; Tier 3 authoritative on rendered DOM) | Decision 1 | task | ✅ **done — re-reviewed & re-signed** (see addendum) |
| **F2** | Pin the degrade constants (0.42 RAM / 0.48 engine) so they can't drift | Decision 2 | test | ✅ done |
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
- `src/chassis/ram/verify.ts` — Tier 2 stays a **cheap Node-fetch pre-filter**;
  Tier 3 **confirms liveness on the same render it screenshots**: render → run the
  in-stock predicate + `matchesSpec` on the **render's** fields → `ok:false`
  (drop) on disagreement, else `ok:true` + proof. Only Tier-2 survivors are
  rendered (preserves the cost-control tiering). (~40–50 lines reworked)
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

The two trust-floor modules are **approved for use** as implemented (pre-F1),
subject to the four decisions above. F1 is **approved** (design calls as
recommended) and F2 queued. Because F1 modifies `chassis/ram/verify.ts` — a
trust-bearing module — this sign-off does **not** extend to the post-F1 code: a
**separate re-review** of the changed verify rules is required before they are
signed again. F3 remains a logged future spec, not built.

_Reviewed by the repo owner on 2026-06-29._

---

## Addendum — F1 re-reviewed & re-signed (2026-06-29)

F1 modified `chassis/ram/verify.ts` (a trust-bearing module), so it required a
separate re-review. **Re-review approved**, with one change applied before
signing:

**(a) Caption fix.** The proof-shot caption (`ProofShot.shows`) now derives from
the **render-read** price, not the observe-time `priceAud`. The caption sits on
the trust artifact, so it must not show a number that can disagree with the
screenshot it labels. Implemented via `umartProofCaption(title, live)` built from
the render's `live` state in the `captureProof` closure; `mustShow` no longer
carries the price. Locked by a unit test
(`sources/umart.test.ts` — caption uses the render price, never the stale one).

**(b) Fail-closed posture now also governs Tier 3.** As accepted in Decision 3,
the in-stock + SKU predicates are fail-closed; post-F1 the **rendered** DOM is
subject to the same posture (an unreadable selector on the render → `out_of_stock`
→ drop → possible empty boards, never wrong ones). This is the accepted
behaviour. The widened surface remains covered by **F3** (the still-gated
"selectors-changed / suspiciously-empty" alarm) — logged, not built.

**Re-review confirmed:** shared `disqualify` predicate (both tiers apply identical
correct-AND-real logic); "render wins" on disagreement (drop); engine
`engine/verify/` core unchanged; F2 two-sided constant lock (RAM 0.42 / engine
0.48). Offline suite green; live e2e green.

**Status:** `chassis/ram/verify.ts` (post-F1) is **RE-SIGNED**.

_Re-reviewed and re-signed by the repo owner on 2026-06-29._
