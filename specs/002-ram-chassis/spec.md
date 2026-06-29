# Spec 002 — The RAM Chassis (first specialist installation)

**Artifact:** `spec.md` · **Phase:** 1 (Specify) · **Scope:** the WHAT + WHY,
**no tech stack** · **Mounts on:** Spec 001 (the engine) · **Obeys:**
`constitution.md`

> RAM is **the one furnished room** — the reference chassis that proves the
> engine runs. It supplies the three mounting-point pieces (spec schema,
> verification contract, ranking) plus its source(s). Domain words (`SKU`,
> `price`, `in stock`) live **only here**, never in the engine (Law 7).

---

## Why this exists

To prove the engine on a real, hard domain: **"find me RAM that matches what I
need and is actually buyable right now, with proof."** RAM is a good first
chassis because correctness is crisp (capacity, speed, timing, kit config) and
liveness is genuinely hard (stock flips constantly, "sold out" is often only
visible on the rendered page) — exactly where the proof-shot law earns its keep.

---

## What the user gets

A request for RAM — entered either as a structured form or a conversation —
returns a ranked board of kits that are **verified correct and verified
in-stock**, each with a **proof-shot** (the captured evidence) and an honest
confidence label. No card appears without proof. Nothing "sold out" is shown as
available.

---

## 1. Spec schema (what a valid RAM request is)

The fields a valid request may carry (WHAT, not how it's validated):

- **Capacity** — total and/or per-stick (e.g. 32 GB as 2×16).
- **Speed** — data rate (e.g. DDR5-6000).
- **Timing** — CAS latency / primary timings, if specified.
- **Kit config** — number of sticks / kit layout.
- **Memory generation** — DDR4 / DDR5 (and the impossibility rules between
  generation and speed, see below).
- **Budget** — a price ceiling, optional.
- **Constraints** — policy-filter vocabulary (see §4).

**Possibility rules (rejected at the door → `SpecInvalidError`):** requests that
are internally impossible must be refused, not searched. Canonical example:
**"DDR4 @ 8000 MHz"** is impossible and is rejected before any observation runs.
The conversational door owns surfacing *why* and asking the one clarifying
question; the structured door cannot express an invalid spec by construction.

## 2. Verification contract (correct **and** real)

Two questions, both deterministic, expressed as the engine's tiered escalation
(cheapest method first; escalate only when needed):

**Correct (right SKU):** the candidate's capacity, speed, timing, generation,
and kit config match the `Spec`. A wrong-SKU candidate is dropped
(`GhostDroppedError`).

**Real (live in-stock):** the candidate is *actually purchasable now* — this is
RAM's ghost-drop. A listing that exists but is sold out is a ghost and is
dropped.

| Tier | Method | Speed | Use for RAM |
| :--- | :--- | :--- | :--- |
| 0 | Cache | instant | recalled *fact* only — SKU identity, page selector. **Never** liveness. |
| 1 | API | fast | direct stock flag, *if* the source exposes one. |
| 2 | DOM | medium | HTML fetch, "sold out" / unavailable string check. |
| 3 | Vision | slow | capture + vision = **the proof-shot**. What it must show: the kit, its price, and an available/buyable state. |

The tiers **are** the cost-control strategy: most candidates resolve cheaply at
0–2; **Tier 3 runs only on the finalists the user will actually see**, where its
cost is justified because the capture doubles as the user-facing proof.

## 3. Ranking (what "best" means for RAM)

**Lowest verified price among genuinely available kits.** Ranking runs over
verified survivors only, after the policy filter. RAM deliberately does **not**
use a multi-factor build score — that is a build-platform concern, out of scope.

## 4. Policy filter (the user's own constraints)

Deterministic filtering on user constraints, applied **after** verification,
**before** ranking — so it only ever filters real, verified kits. Example
constraint vocabulary for RAM: *low-profile only*, *exclude grey-import
sellers*, *single-rank only*, *specific brand include/exclude*. (This is the RAM
constraint vocabulary; the engine applies it uniformly without knowing what the
words mean.)

## 5. The two doors (domain content)

- **Deterministic form** — capacity / speed / generation / kit / budget /
  constraints as structured fields → valid `Spec` by construction.
- **Conversational converge** — free-text intent ("fast 32 gig for a 7800X3D
  build under $150") → `Spec`, with the single clarifying-question path and the
  impossible-spec rejection.

---

## Acceptance criteria (RAM-specific, testable)

| ID | Claim |
| :-- | :--- |
| **R1** | A valid RAM request (e.g. "DDR5-6000 32GB 2×16, CL30, under $150") produces a valid `Spec`. |
| **R2** | An impossible request ("DDR4 @ 8000 MHz") is rejected at the door → `SpecInvalidError`; never observed. |
| **R3** | A wrong-SKU candidate (mismatched capacity/speed/timing/gen) is dropped → `GhostDroppedError`. |
| **R4** | A sold-out listing is dropped — never shown as available (No Ghost Inventory, Law 1). |
| **R5** | Every shown kit carries a proof-shot showing the kit, its price, and an available state. |
| **R6** | Results are ranked by **lowest verified price** among available kits. |
| **R7** | Policy constraints filter only already-verified kits, before ranking. |
| **R8** | Sub-threshold results are shown flagged, not hidden (Law 6 / E5). |

---

## OPEN QUESTION — resolve before Phase 2 (plan)

**Which single retailer is the v1 source?** The playbook requires picking **one**
cleanest-rendering retailer for v1 (one source means no circuit-breakers needed
yet). This must be answered before planning, because the source's declared
capabilities (has-API? has-stock-flag? renders-clean?) determine which
verification tiers are even available.

*Candidate considerations:* clean, server-rendered product pages (good for Tier
2/3); a stable "in stock / sold out" indicator; ideally an unofficial JSON
endpoint (enables Tier 1); permissive enough to capture for proof. **To be
decided with the user at the Phase-1 → Phase-2 boundary.**

---

## Traceability

| Source in build docs | Captured here |
| :--- | :--- |
| BUILDPROCESS §1b RAM chassis spec | §1–§5 |
| BUILDPROCESS tiered validation table | §2 verification contract |
| HARNESSBUILD §A.4 / Part C task 7 | tiers + correct/real split |
| Constitution Laws 1, 6 | R4, R5, R8 |
| Open question (BUILDPROCESS §1b clarify) | "OPEN QUESTION" |
