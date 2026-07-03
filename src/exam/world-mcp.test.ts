/** World MCP server — offline verification of the JSON-RPC handshake and tool
 *  calls by speaking the protocol to a spawned server process. No model, no
 *  network: this proves the MCP layer works before it ever meets `claude`. */
import { describe, expect, it, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** A tiny world with one product page + one proof shot, and a certified key. */
function makeWorld() {
  const dir = mkdtempSync(join(tmpdir(), "mcpw-"));
  mkdirSync(join(dir, "fetch"), { recursive: true });
  mkdirSync(join(dir, "capture"), { recursive: true });
  const url = "https://a.shop/widget-1";
  writeFileSync(join(dir, "fetch", `${sha(url)}.json`), JSON.stringify({ url, body: "<html><title>Widget One</title><body>widget for sale $49</body></html>" }));
  writeFileSync(join(dir, "capture", `${sha(url)}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47])); // fake PNG
  writeFileSync(join(dir, "key.json"), JSON.stringify({
    certifiedBy: "test", certifiedAt: "2026-07-04", passMark: 0.9,
    weights: { missedTruth: 1, ghostShown: 3, wrongShown: 3, irrelevantShown: 5, unknownShown: 2 },
    exams: [{ id: "t", request: "find a widget", truths: [{ url, title: "Widget One", priceAud: 49 }], traps: [] }],
  }));
  return { dir, url, workspace: mkdtempSync(join(tmpdir(), "mcpws-")) };
}

/** Spawn the server, send JSON-RPC lines, collect id-keyed responses. */
function rpc(world: { dir: string; workspace: string }, requests: object[]): Promise<Map<number, any>> {
  return new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, ["dist/exam/world-mcp.js"], {
      env: { ...process.env, WORLD_DIR: world.dir, STUDENT_WORKSPACE: world.workspace, KEY_PATH: join(world.dir, "key.json"), EXAM_ID: "t", MAX_SUBMISSIONS: "3" },
      stdio: ["pipe", "pipe", "inherit"],
    });
    const out = new Map<number, any>();
    let buf = "";
    const wantIds = new Set(requests.map((r: any) => r.id).filter((x) => x !== undefined));
    srv.stdout.setEncoding("utf8");
    srv.stdout.on("data", (c: string) => {
      buf += c;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.id !== undefined) { out.set(msg.id, msg); wantIds.delete(msg.id); }
        if (wantIds.size === 0) { srv.kill(); resolve(out); }
      }
    });
    srv.on("error", reject);
    setTimeout(() => { srv.kill(); reject(new Error("mcp server timeout")); }, 15_000);
    for (const r of requests) srv.stdin.write(JSON.stringify(r) + "\n");
  });
}

describe("world MCP server (offline JSON-RPC)", () => {
  let world: ReturnType<typeof makeWorld>;
  beforeAll(() => { world = makeWorld(); });

  it("initializes, lists the 7 tools, searches, reads a screenshot as an image, and judges a submission", async () => {
    const res = await rpc(world, [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search", arguments: { query: "widget one" } } },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "read_screenshot", arguments: { url: world.url } } },
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "submit_answer", arguments: { urls: [world.url] } } },
    ]);

    // initialize
    expect(res.get(1).result.serverInfo.name).toBe("world");
    // tools/list — all seven, neutral names
    const names = res.get(2).result.tools.map((t: any) => t.name).sort();
    expect(names).toEqual(["fetch", "read_screenshot", "run_script", "screenshot", "search", "submit_answer", "write_file"]);
    // search returns the product URL
    expect(res.get(3).result.content[0].text).toContain("https://a.shop/widget-1");
    // read_screenshot returns an IMAGE block (Claude Code reads it natively)
    expect(res.get(4).result.content[0].type).toBe("image");
    expect(res.get(4).result.content[0].mimeType).toBe("image/png");
    // submit_answer judged the correct answer → pass
    expect(res.get(5).result.content[0].text).toContain("You have passed");
  });

  it("a wrong submission is judged, not passed", async () => {
    const res = await rpc(world, [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "submit_answer", arguments: { urls: [] } } },
    ]);
    expect(res.get(2).result.content[0].text).toContain("Not passed");
  });
});
