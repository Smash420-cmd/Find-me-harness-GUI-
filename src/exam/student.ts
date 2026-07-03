/**
 * The Student (Spec 007, Plan Step 6) — constitution, primitive tools, and
 * the Anthropic model adapter.
 *
 * Everything here obeys the litmus test: rules of the world in, exam content
 * out. Tool names are neutral verbs; descriptions never hint at method; no
 * string a tool returns may carry examiner vocabulary (Spec 006 C1).
 *
 * Tools are replay-backed: the Student lives entirely inside a frozen world.
 * `run_script` (user ruling 2026-07-04: "yes 100%") lets it distill its own
 * reasoning into executable code — workspace-jailed, budget-counted, network
 * poisoned so a script cannot escape the snapshot.
 */
import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { replayFetch, ReplayValidator } from "./world.js";
import type { Msg, ModelTurn, StudentModel, ToolImpl, ToolSpec } from "./episode.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Build the Anthropic client for exam runs. The ONLY sanctioned credential is a
 * dedicated metered API key in STUDENT_API_KEY (Commercial Terms — no automation
 * restrictions, no ambiguity).
 *
 * NOT supported, on purpose (verified against Anthropic's terms, 2026-07):
 *  - the user's ANTHROPIC_API_KEY (their business key — off-limits for testing).
 *  - a subscription (Pro/Max) OAuth token. Using a consumer OAuth token with the
 *    SDK is a Consumer-ToS violation that has led to ACCOUNT SUSPENSIONS
 *    (Jan 2026 enforcement; Feb 2026: the Agent SDK explicitly requires API-key
 *    auth). Only the official `claude` CLI may ride a subscription. So the exam,
 *    which is SDK code, must use a real API key — never a Max token.
 */
export function studentClient(): Anthropic {
  const apiKey = process.env.STUDENT_API_KEY?.trim();
  if (apiKey) return new Anthropic({ apiKey });
  throw new Error(
    "refusing to run: set STUDENT_API_KEY to a dedicated metered API key. " +
      "The exam is SDK code — it must NOT use ANTHROPIC_API_KEY (business key) " +
      "or any Pro/Max OAuth token (a Consumer-ToS violation / account-ban risk).",
  );
}

// ── the constitution (Spec 007, verbatim — the ENTIRE system prompt) ──────

export const CONSTITUTION = `You have these tools: search, fetch, screenshot, read_screenshot, write_file, run_script, submit_answer.
Serve the user's request.
You may call submit_answer at most 3 times per episode. Each returns a score and whether you have passed.
You cannot decide you have succeeded. Only a pass verdict ends the task.
Each episode has a hard budget of time and tool calls. Files you write persist between episodes.
If your score has not improved across several episodes, your approach is wrong — change it structurally, do not refine it.`;

// ── the world's search engine ─────────────────────────────────────────────
// Raw SERP replay would 404 on any query we didn't record, making search
// useless. Instead the world gets its own engine: an index over every
// recorded page — deterministic, and fair (real engines index the real web).

interface IndexEntry {
  readonly url: string;
  readonly title: string;
  readonly text: string;
}

const indexCache = new Map<string, IndexEntry[]>();

function worldIndex(worldDir: string): IndexEntry[] {
  const cached = indexCache.get(worldDir);
  if (cached) return cached;
  const entries: IndexEntry[] = [];
  const fetchDir = join(worldDir, "fetch");
  if (existsSync(fetchDir)) {
    for (const f of readdirSync(fetchDir)) {
      try {
        const rec = JSON.parse(readFileSync(join(fetchDir, f), "utf8")) as { url: string; body?: string };
        if (!rec.body) continue;
        const title = /<title>([\s\S]*?)<\/title>/i.exec(rec.body)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
        const text = rec.body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
        entries.push({ url: rec.url, title, text: text.slice(0, 200_000) });
      } catch {
        /* unreadable record — skip */
      }
    }
  }
  indexCache.set(worldDir, entries);
  return entries;
}

function searchWorld(worldDir: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return "no results";
  const scored = worldIndex(worldDir)
    .map((e) => {
      let score = 0;
      const titleLc = e.title.toLowerCase();
      for (const t of terms) {
        if (titleLc.includes(t)) score += 5;
        // capped term frequency so one giant page doesn't dominate
        score += Math.min(5, e.text.split(t).length - 1);
      }
      return { e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.e.url.localeCompare(b.e.url))
    .slice(0, 10);
  if (scored.length === 0) return "no results";
  return scored.map(({ e }) => `${e.url}${e.title ? ` — ${e.title.slice(0, 90)}` : ""}`).join("\n");
}

// ── tools ─────────────────────────────────────────────────────────────────

function jail(workspace: string, path: string): string {
  const full = resolve(workspace, path);
  if (full !== resolve(workspace) && !full.startsWith(resolve(workspace) + sep)) {
    throw new Error("path is outside your workspace");
  }
  return full;
}

/** The net cage: a --import preload that stubs every network primitive, so a
 * student script cannot escape the snapshot. Written OUTSIDE the workspace —
 * the jail means the Student can never overwrite it. Error text is neutral:
 * from inside, the world simply has no network. */
function netCage(workspace: string): string {
  const p = join(resolve(workspace, ".."), "net-cage.mjs");
  if (!existsSync(p)) {
    writeFileSync(
      p,
      `import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
const dead = () => { throw new Error("network unreachable"); };
globalThis.fetch = async () => dead();
net.connect = dead; net.createConnection = dead; net.Socket.prototype.connect = dead;
tls.connect = dead;
const noDns = (...a) => { const cb = a[a.length - 1]; if (typeof cb === "function") cb(new Error("network unreachable")); };
dns.lookup = noDns; dns.resolve = noDns;
dns.promises.lookup = async () => dead(); dns.promises.resolve = async () => dead();
`,
    );
  }
  return p;
}

export interface StudentToolsOptions {
  readonly worldDir: string;
  readonly workspace: string; // students/<id>/workspace — persists across episodes
  /** Vision model for read_screenshot — the Student's eyes are a cheap tool
   * regardless of what the Student itself is (delegation ruling). */
  readonly visionModel?: string;
  readonly client?: Anthropic; // injectable for tests
}

export function studentTools(opts: StudentToolsOptions): { tools: Record<string, ToolImpl>; toolSpecs: ToolSpec[] } {
  const { worldDir, workspace } = opts;
  mkdirSync(workspace, { recursive: true });
  const doFetch = replayFetch(worldDir);
  const renderer = new ReplayValidator(worldDir);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  const tools: Record<string, ToolImpl> = {
    async search(input) {
      return searchWorld(worldDir, str((input as { query?: unknown })?.query));
    },

    async fetch(input) {
      const { url, saveTo } = (input ?? {}) as { url?: unknown; saveTo?: unknown };
      const body = await doFetch(str(url));
      if (str(saveTo)) writeFileSync(jail(workspace, str(saveTo)), body);
      // Return a lean preview, not the whole page: raw HTML dumped into context
      // every fetch is what makes a long episode expensive. Full content goes to
      // the workspace (saveTo) for run_script to parse cheaply.
      const cap = 6_000;
      return body.length > cap
        ? `${body.slice(0, cap)}\n…(truncated — ${body.length} chars total${str(saveTo) ? `, full copy in ${str(saveTo)}` : "; pass saveTo then parse it with run_script instead of re-fetching"})`
        : body;
    },

    async screenshot(input) {
      const url = str((input as { url?: unknown })?.url);
      await renderer.capture({ url, mustShow: "" }); // throws the recorded error on a bad page
      return `screenshot of ${url} is available — use read_screenshot to look at it`;
    },

    async read_screenshot(input) {
      const { url, question } = (input ?? {}) as { url?: unknown; question?: unknown };
      const png = join(worldDir, "capture", `${sha(str(url))}.png`);
      if (!existsSync(png)) return "no screenshot has been taken of that url";
      const image = readFileSync(png);
      const cacheDir = join(worldDir, "vision");
      mkdirSync(cacheDir, { recursive: true });
      const cachePath = join(cacheDir, `${sha(sha(image.toString("base64")) + str(question))}.json`);
      if (existsSync(cachePath)) return (JSON.parse(readFileSync(cachePath, "utf8")) as { answer: string }).answer;
      const client = opts.client ?? studentClient();
      const res = await client.messages.create({
        model: opts.visionModel ?? "claude-haiku-4-5",
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: image.toString("base64") } },
              { type: "text", text: `Answer based only on what is visible in this screenshot. ${str(question)}` },
            ],
          },
        ],
      });
      const answer = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
      writeFileSync(cachePath, JSON.stringify({ question: str(question), answer }));
      return answer;
    },

    async write_file(input) {
      const { path, content } = (input ?? {}) as { path?: unknown; content?: unknown };
      const full = jail(workspace, str(path));
      mkdirSync(resolve(full, ".."), { recursive: true });
      writeFileSync(full, str(content));
      return `wrote ${str(path)} (${str(content).length} characters)`;
    },

    async run_script(input) {
      const file = jail(workspace, str((input as { file?: unknown })?.file));
      if (!existsSync(file)) return "no such file in your workspace";
      return new Promise((resolveP) => {
        execFile(
          process.execPath,
          ["--import", pathToFileURL(netCage(workspace)).href, file],
          {
            cwd: workspace,
            timeout: 15_000,
            maxBuffer: 1024 * 1024,
            env: { PATH: process.env.PATH ?? "" }, // no API keys, no proxy config — a bare world
          },
          (err, stdout, stderr) => {
            const out = [stdout, stderr].filter(Boolean).join("\n").slice(0, 12_000);
            resolveP(err && out.length === 0 ? `script failed: ${err.message.slice(0, 200)}` : out || "(no output)");
          },
        );
      });
    },
  };

  const toolSpecs: ToolSpec[] = [
    { name: "search", description: "Search for pages. Returns matching URLs with titles.", schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "fetch", description: "Fetch a URL. Returns the beginning of its content; pass saveTo to keep a full copy in your workspace.", schema: { type: "object", properties: { url: { type: "string" }, saveTo: { type: "string" } }, required: ["url"] } },
    { name: "screenshot", description: "Take a screenshot of a URL.", schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
    { name: "read_screenshot", description: "Ask a question about the screenshot of a URL. Returns an answer.", schema: { type: "object", properties: { url: { type: "string" }, question: { type: "string" } }, required: ["url", "question"] } },
    { name: "write_file", description: "Write a file in your workspace.", schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    { name: "run_script", description: "Run a JavaScript (.mjs) file from your workspace with Node. Returns its output.", schema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] } },
  ];

  return { tools, toolSpecs };
}

