/**
 * The episode runner (Spec 007, Plan Step 5) — the Student's life support.
 *
 * Everything here is ENFORCED, never requested of the model (C3/C4):
 *  - hard budgets: tool calls + wall clock; a rabbit hole eats one episode (E3)
 *  - ≤ maxSubmissions per episode, counted by the runner
 *  - external termination: only a pass verdict ends the task (Law 5) — the
 *    model going quiet just ends the EPISODE, in honest failure
 *  - persistence: the workspace and score history survive; conversation does not
 *  - stagnation guard: no new best score across N episodes → the runner
 *    prepends the constitution's rule-6 reminder (E4)
 *
 * The runner is model-agnostic: Step 6 plugs in the real Anthropic-backed
 * student; tests plug in scripted fakes. Tool strings that reach the model
 * must never carry examiner vocabulary (C1) — the submission verdict text
 * below is the ONLY grading language a Student ever reads.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { judge, type AnswerKey, type Verdict } from "./judge.js";

// ── seams ─────────────────────────────────────────────────────────────────

export interface Msg {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly toolName?: string;
}

export interface ToolSpec {
  readonly name: string;
  readonly description: string; // neutral verbs only — never method hints
  /** JSON schema for the tool input — used by real model adapters; the runner ignores it. */
  readonly schema?: Record<string, unknown>;
}

export interface ModelTurn {
  readonly text?: string;
  readonly toolCall?: { name: string; input: unknown };
}

/** What Step 6 implements with the Anthropic SDK; tests implement with scripts. */
export interface StudentModel {
  next: (transcript: Msg[], tools: ToolSpec[]) => Promise<ModelTurn>;
}

/** Workspace-backed tools supplied by Step 6 (search/fetch/screenshot/…).
 * `submit_answer` is NOT in this map — the runner owns it. */
export type ToolImpl = (input: unknown) => Promise<string>;

export interface EpisodeBudgets {
  readonly maxToolCalls: number;
  readonly maxWallMs: number;
  readonly maxSubmissions: number;
  readonly stagnationEpisodes: number; // N flat episodes → rule-6 reminder
}

export interface RunnerOptions {
  readonly studentDir: string; // persists across episodes
  readonly constitution: string; // the ENTIRE system prompt (Spec 007)
  readonly examId: string;
  readonly request: string; // natural user phrasing — the task lives here
  readonly key: AnswerKey;
  readonly model: StudentModel;
  readonly tools: Record<string, ToolImpl>;
  readonly toolSpecs: ToolSpec[];
  readonly budgets: EpisodeBudgets;
  readonly now?: () => number; // injectable clock (tests)
}

// ── persistent student state ──────────────────────────────────────────────

interface StudentState {
  episodes: number;
  scoreHistory: number[]; // best score per episode
  bestEver: number;
  lastImprovedEpisode: number; // 0 = never
  passed: boolean;
}

const freshState = (): StudentState => ({ episodes: 0, scoreHistory: [], bestEver: 0, lastImprovedEpisode: 0, passed: false });

export function loadState(studentDir: string): StudentState {
  const p = join(studentDir, "state.json");
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as StudentState) : freshState();
}

// ── the episode ───────────────────────────────────────────────────────────

export type EndedBy = "pass" | "submissions-exhausted" | "tool-budget" | "wall-clock" | "model-stopped";

export interface EpisodeRecord {
  readonly episode: number;
  readonly endedBy: EndedBy;
  readonly bestScore: number;
  readonly submissions: Verdict[];
  readonly toolCalls: number;
  readonly transcript: Msg[];
}

/** The grading language a Student ever sees — plain outcomes only (C1/C4). */
function verdictText(v: Verdict, submissionsLeft: number): string {
  if (v.pass) return "You have passed. The task is complete.";
  const hints = v.categories.length > 0 ? ` Feedback: ${v.categories.join("; ")}.` : "";
  return `Not passed. Score: ${v.score}.${hints} Submissions left this episode: ${submissionsLeft}.`;
}

