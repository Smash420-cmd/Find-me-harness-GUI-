import { describe, it, expect } from "vitest";
import { z } from "zod";
import { fromStructured, fromConversation, type SpecParser } from "./index.js";
import type { Spec } from "../../types/index.js";
import type { ILLMProvider } from "../../providers/index.js";
import { SpecInvalidError } from "../errors/index.js";

// A tiny domain-free stand-in schema for the engine tests: a positive integer.
const N = z.object({ n: z.number().int().positive() });
type NFields = z.infer<typeof N>;
const parseN: SpecParser<NFields> = (input): Spec<NFields> => {
  const r = N.safeParse(input);
  if (!r.success) throw new SpecInvalidError("invalid", r.error.issues.map((i) => i.message));
  return { fields: r.data };
};

function llmReturning(text: string): ILLMProvider {
  return { name: "fake", complete: async () => text };
}

describe("Task 2 — the two doors", () => {
  describe("deterministic door", () => {
    it("structured input produces a valid Spec", () => {
      const spec = fromStructured({ n: 4 }, parseN);
      expect(spec.fields.n).toBe(4);
    });

    it("structured door CANNOT produce an invalid Spec", () => {
      expect(() => fromStructured({ n: -1 }, parseN)).toThrow(SpecInvalidError);
      expect(() => fromStructured({ nope: true }, parseN)).toThrow(SpecInvalidError);
    });
  });

  describe("conversational door", () => {
    it("a clear 'propose' converges to a Spec", async () => {
      const llm = llmReturning(JSON.stringify({ action: "propose", fields: { n: 7 } }));
      const res = await fromConversation([{ role: "user", content: "seven" }], llm, parseN);
      expect(res).toEqual({ kind: "spec", spec: { fields: { n: 7 } } });
    });

    it("surfaces a single clarifying question", async () => {
      const llm = llmReturning(JSON.stringify({ action: "clarify", question: "how many?" }));
      const res = await fromConversation([{ role: "user", content: "some" }], llm, parseN);
      expect(res).toEqual({ kind: "clarify", question: "how many?" });
    });

    it("rejects an impossible spec → SpecInvalidError", async () => {
      const llm = llmReturning(JSON.stringify({ action: "impossible", reason: "contradiction" }));
      await expect(fromConversation([], llm, parseN)).rejects.toThrow(SpecInvalidError);
    });

    it("a well-formed envelope whose fields fail the domain parser is rejected", async () => {
      const llm = llmReturning(JSON.stringify({ action: "propose", fields: { n: -5 } }));
      await expect(fromConversation([], llm, parseN)).rejects.toThrow(SpecInvalidError);
    });

    it("schema floor: non-JSON model output never crosses (Law 5)", async () => {
      const llm = llmReturning("I think you want some RAM!");
      await expect(fromConversation([], llm, parseN)).rejects.toThrow(SpecInvalidError);
    });

    it("schema floor: malformed envelope is refused (Law 5)", async () => {
      const llm = llmReturning(JSON.stringify({ action: "wat", foo: 1 }));
      await expect(fromConversation([], llm, parseN)).rejects.toThrow(SpecInvalidError);
    });
  });
});
