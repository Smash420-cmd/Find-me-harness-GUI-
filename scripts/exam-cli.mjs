/** ToS-clean, on-Max exam runner: the OFFICIAL `claude` CLI IS the student.
 *
 *   node scripts/exam-cli.mjs --world ram-v1 --exam ddr4-gskill --student cc-01 --episodes 5
 *
 * Each episode is one `claude -p` invocation whose only tools are the world
 * MCP server (dist/exam/world-mcp.js). No SDK, no metered key, no OAuth token —
 * runs on the user's Max plan, which is the permitted way to automate Claude.
 *
 * Flags verified live 2026-07-08: `--tools ""` hides ALL built-ins and
 * `--strict-mcp-config` blocks the user's other MCP servers (Gmail etc.) —
 * a smoke run listed exactly the 7 mcp__world__* tools. Scores are read from
 * the MCP server's submissions log; usage/burn from the stream-json result event.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadKey } from "../dist/exam/judge.js";
import { CONSTITUTION } from "../dist/exam/student.js";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const worldDir = join("worlds", arg("world", "ram-v1"));
const examId = arg("exam", "ddr4-gskill");
const studentId = arg("student", "cc-01");
const maxEpisodes = Number(arg("episodes", "5"));
const model = arg("model", "sonnet"); // student model; the burn scales with this

const key = loadKey(join(worldDir, "key.json")); // throws if uncertified (C7)
const exam = key.exams.find((e) => e.id === examId);
if (!exam) { console.error(`no exam '${examId}'`); process.exit(1); }

const studentDir = join("students", studentId);
const workspace = join(studentDir, "workspace");
mkdirSync(workspace, { recursive: true });
const statePath = join(studentDir, "state.json");
const subsLog = join(studentDir, "submissions.jsonl");
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { episodes: 0, scoreHistory: [], bestEver: 0 };
if (existsSync(subsLog)) rmSync(subsLog); // fresh per process; scores persist in state

// MCP config: the world server as the student's ONLY tool source.
const mcpConfig = join(studentDir, "mcp.json");
const T = ["search", "fetch", "screenshot", "read_screenshot", "write_file", "run_script", "submit_answer"];
const allowed = T.map((t) => `mcp__world__${t}`).join(",");
const burn = { turns: 0, in: 0, out: 0, cacheRead: 0, cacheWrite: 0, ms: 0 }; // totals across episodes

console.log(`[exam-cli] world=${worldDir} exam=${examId} student=${studentId} — the claude CLI is the student, on Max`);

for (let i = state.episodes; i < maxEpisodes; i++) {
  const episode = i + 1;
  writeFileSync(mcpConfig, JSON.stringify({
    mcpServers: { world: { command: "node", args: ["dist/exam/world-mcp.js"],
      env: { WORLD_DIR: worldDir, STUDENT_WORKSPACE: workspace, KEY_PATH: join(worldDir, "key.json"), EXAM_ID: examId, MAX_SUBMISSIONS: "3", SUBMISSIONS_LOG: subsLog, EPISODE: String(episode) } } },
  }, null, 1));

  const history = state.scoreHistory.length ? `Your best score per past episode: ${state.scoreHistory.join(", ")}.` : "This is your first episode.";
  const stagnant = state.episodes >= 3 && state.episodes - (state.lastImprovedEpisode ?? 0) >= 3
    ? "\nYour score has not improved across several episodes. Change your approach structurally." : "";
  const system = `${CONSTITUTION}\n\nEpisode ${episode}. ${history}${stagnant}`;

  const args = [
    "-p", exam.request,
    "--system-prompt", system,
    "--model", model,
    "--mcp-config", mcpConfig, "--strict-mcp-config",
    "--tools", "", // no built-ins: the world server is the whole universe
    "--allowedTools", allowed,
    "--max-turns", "35",
    "--dangerously-skip-permissions",
    "--output-format", "stream-json", "--verbose",
  ];
  console.log(`[exam-cli] episode ${episode}: launching claude (${model})…`);
  const streamLog = join(studentDir, `episode-${episode}.stream.jsonl`);
  await new Promise((resolve) => {
    // no shell: true — it word-splits the prompt/system args on Windows (found live 2026-07-08)
    const cc = spawn("claude", args, { stdio: ["ignore", "pipe", "inherit"] });
    let buf = "";
    cc.stdout.on("data", (d) => { buf += d; });
    cc.on("error", (e) => { console.error(`[exam-cli] claude failed to launch: ${e.message}`); resolve(); });
    cc.on("close", () => {
      writeFileSync(streamLog, buf);
      const res = buf.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .find((o) => o?.type === "result");
      if (res) {
        const u = res.usage ?? {};
        burn.turns += res.num_turns ?? 0; burn.ms += res.duration_ms ?? 0;
        burn.in += u.input_tokens ?? 0; burn.out += u.output_tokens ?? 0;
        burn.cacheRead += u.cache_read_input_tokens ?? 0; burn.cacheWrite += u.cache_creation_input_tokens ?? 0;
        console.log(`[exam-cli] episode ${episode}: ${res.num_turns} turns · in ${u.input_tokens} out ${u.output_tokens} cacheR ${u.cache_read_input_tokens} cacheW ${u.cache_creation_input_tokens} · ${Math.round((res.duration_ms ?? 0) / 1000)}s`);
      } else console.log(`[exam-cli] episode ${episode}: no result event in stream (see ${streamLog})`);
      resolve();
    });
  });

  // Read scores back from the MCP server's submissions log (robust — no stream-json parse).
  const subs = existsSync(subsLog)
    ? readFileSync(subsLog, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((s) => s.episode === episode)
    : [];
  const best = subs.reduce((m, s) => Math.max(m, s.score), 0);
  const passed = subs.some((s) => s.pass);
  const improved = best > state.bestEver;
  state.episodes = episode;
  state.scoreHistory.push(best);
  state.bestEver = Math.max(state.bestEver, best);
  if (improved) state.lastImprovedEpisode = episode;
  writeFileSync(statePath, JSON.stringify(state, null, 1));
  console.log(`[exam-cli] episode ${episode}: best ${best} · ${subs.length} submission(s)${passed ? " · PASSED" : ""}`);
  if (passed) { console.log(`\n[exam-cli] 🎓 PASSED in ${episode} episode(s) — on Max, zero metered $.`); break; }
}
console.log(`\n[exam-cli] curve: ${state.scoreHistory.join(" → ")}`);
console.log(`[exam-cli] BURN: ${burn.turns} turns · in ${burn.in} out ${burn.out} cacheR ${burn.cacheRead} cacheW ${burn.cacheWrite} · ${Math.round(burn.ms / 60000)} min model time`);