export async function runEpisode(opts: RunnerOptions): Promise<EpisodeRecord> {
  const now = opts.now ?? Date.now;
  const state = loadState(opts.studentDir);
  if (state.passed) throw new Error("this student has already passed — start a new exam, not a new episode");

  const episode = state.episodes + 1;
  mkdirSync(join(opts.studentDir, "episodes"), { recursive: true });

  // Fresh conversation; persistent facts injected by the runner (C5).
  const stagnant =
    state.episodes >= opts.budgets.stagnationEpisodes &&
    state.episodes - state.lastImprovedEpisode >= opts.budgets.stagnationEpisodes;
  const history = state.scoreHistory.length > 0 ? `Your best score per past episode: ${state.scoreHistory.join(", ")}.` : "This is your first episode.";
  const reminder = stagnant
    ? "\nYour score has not improved across several episodes. Your approach is wrong — change it structurally, do not refine it."
    : "";
  const transcript: Msg[] = [
    { role: "system", content: opts.constitution },
    { role: "system", content: `Episode ${episode}. ${history}${reminder}` },
    { role: "user", content: opts.request },
  ];

  const allTools: ToolSpec[] = [
    ...opts.toolSpecs,
    { name: "submit_answer", description: "Submit your answer: a list of URLs. Returns a score and whether you have passed." },
  ];

  const start = now();
  const submissions: Verdict[] = [];
  let toolCalls = 0;
  let bestScore = 0;
  let endedBy: EndedBy = "model-stopped";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (now() - start >= opts.budgets.maxWallMs) { endedBy = "wall-clock"; break; }
    if (toolCalls >= opts.budgets.maxToolCalls) { endedBy = "tool-budget"; break; }

    const turn = await opts.model.next(transcript, allTools);
    if (turn.text) transcript.push({ role: "assistant", content: turn.text });
    if (!turn.toolCall) { endedBy = "model-stopped"; break; } // going quiet ends the EPISODE, never the task

    toolCalls++;
    const { name, input } = turn.toolCall;
    transcript.push({ role: "assistant", content: JSON.stringify({ tool: name, input }) });

    if (name === "submit_answer") {
      const shown = Array.isArray((input as { urls?: unknown })?.urls)
        ? ((input as { urls: unknown[] }).urls.map(String))
        : [];
      const verdict = judge({ examId: opts.examId, shown }, opts.key);
      submissions.push(verdict);
      bestScore = Math.max(bestScore, verdict.score);
      const left = opts.budgets.maxSubmissions - submissions.length;
      transcript.push({ role: "tool", toolName: name, content: verdictText(verdict, left) });
      if (verdict.pass) { endedBy = "pass"; break; }
      if (submissions.length >= opts.budgets.maxSubmissions) { endedBy = "submissions-exhausted"; break; }
      continue;
    }

    const impl = opts.tools[name];
    const result = impl
      ? await impl(input).catch((e: unknown) => String(e instanceof Error ? e.message : e))
      : `unknown tool: ${name}`;
    transcript.push({ role: "tool", toolName: name, content: result });
  }

  // Persist: transcript + state. Skills in the workspace are the model's own files.
  const record: EpisodeRecord = { episode, endedBy, bestScore, submissions, toolCalls, transcript };
  writeFileSync(join(opts.studentDir, "episodes", `${episode}.json`), JSON.stringify(record, null, 1));
  const improved = bestScore > state.bestEver;
  const next: StudentState = {
    episodes: episode,
    scoreHistory: [...state.scoreHistory, bestScore],
    bestEver: Math.max(state.bestEver, bestScore),
    lastImprovedEpisode: improved ? episode : state.lastImprovedEpisode,
    passed: endedBy === "pass",
  };
  writeFileSync(join(opts.studentDir, "state.json"), JSON.stringify(next, null, 1));
  return record;
}
