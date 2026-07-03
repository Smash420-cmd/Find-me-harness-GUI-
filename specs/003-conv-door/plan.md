# Plan 003 — Conversational Door (real model)

**Against:** `spec.md` (003) · **Obeys:** constitution · **Touches:** 5 files,
~150 lines · **Does NOT touch:** `engine/verify/`, chassis verify/rank/spec,
the seam.

---

## Files changed

| File | What changes |
| :-- | :-- |
| `src/providers/llm/anthropic.ts` | New — `AnthropicLLMProvider` implementing `ILLMProvider` |
| `src/chassis/ram/index.ts` | Export `RAM_CONV_CONTEXT` — the domain prompt string |
| `src/engine/converge/index.ts` | Accept optional `context` param; prepend to prompt |
| `src/ui/server.ts` | Swap provider; inject context; accept `turns[]` from body |
| `src/ui/page.ts` | Multi-turn UI: accumulate turns, bypass path, one-round cap |

---

## Step 0 — Protocol envelope: add `note` to `propose`

The `ConvEnvelope` `propose` action gets an optional `note?: string` field.
When the model defaults because the user couldn't answer, it populates this.
The `ConvergeResult` kind `"spec"` carries the note through to the server,
which includes it in the JSON response. The UI renders it as a visible warning
banner above the results. No engine or chassis change needed.

```
src/engine/converge/index.ts  (+3 lines to schema + result type)
src/ui/server.ts               (pass note through to response)
src/ui/page.ts                 (render warning banner if note present)
```

---

## Step 1 — `AnthropicLLMProvider`

Thin wrapper around the Anthropic SDK. Implements `ILLMProvider.complete`.
Uses `claude-haiku-4-5-20251001` by default (fast, cheap for convergence).
System prompt is passed as the Anthropic `system` field so it doesn't leak
into the transcript. No retry logic — a failed call throws and the server's
catch returns a 500.

```
src/providers/llm/anthropic.ts  (~30 lines)
```

---

## Step 2 — `RAM_CONV_CONTEXT` in chassis

The RAM chassis exports a versioned string describing what fields a RAM spec
can contain, their valid ranges, and what "impossible" looks like. This is
the only domain knowledge the model needs to produce well-formed `fields`.

Changing this string is a logic change (Law 10) — it lives in the chassis,
not the engine or UI.

```
src/chassis/ram/index.ts  (add ~15 lines)
```

---

## Step 3 — `fromConversation` accepts `context`

Add an optional `context: string` parameter. When present it is prepended to
`renderPrompt` as additional instruction before the transcript. The engine
remains domain-free — it never reads the context string, just passes it
through.

```
src/engine/converge/index.ts  (~5 lines)
```

---

## Step 4 — Server wiring

- Import `AnthropicLLMProvider`; use it when `ANTHROPIC_API_KEY` env var is
  set, fall back to `HeuristicLLMProvider` otherwise (so the server still
  works without a key).
- Pass `RAM_CONV_CONTEXT` to `fromConversation`.
- Accept `turns: Turn[]` in the request body as an alternative to `text`.
  Both paths feed `fromConversation` identically.

```
src/ui/server.ts  (~20 lines changed)
```

---

## Step 5 — UI multi-turn

When a `clarify` response comes back:
1. Show the question beneath the input.
2. Replace the input placeholder with "Your answer…".
3. Store the turn history (original message + assistant question).
4. On next submit, send `turns[]` with the user's answer appended.
5. After one clarify/answer exchange, submit and expect `propose` or
   `impossible` — no second clarify loop.

Bypass: if the user submits an empty answer, send it as-is. The model
proceeds with whatever it can infer (C3).

```
src/ui/page.ts  (~40 lines changed)
```

---

## Done when

All seven acceptance criteria from spec.md hold:

| C | Test |
| :-- | :-- |
| C1 | Malformed model response → `SpecInvalidError`, no engine run |
| C2 | Vague first message → single clarifying question |
| C3 | "doesn't matter" answer → loose `propose`, engine runs |
| C4 | "DDR4 @ 8000" → `impossible` → error shown, no engine run |
| C5 | Second submit carries full turn history |
| C6 | `engine/converge/index.ts` has no RAM word; `/analyze` green |
| C7 | Provider swap = one line in `server.ts` |
