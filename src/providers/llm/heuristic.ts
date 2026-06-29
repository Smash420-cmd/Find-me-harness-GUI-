/**
 * HeuristicLLMProvider — a deterministic stand-in for a real model, so the
 * conversational door works without an API key. It reads the user's free text
 * and returns the converge protocol envelope (propose / clarify). The real path
 * is identical: the engine still Zod-parses this output before the command path
 * (Law 5), and the domain parser still rejects impossible specs. Swap in an
 * AnthropicProvider here with no change to engine/converge.
 */
import type { ILLMProvider } from "../index.js";

function extractUserText(prompt: string): string {
  // The converge prompt embeds "user: ..." / "assistant: ..." transcript lines.
  const lines = prompt.split("\n").filter((l) => l.toLowerCase().startsWith("user:"));
  return (lines.at(-1) ?? prompt).replace(/^user:/i, "").trim();
}

export class HeuristicLLMProvider implements ILLMProvider {
  readonly name = "heuristic";

  async complete(prompt: string): Promise<string> {
    const t = extractUserText(prompt).toLowerCase();

    const gen = /ddr([45])\b/.exec(t);
    const speed = /\b(\d{4,5})\s*(?:mhz|mt\/?s)\b/.exec(t) ?? /\bddr[45][- ](\d{4,5})\b/.exec(t);
    if (!gen || !speed) {
      return JSON.stringify({
        action: "clarify",
        question: "Which DDR generation and speed do you want (e.g. DDR5-6000)?",
      });
    }

    const kit = /\b(\d+)\s*x\s*(\d+)\s*gb\b/.exec(t);
    const totalGb = /\b(\d+)\s*gb\b/.exec(t);
    const cas = /\bcl\s*(\d+)\b/.exec(t);
    const budget = /\$\s*(\d+)|\bunder\s*\$?\s*(\d+)|\b(\d+)\s*(?:dollars|aud|budget)\b/.exec(t);

    const fields: Record<string, unknown> = {
      generation: `DDR${gen[1]}`,
      dataRateMtps: Number(speed[1]),
    };
    if (kit) {
      fields.kitCount = Number(kit[1]);
      fields.perStickGb = Number(kit[2]);
      fields.capacityGb = Number(kit[1]) * Number(kit[2]);
    } else if (totalGb) {
      fields.capacityGb = Number(totalGb[1]);
    }
    if (cas) fields.casLatency = Number(cas[1]);
    if (budget) fields.budgetAud = Number(budget[1] ?? budget[2] ?? budget[3]);

    if (fields.capacityGb === undefined) {
      return JSON.stringify({ action: "clarify", question: "How much total capacity (e.g. 32GB)?" });
    }
    return JSON.stringify({ action: "propose", fields });
  }
}
