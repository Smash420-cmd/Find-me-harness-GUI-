/**
 * World MCP server (the ToS-clean, on-Max student path).
 *
 * Exposes the 7 world-backed tools over MCP stdio so the OFFICIAL `claude` CLI
 * can BE the student — running on the user's Max plan, no metered key, no OAuth
 * token trick (using the `claude` binary on a subscription is explicitly
 * permitted; using a subscription token in the SDK is the banned pattern).
 *
 * Reuses the tested tool bodies from studentTools; the two differences from the
 * SDK student:
 *   - read_screenshot returns the PNG as an MCP image block, so Claude Code
 *     reads the proof shot with its OWN native vision (free, on Max) instead of
 *     a separate vision API call.
 *   - submit_answer runs the judge here and returns the verdict.
 *
 * Minimal hand-rolled JSON-RPC (no MCP SDK dependency): initialize, tools/list,
 * tools/call, and the initialized notification. Newline-delimited JSON on
 * stdin/stdout; logs go to stderr so they never corrupt the protocol stream.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { studentTools } from "./student.js";
import { judge, loadKey, type AnswerKey } from "./judge.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const log = (msg: string) => process.stderr.write(`[world-mcp] ${msg}\n`);

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<{ content: unknown[]; isError?: boolean }>;
}

export function buildWorldTools(opts: {
  worldDir: string;
  workspace: string;
  key: AnswerKey;
  examId: string;
  maxSubmissions: number;
  /** Verdicts append here as JSONL so the CLI orchestrator (which doesn't own
   * the MCP subprocess's stderr) can read episode scores back. */
  submissionsLog?: string;
  episode?: number;
}): McpTool[] {
  const base = studentTools({ worldDir: opts.worldDir, workspace: opts.workspace });
  const spec = new Map(base.toolSpecs.map((t) => [t.name, t]));
  const text = (s: string) => ({ content: [{ type: "text", text: s }] });

  const tools: McpTool[] = [];
  // search, fetch, screenshot, write_file, run_script — reuse tested bodies verbatim.
  for (const name of ["search", "fetch", "screenshot", "write_file", "run_script"] as const) {
    const s = spec.get(name)!;
    tools.push({
      name,
      description: s.description,
      inputSchema: (s.schema ?? { type: "object", properties: {} }) as Record<string, unknown>,
      handler: async (args) => text(await base.tools[name]!(args)),
    });
  }

  // read_screenshot — return the PNG as an image block; Claude Code reads it natively.
  tools.push({
    name: "read_screenshot",
    description: "Look at the screenshot of a URL you have taken. Returns the image.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    handler: async (args) => {
      const url = typeof args.url === "string" ? args.url : "";
      const png = join(opts.worldDir, "capture", `${sha(url)}.png`);
      if (!existsSync(png)) return text("no screenshot has been taken of that url");
      return { content: [{ type: "image", data: readFileSync(png).toString("base64"), mimeType: "image/png" }] };
    },
  });

  // submit_answer — the judge lives here. In-process count (one episode = one process).
  let submissions = 0;
  tools.push({
    name: "submit_answer",
    description: "Submit your answer: the list of product-page URLs you are presenting. Returns a score and whether you have passed.",
    inputSchema: { type: "object", properties: { urls: { type: "array", items: { type: "string" } } }, required: ["urls"] },
    handler: async (args) => {
      const urls = Array.isArray(args.urls) ? (args.urls as unknown[]).map(String) : [];
      const verdict = judge({ examId: opts.examId, shown: urls }, opts.key);
      submissions++;
      const left = opts.maxSubmissions - submissions;
      log(`SUBMISSION ${submissions} score=${verdict.score} pass=${verdict.pass}`);
      if (opts.submissionsLog) {
        appendFileSync(opts.submissionsLog, JSON.stringify({ episode: opts.episode, n: submissions, score: verdict.score, pass: verdict.pass, urls }) + "\n");
      }
      if (verdict.pass) return text("You have passed. The task is complete.");
      const hints = verdict.categories.length ? ` Feedback: ${verdict.categories.join("; ")}.` : "";
      const capped = left <= 0 ? " You have no submissions left this episode." : ` Submissions left: ${left}.`;
      return text(`Not passed. Score: ${verdict.score}.${hints}${capped}`);
    },
  });

  return tools;
}

// ── minimal JSON-RPC stdio loop ───────────────────────────────────────────

function reply(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function replyError(id: unknown, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

export async function runWorldMcpServer(tools: McpTool[]): Promise<void> {
  const byName = new Map(tools.map((t) => [t.name, t]));
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) void handle(line);
    }
  });

  async function handle(line: string): Promise<void> {
    let msg: { id?: unknown; method?: string; params?: Record<string, unknown> };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const { id, method, params } = msg;
    if (method === "initialize") {
      reply(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "world", version: "1.0.0" },
      });
    } else if (method === "notifications/initialized") {
      // no response to notifications
    } else if (method === "tools/list") {
      reply(id, { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
    } else if (method === "tools/call") {
      const name = params?.name as string;
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      const tool = byName.get(name);
      if (!tool) return replyError(id, -32602, `unknown tool: ${name}`);
      try {
        reply(id, await tool.handler(args));
      } catch (e) {
        reply(id, { content: [{ type: "text", text: String(e instanceof Error ? e.message : e) }], isError: true });
      }
    } else if (id !== undefined) {
      replyError(id, -32601, `method not found: ${method}`);
    }
  }
}

/** Entry point — env-driven so the orchestrator can spawn it via --mcp-config. */
export async function main(): Promise<void> {
  const worldDir = process.env.WORLD_DIR!;
  const workspace = process.env.STUDENT_WORKSPACE!;
  const key = loadKey(process.env.KEY_PATH!); // throws if uncertified (C7)
  const examId = process.env.EXAM_ID!;
  const maxSubmissions = Number(process.env.MAX_SUBMISSIONS ?? "3");
  const submissionsLog = process.env.SUBMISSIONS_LOG;
  const episode = process.env.EPISODE ? Number(process.env.EPISODE) : undefined;
  log(`serving world=${worldDir} exam=${examId} (key by ${key.certifiedBy})`);
  await runWorldMcpServer(buildWorldTools({ worldDir, workspace, key, examId, maxSubmissions, ...(submissionsLog ? { submissionsLog } : {}), ...(episode ? { episode } : {}) }));
}

// Run as a standalone server when invoked directly (Claude Code --mcp-config
// points at `node dist/exam/world-mcp.js`). pathToFileURL handles the
// file:// vs file:/// slash difference cross-platform.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
