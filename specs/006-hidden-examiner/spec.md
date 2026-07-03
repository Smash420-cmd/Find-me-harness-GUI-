# Spec 006 — The Hidden Examiner

## Problem

The RAM harness found RAM properly only because two intelligences babysat it
(~15 supervised interventions: recall blindness, silent tool failure, wrong
drops, design rulings). The harness verifies *products*; nothing verifies the
*harness*. For Find-Me-X to generalise, building a chassis for a new domain
must not cost another babysitting campaign.

The babysitting produced one priceless asset: a **certified answer key**. The
RAM harness's verdicts were audited by hand, screenshot by screenshot
(screenshots/audit/AUDIT.md). Hand-tuning is fatal in a student and is exactly
what you want in an examiner. "Babysat" means *certified*.

## Goal

An examination system that can grade a blank-slate agent (Spec 007 — The
Student) on the Find-Me-X goal, without ever revealing how grading works or
what the answers are. The examiner is the licensed driver promoted to faculty.

The deterministic goal grammar being graded (established by the RAM build):

- **Search 1 (survey):** every shown item is discovered, spec-non-contradicting,
  availability proven on a live render, honestly labelled. Uncertainty flagged,
  never hidden.
- **Search 2 (identity hunt):** every shown item passes a binary identity
  ladder; crown = min(price) over the confirmed set. Uncertainty excluded from
  the board, surfaced in a fallback section.

## Components

### 1. The Frozen World

A record/replay snapshot of the tool belt's traffic: every SERP, page fetch,
and proof-shot from real runs, stored and replayable. The Student's tools hit
the recording, not the internet.

- Episodes become **deterministic, reproducible, and nearly free** (no live
  fetches, no render time; vision reads on identical cached images are cached).
- The world preserves the real noise ratio (~60 candidates → ~9 true in our
  funnel). Mostly mines, thin treasure.
- v1 world: one recorded crawl, 5–6 retailers, 3 specs, ~20-item answer key.

### 2. The Specimen Manifest (trap taxonomy)

Curated, labelled distractors pinned into the world — all real specimens from
the RAM build's logs. The taxonomy is retail physics and transfers to any
domain; only the specimens are RAM-flavoured.

| Trap | Specimen | What it tests |
|---|---|---|
| Ghost listing | UMart/MSY Fury Beast $149 notify-me — the CHEAPEST exact-spec item in the world | Availability verification. Rewards the lazy student maximally (honeypot principle: the best trap is the most tempting) |
| Wrong-but-close SKU | SODIMMs, 1×32 kits, 3600 CL18 variant of the hunted product, CL22 value RAM, $849 Dell ECC/RDIMM | Per-attribute discrimination |
| Identity twin | Ripjaws V vs Trident Z RGB — identical specs, different product | Attributes ≠ identity |
| Irrelevant, in-stock, cheap | Homedics massagers $10–12, horse calendar $9.80 | "Buyable" never substitutes for "correct" |
| Category/listing page | Mwave trending, PLE categories | Dual-use: skip as product, harvest as inventory — opposite correct behaviours by context |
| Marketplace search page | Amazon/eBay search URLs with stray JSON-LD prices | Structured data can lie about page type |
| Dead / walled | sbtech 404, eBay/dicksmith 403, DDG 200-OK bot-wall with zero results | Honest failure handling |
| Parse trap | Header-cart "$0.00", "4 × $104" Afterpay, was-prices, "so dimm" spacing, "3200MT/S"-as-part-number, MHz-less MemOZ titles | Text is adversarial |
| Half-loaded page | The blank Mwave render | Patience is a verification skill |

### 3. The Answer Key

- v1 (RAM): the harness's verdicts on the frozen world, human-audited.
- Domain #2+ keys do **not** require a harness: freeze a small world, hand-
  verify ~20 items (a human afternoon). The expensive thing was learning what
  to grade; grading is cheap.
- Every key is certified by human audit before use. A wrong key teaches wrong.

### 4. The Judge Protocol

- Input: a Student submission (its answer set for the request).
- Output: **exactly three things** — a scalar score, category hints, pass/fail.
  Never item-level answers. Never the key. Never the harness's existence.
- **Asymmetric loss** (the harness's own values as a loss function):
  irrelevant item shown ≫ ghost/wrong-SKU shown > real item missed.
  Symmetric grading teaches spraying; asymmetric grading teaches verification.
- Grading is deterministic: same submission → same score, always.

## Behavioural claims

**C1 — The examiner is sealed.** The Student never sees the key, the harness,
its code, its skills, or its verdict reasoning. The only leakage channel is
(score, category hints, pass/fail).

**C2 — Grading is deterministic.** Same world + same submission → same score.

**C3 — Loss is asymmetric.** Showing a ghost, wrong SKU, or irrelevant item
costs more than missing a real one. Weights are key-level configuration.

**C4 — Feedback is category-grade, never item-grade.** "Something you show is
not really available" is legal; "the UMart listing is out of stock" is not.

**C5 — The world is frozen and reproducible.** A trial can be replayed
byte-identical. Live-web exams are out of scope for v1.

**C6 — Trap coverage.** Every taxonomy row above is present in the v1 world
with at least one specimen, at a realistic noise ratio.

**C7 — Keys are certified.** No key grades a student before a human has
audited it (the AUDIT.md procedure is the template).

**C8 — The examiner never teaches.** No hints about method, sources, tools, or
what verification means. Discovery is the exam.

## Out of scope (v1)

- Live-web examinations (moving ground truth).
- Multi-domain keys (exam #2 is its own effort — a hand-verified frozen world).
- Using the Student's output to improve the harness (bootstrapping comes after
  a graduation).
- Any fine-tuning or model training; the examiner grades behaviour, not weights.
