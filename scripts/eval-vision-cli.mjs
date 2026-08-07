/** T1 — vision eval, on Max via the official `claude` CLI (zero metered $).
 *
 *   node scripts/eval-vision-cli.mjs --world ram-v1 --limit 20
 *
 * One `claude -p` per audit screenshot in worlds/<w>/capture/*.png: native
 * vision through the built-in Read tool, no MCP server, no other tools. The
 * model answers page-type + availability + price as JSON; we score it against
 * the paired capture .json (the recorder's DOM-measured truth: _outOfStock,
 * _addToCart, _visiblePrice).
 *
 * Resumable: results append to results/t1-vision-cli.jsonl and already-scored
 * hashes are skipped, so it can be run in <10-min foreground chunks (Relay
 * kills backgrounded children at turn end).
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const worldDir = join("worlds", arg("world", "ram-v1"));
const capDir = join(worldDir, "capture");
const limit = Number(arg("limit", "999"));
const model = arg("model", "sonnet");
const outDir = join("specs", "006-hidden-examiner", "results");
const outPath = join(outDir, arg("out", "t1-vision-cli.jsonl"));
mkdirSync(outDir, { recursive: true });

const PROMPT = (p) => `Read the image at ${p}. It is a full-page screenshot of an Australian computer-parts web page, captured by an audit tool.

Answer with ONLY a JSON object on one line, no prose, no code fence:
{"pageType":"product"|"search"|"other","inStock":true|false,"addToCart":true|false,"price":<number or null>}

- pageType: "product" if it is a single product's detail page, "search" if a list/search results page, else "other".
- inStock: true if the page shows the item as available to buy now; false if it shows out of stock / sold out / backorder / notify me.
- addToCart: true if an enabled "Add to cart" (or equivalent buy) button is visible.
- price: the item's main visible price as a plain number (no $ or commas), or null if none is shown.`;

const done = new Set(existsSync(outPath)
  ? readFileSync(outPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).hash) : []);

const cases = readdirSync(capDir).filter((f) => f.endsWith(".json"))
  .map((f) => ({ hash: f.replace(".json", ""), meta: JSON.parse(readFileSync(join(capDir, f), "utf8")) }))
  .filter((c) => existsSync(join(capDir, c.hash + ".png")) && !done.has(c.hash))
  .slice(0, limit);

console.log(`[t1] ${done.size} already scored · ${cases.length} to do this chunk (${model})`);

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && String(v ?? "") !== "" ? n : null; };

for (const [i, c] of cases.entries()) {
  const png = resolve(join(capDir, c.hash + ".png"));
  const args = ["-p", PROMPT(png), "--model", model, "--tools", "Read",
    "--mcp-config", JSON.stringify({ mcpServers: {} }), "--strict-mcp-config",
    "--max-turns", "4", "--dangerously-skip-permissions",
    "--output-format", "stream-json", "--verbose"];
  const t0 = Date.now();
  const raw = await new Promise((res) => {
    const cc = spawn("claude", args, { stdio: ["ignore", "pipe", "inherit"] });
    let buf = ""; cc.stdout.on("data", (d) => { buf += d; });
    cc.on("error", (e) => { console.error(`[t1] launch failed: ${e.message}`); res(""); });
    cc.on("close", () => res(buf));
  });
  const ev = raw.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((o) => o?.type === "result");
  const text = ev?.result ?? "";
  let ans = null; try { ans = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch { /* unparseable */ }

  const truth = {
    // "unknown" (bot-wall/error page) is not a claim — only an explicit "false" means in stock.
    inStock: c.meta.fields._outOfStock === "false",
    addToCart: c.meta.fields._addToCart === "true",
    price: num(c.meta.fields._visiblePrice),
    // every recorded capture is a single-product detail page (recorder only visits PDPs)
    pageType: "product",
  };
  const u = ev?.usage ?? {};
  const row = {
    hash: c.hash, url: c.meta.url, truth, ans, raw: ans ? undefined : text.slice(0, 300),
    ok: ans ? {
      pageType: ans.pageType === truth.pageType,
      inStock: ans.inStock === truth.inStock,
      addToCart: ans.addToCart === truth.addToCart,
      price: truth.price === null ? null : num(ans.price) === truth.price,
    } : null,
    ms: Date.now() - t0,
    usage: { in: u.input_tokens ?? 0, out: u.output_tokens ?? 0, cacheR: u.cache_read_input_tokens ?? 0, cacheW: u.cache_creation_input_tokens ?? 0, turns: ev?.num_turns ?? 0 },
  };
  appendFileSync(outPath, JSON.stringify(row) + "\n");
  console.log(`[t1] ${i + 1}/${cases.length} ${c.hash.slice(0, 8)} ${ans ? Object.entries(row.ok).filter(([, v]) => v === false).map(([k]) => "✗" + k).join(" ") || "✓ all" : "UNPARSEABLE"} · ${Math.round(row.ms / 1000)}s`);
}

// scorecard over everything scored so far
const all = readFileSync(outPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const rate = (k) => { const s = all.filter((r) => r.ok && r.ok[k] !== null); return `${s.filter((r) => r.ok[k]).length}/${s.length}`; };
const burn = all.reduce((a, r) => ({ in: a.in + r.usage.in, out: a.out + r.usage.out, cacheR: a.cacheR + r.usage.cacheR, cacheW: a.cacheW + r.usage.cacheW, ms: a.ms + r.ms }), { in: 0, out: 0, cacheR: 0, cacheW: 0, ms: 0 });
console.log(`\n[t1] SCORECARD (n=${all.length}, ${all.filter((r) => !r.ans).length} unparseable)`);
for (const k of ["pageType", "inStock", "addToCart", "price"]) console.log(`  ${k.padEnd(10)} ${rate(k)}`);
console.log(`[t1] BURN: in ${burn.in} out ${burn.out} cacheR ${burn.cacheR} cacheW ${burn.cacheW} · ${Math.round(burn.ms / 60000)} min wall`);
