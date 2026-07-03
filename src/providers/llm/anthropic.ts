/**
 * AnthropicLLMProvider — wraps the Anthropic SDK to implement ILLMProvider.
 * Swap this in at the composition root (server.ts); nothing else changes.
 * The caller still Zod-parses the output before the command path (Law 5).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ILLMProvider } from "../index.js";

export class AnthropicLLMProvider implements ILLMProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = "claude-haiku-4-5-20251001") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(prompt: string, opts?: { promptHash?: string; system?: string }): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      ...(opts?.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    if (block?.type !== "text") throw new Error("Anthropic returned no text block");
    return block.text;
  }
}