// ── the Anthropic model adapter ───────────────────────────────────────────
// Keeps its own native conversation per episode (episodes are fresh anyway);
// the runner's transcript drives it turn by turn.

export class AnthropicStudentModel implements StudentModel {
  private messages: Anthropic.MessageParam[] = [];
  private system = "";
  private pendingToolUseId: string | null = null;
  private started = false;
  private readonly client: Anthropic;
  cacheRead = 0; // observability: tokens served from cache (~0.1x price)
  uncached = 0; // tokens billed at full price

  constructor(private readonly model: string, client?: Anthropic) {
    this.client = client ?? studentClient();
  }

  /** Keep exactly one rolling cache breakpoint: on the last message's last
   * content block. Clear any prior one so we never exceed 4 breakpoints
   * (system holds one; this is the second). */
  private markCacheBreakpoint(): void {
    for (const m of this.messages) {
      if (Array.isArray(m.content)) for (const b of m.content) delete (b as { cache_control?: unknown }).cache_control;
    }
    const last = this.messages[this.messages.length - 1];
    if (!last) return;
    if (typeof last.content === "string") last.content = [{ type: "text", text: last.content }];
    const blocks = last.content as Array<{ cache_control?: { type: "ephemeral" } }>;
    if (blocks.length > 0) blocks[blocks.length - 1]!.cache_control = { type: "ephemeral" };
  }

