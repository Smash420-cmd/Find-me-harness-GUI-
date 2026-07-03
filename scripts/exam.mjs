/** Plan 006 Step 7 — run the exam. Episodes loop until pass, episode cap, or
 *  Ctrl-C. The score curve is the experiment's primary readout (Spec 007 C7).
 *
 *  node scripts/exam.mjs --world ram-v1 --exam ddr4-gskill --student haiku-01 --episodes 20
 *  STUDENT_MODEL=claude-haiku-4-5 (default) | claude-sonnet-5 | ...
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadKey } from "../dist/exam/judge.js";
import { runEpisode, loadState } from "../dist/exam/episode.js";
import { studentTools, CONSTITUTION, AnthropicStudentModel } from "../dist/exam/student.js";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};

const worldDir = join("worlds", arg("world", "ram-v1"));
const examId = arg("exam", "ddr4-gskill");
const studentId = arg("student", "haiku-01");
const maxEpisodes = Number(arg("episodes", "10"));
const model = process.env.STUDENT_MODEL ?? "claude-haiku-4-5";

const key = loadKey(join(worldDir, "key.json")); // throws if uncertified (C7)
const exam = key.exams.find((e) => e.id === examId);
if (!exam) { console.error(`no exam '${examId}' — have: ${key.exams.map((e) => e.id).join(", ")}`); process.exit(1); }

const studentDir = join("students", studentId);
const workspace = join(studentDir, "workspace");
mkdirSync(workspace, { recursive: true });
const { tools, toolSpecs } = studentTools({ worldDir, workspace });

console.log(`[exam] world=${worldDir} exam=${examId} student=${studentId} model=${model}`);
console.log(`[exam] request: "${exam.request}"`);
console.log(`[exam] key certified by ${key.certifiedBy} (${key.certifiedAt}); ${exam.truths.length} truths behind the curtain\n`);

const startState = loadState(studentDir);
if (startState.passed) { console.log("[exam] this student has already passed."); process.exit(0); }

for (let i = startState.episodes; i < maxEpisodes; i++) {
  const rec = await runEpisode({
    studentDir,
    constitution: CONSTITUTION,
    examId,
    request: exam.request,
    key,
    model: new AnthropicStudentModel(model), // fresh conversation each episode (C5)
    tools,
    toolSpecs,
    budgets: { maxToolCalls: 60, maxWallMs: 10 * 60_000, maxSubmissions: 3, stagnationEpisodes: 3 },
  });
  const scores = rec.submissions.map((s) => s.score).join(", ") || "—";
  console.log(`[exam] episode ${rec.episode}: ended by ${rec.endedBy} · best ${rec.bestScore} · submissions [${scores}] · ${rec.toolCalls} tool call(s)`);
  if (rec.endedBy === "pass") {
    console.log(`\n[exam] 🎓 PASSED in ${rec.episode} episode(s). THE SCHOOL WORKS.`);
    process.exit(0);
  }
}

const s = loadState(studentDir);
console.log(`\n[exam] episode cap reached. Score curve: ${s.scoreHistory.join(" → ")}`);
