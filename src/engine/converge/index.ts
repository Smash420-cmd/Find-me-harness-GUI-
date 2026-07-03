/**
 * The two doors (Task 2). Both produce the SAME `Spec`; everything after
 * convergence is blind to which door was used (HARNESSBUILD §A.3).
 *
 * - Deterministic door: structured input → Spec directly, zero LLM. Can only
 *   produce a valid Spec (the chassis parser is the only path; it throws
 *   SpecInvalidError on anything impossible).
 * - Conversational door: dialogue → Spec via an LLM, for fuzzy intent. The LLM
 *   output is ALWAYS Zod-parsed (the schema floor, Law 5) before it can touch
 *   the command path. Owns the single clarifying-question path and the
 *   impossible-spec rejection.
 *
 * Domain-free: the engine receives the chassis's `parseSpec` as a function and
 * never sees the schema's fields.
 */
import { z } from "zod";
import type { Spec } from "../../types/index.js";
import type { ILLMProvider } from "../../providers/index.js";
import { SpecInvalidError } from "../errors/index.js";

/** The chassis-supplied parser: unknown input → Spec, or throws SpecInvalidError. */
export type SpecParser<TFields> = (input: unknown) => Spec<TFields>;

// ── Deterministic door ───────────────────────────────────────────────────────

/** Structured fields → Spec. Valid by construction (parser is the only gate). */
export function fromStructured<TFields>(fields: unknown, parse: SpecParser<TFields>): Spec<TFields> {
  return parse(fields);
}

// ── Conversational door ──────────────────────────────────────────────────────

export type Turn = { readonly role: "user" | "assistant"; readonly content: string };

/** The LLM's only permitted moves, as a protocol envelope (domain-free). */
const ConvEnvelope = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose"), fields: z.unknown(), note: z.string().optional() }),
  z.object({ action: z.literal("clarify"), question: z.string().min(1) }),
  z.object({ action: z.literal("impossible"), reason: z.string().min(1) }),
]);

export type ConvergeResult<TFields> =
  | { readonly kind: "spec"; readonly spec: Spec<TFields>; readonly note?: string }
  | { readonly kind: "clarify"; readonly question: string };

const SYSTEM_PROMPT_HASH = "converge-v1";

/**
 * Drive one conversational turn toward a Spec.
 * - "propose" → the fields are Zod-parsed by the chassis parser → Spec.
 * - "clarify" → the single clarifying question is surfaced (no Spec yet).
 * - "impossible" → rejected with SpecInvalidError (the impossible-spec path).
 *
 * If the model returns anything that is not a valid envelope, it is refused at
 * the schema floor (Law 5) — unparsed output never reaches the command path.
 */
export async function fromConversation<TFields>(
  turns: readonly Turn[],
  llm: ILLMProvider,
  parse: SpecParser<TFields>,
  context?: string,
): Promise<ConvergeResult<TFields>> {
  const prompt = renderPrompt(turns, context);
  const raw = await llm.complete(prompt, { promptHash: SYSTEM_PROMPT_HASH, system: context });

  // Strip markdown code fences — models often wrap JSON in ```json ... ``` despite instructions.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    console.error("[converge] raw LLM output (first 600 chars):", JSON.stringify(raw.slice(0, 600)));
    throw new SpecInvalidError("Conversational door: model output was not valid JSON.");
  }

  const parsed = ConvEnvelope.safeParse(json);
  if (!parsed.success) {
    // Schema floor: malformed model output cannot cross into the command path.
    throw new SpecInvalidError(
      "Conversational door: model output failed the protocol schema.",
      parsed.error.issues.map((i) => i.message),
    );
  }

  const env = parsed.data;
  switch (env.action) {
    case "clarify":
      return { kind: "clarify", question: env.question };
    case "impossible":
      throw new SpecInvalidError(`Impossible request: ${env.reason}`);
    case "propose":
      // Even a well-formed envelope's fields must pass the DOMAIN parser, which
      // is the authority on possibility (e.g. "DDR4 @ 8000MHz" → SpecInvalidError).
      return { kind: "spec", spec: parse(env.fields), note: env.note };
  }
}

function renderPrompt(turns: readonly Turn[], context?: string): string {
  const transcript = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
  const lines = context ? [context, "", "Conversation so far:", transcript] : [
    "Converge the user's intent into a request. Reply with ONE JSON object:",
    '  {"action":"propose","fields":{...}}    when intent is clear,',
    '  {"action":"clarify","question":"..."}  when ONE question is needed,',
    '  {"action":"impossible","reason":"..."} when the request is self-contradictory.',
    "Transcript:",
    transcript,
  ];
  return lines.join("\n");
}