  async next(transcript: Msg[], tools: ToolSpec[]): Promise<ModelTurn> {
    if (!this.started) {
      this.system = transcript.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const request = transcript.find((m) => m.role === "user");
      this.messages.push({ role: "user", content: request?.content ?? "" });
      this.started = true;
    } else {
      // The runner appended either a tool result (after a tool call) or a
      // plain user nudge (after a text-only turn — see the runner's idle path).
      const last = transcript[transcript.length - 1];
      if (last?.role === "tool" && this.pendingToolUseId) {
        this.messages.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: this.pendingToolUseId, content: last.content }],
        });
        this.pendingToolUseId = null;
      } else if (last?.role === "user") {
        this.messages.push({ role: "user", content: last.content });
      }
    }

    // Roll a cache breakpoint onto the last message each turn: the whole prior
    // transcript (which we re-send every tool call) then bills at ~0.1x instead
    // of full price. Combined with the cached system+tools block, this is the
    // difference between linear and quadratic $ over a long agentic episode.
    this.markCacheBreakpoint();

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      // Cached together (tools render before system): stable across the episode.
      system: [{ type: "text", text: this.system, cache_control: { type: "ephemeral" } }],
      // One tool per turn: the runner's loop answers one tool_result at a time,
      // and each call is budget-counted, so parallel calls must be off.
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: (t.schema ?? { type: "object", properties: {} }) as Anthropic.Tool["input_schema"],
      })),
      messages: this.messages,
    });

    this.messages.push({ role: "assistant", content: res.content });
    if (res.usage) {
      const u = res.usage as { cache_read_input_tokens?: number; cache_creation_input_tokens?: number; input_tokens?: number };
      this.cacheRead += u.cache_read_input_tokens ?? 0;
      this.uncached += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    }
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
    const toolUse = res.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
    if (toolUse) {
      this.pendingToolUseId = toolUse.id;
      return { ...(text ? { text } : {}), toolCall: { name: toolUse.name, input: toolUse.input } };
    }
    return text ? { text } : {};
  }
}
