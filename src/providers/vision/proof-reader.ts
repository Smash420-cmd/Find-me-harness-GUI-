/**
 * ClaudeProofReader — reads a proof shot with Claude vision, guided by the
 * sales-page guide. Domain-free; the chassis supplies a thin `domainHint`.
 *
 * Economics (the /oncrack plan): the vision read is the EXPENSIVE, accurate
 * tool at the bottom of the belt. Default model is Haiku (cheap eyes); escalate
 * to a stronger model only when Haiku's confidence is low. Reads are cached by
 * image hash so a re-read of the same shot is free — and, per the distillation
 * plan, every (image → reading) pair the cache accumulates is training data for
 * a future per-site extractor that runs for nothing.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IProofReader, ProofReading } from "../index.js";
import { buildReaderPrompt } from "./sales-page-guide.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const EMPTY: ProofReading = {
  pageType: "other",
  available: "unknown",
  availabilityEvidence: "",
  price: null,
  currency: null,
  title: null,
  identifiers: [],
  confidence: 0,
  notes: "reader produced no usable output",
};

/** Coerce arbitrary model JSON into a valid ProofReading (never trust the shape). */
function coerce(raw: unknown): ProofReading {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pageTypes = ["product", "category", "search", "error", "blocked", "other"] as const;
  const avails = ["in_stock", "out_of_stock", "preorder", "unknown"] as const;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return {
    pageType: (pageTypes as readonly string[]).includes(o.pageType as string) ? (o.pageType as ProofReading["pageType"]) : "other",
    available: (avails as readonly string[]).includes(o.available as string) ? (o.available as ProofReading["available"]) : "unknown",
    availabilityEvidence: typeof o.availabilityEvidence === "string" ? o.availabilityEvidence : "",
    price: num(o.price),
    currency: typeof o.currency === "string" && o.currency ? o.currency : null,
    title: typeof o.title === "string" && o.title ? o.title : null,
    identifiers: Array.isArray(o.identifiers) ? o.identifiers.filter((x): x is string => typeof x === "string" && x.length > 0) : [],
    confidence: typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0,
    notes: typeof o.notes === "string" ? o.notes : "",
  };
}

/** Parse the first JSON object out of a model response (tolerates prose/fences). */
export function parseReadingJson(text: string): ProofReading {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return { ...EMPTY, notes: "no JSON in reader output" };
  try {
    return coerce(JSON.parse(m[0]));
  } catch {
    return { ...EMPTY, notes: "unparseable JSON in reader output" };
  }
}

export interface ClaudeProofReaderOptions {
  readonly client?: Anthropic; // injectable for tests
  readonly model?: string; // default Haiku (cheap eyes)
  readonly cacheDir?: string; // image-hash cache; also the distillation corpus
}

export class ClaudeProofReader implements IProofReader {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly cacheDir?: string;

  constructor(opts: ClaudeProofReaderOptions = {}) {
    this.client = opts.client ?? new Anthropic();
    this.model = opts.model ?? "claude-haiku-4-5";
    this.cacheDir = opts.cacheDir;
    if (this.cacheDir) mkdirSync(this.cacheDir, { recursive: true });
  }

  async read(imageBase64: string, opts?: { domainHint?: string; want?: string }): Promise<ProofReading> {
    const cachePath = this.cacheDir
      ? join(this.cacheDir, `${sha(imageBase64 + (opts?.domainHint ?? "") + (opts?.want ?? ""))}.json`)
      : undefined;
    if (cachePath && existsSync(cachePath)) {
      return JSON.parse(readFileSync(cachePath, "utf8")) as ProofReading;
    }
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: imageBase64 } },
            { type: "text", text: buildReaderPrompt(opts) },
          ],
        },
      ],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
    const reading = parseReadingJson(text);
    if (cachePath) writeFileSync(cachePath, JSON.stringify(reading, null, 1));
    return reading;
  }
}
