/** ToS-clean, on-Max exam runner: the OFFICIAL `claude` CLI IS the student.
 *
 *   node scripts/exam-cli.mjs --world ram-v1 --exam ddr4-gskill --student cc-01 --episodes 5
 *
 * Each episode is one `claude -p` invocation whose only tools are the world
 * MCP server (dist/exam/world-mcp.js). No SDK, no metered key, no OAuth token —
 * runs on the user's Max plan, which is the permitted way to automate Claude.
 *
 * ⚠ FIRST-RUN VERIFICATION NEEDED: the MCP server is unit-tested offline, but
 * the exact `claude` flags below (tool-restriction, stream-json shape) are read
 * from `claude --help`, not yet confirmed against a live run. The first Relay
 * session (itself Claude Code) should confirm/adjust: whether --disallowedTools
 * fully hides the built-ins, and the stream-json result field names. Scores are
 * read from the MCP server's submissions log, so they don't depend on parsing
 * stream-json — that part is robust regardless.
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
const builtins = ["Bash", "Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "WebFetch", "WebSearch", "Task", "NotebookEdit"].join(",");

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
    "--mcp-config", mcpConfig,
    "--allowedTools", allowed,
    "--disallowedTools", builtins,
    "--max-turns", "35",
    "--dangerously-skip-permissions",
    "--output-format", "stream-json", "--verbose",
  ];
  console.log(`[exam-cli] episode ${episode}: launching claude…`);
  await new Promise((resolve) => {
    const cc = spawn("claude", args, { stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
    cc.on("error", (e) => { console.error(`[exam-cli] claude failed to launch: ${e.message}`); resolve(); });
    cc.on("close", resolve);
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
  if (passed) { console.log(`\n[exam-cli] 🎓 PASSED in ${episode} episode(s) — on Max, zero metered $.`); process.exit(0); }
}
console.log(`\n[exam-cli] curve: ${state.scoreHistory.join(" → ")}`);
