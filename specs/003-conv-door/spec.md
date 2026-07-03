# Spec 003 — Conversational Door (real model)

**Artifact:** `spec.md` · **Phase:** 1 (Specify) · **Scope:** WHAT + WHY, no
tech stack · **Governs:** the conversational convergence path only ·
**Obeys:** `constitution.md` (all 11 laws)

> The engine is unchanged. This spec touches only the convergence layer and its
> wiring — not `engine/verify/`, not the chassis, not the seam.

---

## Why this exists

The structured door knows exactly what the user wants. The conversational door
exists for everyone else: "fast DDR5 32GB for a 7800X3D build" or "just show me
some DDR4 options." v1 stubbed it with a heuristic regex provider. This spec
replaces that stub with a real model, adds the multi-turn path the UI currently
drops, and defines how "I'm just searching" is honoured rather than forced into
precision.

---

## What must not change

- `engine/verify/` — human-gated core, untouched (Law 3).
- The seam — `engine/converge` remains domain-free. It speaks only `Spec`,
  `Turn`, `ConvergeResult`. No RAM word crosses into the engine (Law 7).
- The output contract — the conversational door produces the **same `Spec`** as
  the structured door. Everything downstream (engine loop, chassis, verify, rank)
  is blind to which door was used (Spec 001 §A.3).

---

## Behaviour (testable claims)

### C1 — Protocol envelope enforced
The model's output is always Zod-parsed against the three-action envelope
(`propose` / `clarify` / `impossible`) before it can touch the command path.
Malformed output → `SpecInvalidError`. (Law 5, already holds — this is a
statement that the new provider does not bypass it.)

### C2 — Triage: help the user find the answer, up to 3 turns
When the user's intent is unclear, the model does not immediately ask for spec
fields — it **helps the user figure out what they need** by asking about things
they likely know:

- "What motherboard do you have?" → infers DDR generation
- "What CPU?" → narrows generation and compatible speeds
- "Can anyone nearby help you check the board model?"

Each clarifying turn asks **one targeted question**. The model may ask up to
**3 triage questions** across the full conversation before giving up. Questions
should be practical and empathetic — the user may genuinely not know their
hardware. The engine does not run until a spec is proposed or the triage cap is
hit.

### C3 — Default after triage, with warning
If after 3 triage turns the user still cannot provide useful information, the
model **does not ask again**. Instead it:
1. Picks sensible defaults for unresolved fields (e.g. DDR5 32GB 6000 MT/s).
2. Proposes those defaults with a **warning note** explaining what it assumed
   and suggesting the user check their motherboard manual or retailer spec sheet.

The UI surfaces the warning prominently above the results. The engine runs on
the defaulted spec. The confidence layer surfaces uncertainty honestly (Law 6).

### C4 — Impossible spec rejected before the engine runs
If the request is self-contradictory (e.g. DDR4 @ 8000 MT/s), the model emits
`impossible`; `SpecInvalidError` is thrown; the engine does not run. The chassis
domain parser is the authority on possibility — the model's `impossible` is a
first filter, not the last word. If the model proposes impossible fields, the
chassis parser catches them (already holds).

### C5 — Multi-turn: history travels with each request
When a clarifying question is returned, the UI collects the user's answer and
re-submits with the **full turn history** (all prior messages + answers). The
engine does not see the history; convergence does. The UI supports up to **3
clarify turns** before forcing a submit regardless of model response — at that
point the model must propose (with defaults + warning if needed) or declare
impossible.

### C6 — Domain context is chassis-supplied, not engine-baked
The model needs to know what fields to propose (RAM generation, speed, capacity,
etc.). This context is provided by the **chassis** as an opaque string injected
at the call site — it never enters `engine/converge`'s own logic. The engine
remains domain-free.

### C7 — Provider is swappable at the composition root
The real-model provider is wired in `ui/server.ts` (the composition root) in
place of the heuristic stub. No engine or chassis module imports it. Swapping
models = one line at the composition root.

---

## What the chassis must supply (new obligation)

The RAM chassis exports a **convergence context string** — a short, stable
description of the fields a valid RAM spec can contain and their valid ranges.
This is domain knowledge; it belongs in `chassis/ram/`, not in the engine or the
UI.

The context string is versioned alongside the chassis. Changing it is a logic
change (Law 10).

---

## What the UI must handle (new obligations)

1. **Turn accumulation.** The UI holds the conversation history in memory for the
   current request. On a `clarify` response it appends the assistant's question,
   collects the user's answer, and re-submits with the full history.

2. **Bypass path.** The user can submit an empty answer to a clarifying question.
   The UI treats this as a "just proceed" signal and sends it as-is; C3 governs
   the model's response.

3. **Three-round cap.** After 3 clarify/answer exchanges, the UI forces a final
   submit with a system note appended: "Triage cap reached — please propose with
   best-effort defaults." The model must then propose or declare impossible.

---

## What the server must handle

The `/api/find` endpoint accepts either:
- `{ door: "conversational", text: string }` — first turn (backwards-compatible)
- `{ door: "conversational", turns: Turn[] }` — multi-turn continuation

Both paths feed `fromConversation` identically. The distinction is only in how
the body is parsed at the server boundary.

---

## Acceptance criteria (spec is done when these hold)

| ID | Criterion |
| :-- | :-- |
| C1 | A malformed model response throws `SpecInvalidError`, engine does not run |
| C2 | A vague first message triggers a triage question (motherboard/CPU), not a spec field request |
| C3 | After 3 unanswered triage turns → model defaults + warning note shown in UI, engine runs |
| C4 | "DDR4 @ 8000" → `impossible` → `SpecInvalidError`, engine does not run |
| C5 | Second submit carries both turns; model converges to `propose` |
| C6 | `engine/converge/index.ts` contains no RAM word; `/analyze` stays green |
| C7 | Swapping the provider requires no change outside `ui/server.ts` |

---

## Out of scope (do not build ahead of benchmark)

- Source #2, finder/verifier split, eliminate-first (new spec, gated).
- F3 suspiciously-empty alarm (no baseline yet).
- Persistent conversation history across page reloads.
- Any hosted backend (local-first is the model).
