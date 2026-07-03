/** Episode runner tests (Plan 006 Step 5) — scripted fake students exercise
 *  every exit and every enforced rule. No model, no world, no network. */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEpisode, loadState, type ModelTurn, type RunnerOptions, type StudentModel } from "./episode.js";
import type { AnswerKey } from "./judge.js";

const KEY: AnswerKey = {
  certifiedBy: "test-magistrate",
  certifiedAt: "2026-07-04",
  passMark: 0.9,
  weights: { missedTruth: 1, ghostShown: 3, wrongShown: 3, irrelevantShown: 5, unknownShown: 2 },
  exams: [
    {
      id: "t1",
      request: "find me a widget I can buy",
      truths: [
        { url: "https://a.shop/w1", title: "W1", priceAud: 10 },
        { url: "https://a.shop/w2", title: "W2", priceAud: 12 },
      ],
      traps: [{ url: "https://a.shop/ghost", category: "ghost-listing" }],
    },
  ],
};

/** A student that plays back a fixed list of turns. */
const scripted = (turns: ModelTurn[]): StudentModel => {
  let i = 0;
  return { next: async () => turns[Math.min(i++, turns.length - 1)]! };
};

function options(model: StudentModel, over: Partial<RunnerOptions> = {}): RunnerOptions {
  return {
    studentDir: mkdtempSync(join(tmpdir(), "student-")),
    constitution: "Serve the user's request. You cannot decide you have succeeded.",
    examId: "t1",
    request: "find me a widget I can buy",
    key: KEY,
    model,
    tools: { look: async () => "you see a shop" },
    toolSpecs: [{ name: "look", description: "Look at a page." }],
    budgets: { maxToolCalls: 10, maxWallMs: 60_000, maxSubmissions: 3, stagnationEpisodes: 3 },
    ...over,
  };
}

const submit = (...urls: string[]): ModelTurn => ({ toolCall: { name: "submit_answer", input: { urls } } });

describe("episode runner", () => {
  it("only a pass verdict ends the task; the verdict text is plain (Law 5 / C4)", async () => {
    const opts = options(scripted([submit("https://a.shop/w1", "https://a.shop/w2")]));
    const rec = await runEpisode(opts);
    expect(rec.endedBy).toBe("pass");
    expect(rec.transcript.at(-1)!.content).toBe("You have passed. The task is complete.");
    expect(loadState(opts.studentDir).passed).toBe(true);
    await expect(runEpisode(opts)).rejects.toThrow(/already passed/);
  });

  it("submissions are counted by the runner and capped at 3", async () => {
    const bad = submit("https://a.shop/ghost");
    const rec = await runEpisode(options(scripted([bad, bad, bad, bad, bad])));
    expect(rec.endedBy).toBe("submissions-exhausted");
    expect(rec.submissions.length).toBe(3);
  });

  it("tool budget is a hard cap — a rabbit hole eats one episode (E3)", async () => {
    const dig: ModelTurn = { toolCall: { name: "look", input: {} } };
    const rec = await runEpisode(options(scripted([dig])));
    expect(rec.endedBy).toBe("tool-budget");
    expect(rec.toolCalls).toBe(10);
  });

  it("wall clock is a hard cap", async () => {
    let t = 0;
    const rec = await runEpisode(
      options(scripted([{ toolCall: { name: "look", input: {} } }]), {
        budgets: { maxToolCalls: 100, maxWallMs: 5, maxSubmissions: 3, stagnationEpisodes: 3 },
        now: () => (t += 3),
      }),
    );
    expect(rec.endedBy).toBe("wall-clock");
  });

  it("a model going quiet ends the EPISODE in honest failure, never the task", async () => {
    const rec = await runEpisode(options(scripted([{ text: "I am confident I have finished." }])));
    expect(rec.endedBy).toBe("model-stopped");
    expect(rec.bestScore).toBe(0);
  });

  it("state persists across episodes; conversation does not (C5)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "student-"));
    const bad = submit("https://a.shop/ghost");
    await runEpisode(options(scripted([bad]), { studentDir: dir, budgets: { maxToolCalls: 5, maxWallMs: 60_000, maxSubmissions: 1, stagnationEpisodes: 3 } }));
    const opts2 = options(scripted([bad]), { studentDir: dir, budgets: { maxToolCalls: 5, maxWallMs: 60_000, maxSubmissions: 1, stagnationEpisodes: 3 } });
    const rec2 = await runEpisode(opts2);
    expect(rec2.episode).toBe(2);
    expect(rec2.transcript[1]!.content).toContain("Your best score per past episode:");
    expect(existsSync(join(dir, "episodes", "1.json"))).toBe(true);
    expect(existsSync(join(dir, "episodes", "2.json"))).toBe(true);
    expect(loadState(dir).scoreHistory.length).toBe(2);
  });

  it("stagnation: three flat episodes → the rule-6 reminder is prepended (E4)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "student-"));
    const bad = submit("https://a.shop/ghost");
    const budgets = { maxToolCalls: 5, maxWallMs: 60_000, maxSubmissions: 1, stagnationEpisodes: 3 };
    for (let i = 0; i < 3; i++) await runEpisode(options(scripted([bad]), { studentDir: dir, budgets }));
    const rec4 = await runEpisode(options(scripted([bad]), { studentDir: dir, budgets }));
    expect(rec4.transcript[1]!.content).toContain("change it structurally");
  });

  it("no examiner vocabulary ever reaches the student", async () => {
    const rec = await runEpisode(options(scripted([submit("https://a.shop/ghost"), submit("https://a.shop/w1")])));
    const studentVisible = rec.transcript.filter((m) => m.role === "tool" || m.role === "system").map((m) => m.content).join(" ").toLowerCase();
    for (const word of ["ghost", "trap", "key", "judge", "harness", "specimen", "examiner", "world"]) {
      expect(studentVisible).not.toContain(word);
    }
  });
});
