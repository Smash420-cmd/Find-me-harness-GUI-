import { describe, it, expect } from "vitest";
import { RunRegistry } from "./index.js";
import { SupersededRunError } from "../errors/index.js";

describe("Task 1 — run identity + supersede (E2)", () => {
  it("a live run emits its value through the gate", () => {
    const reg = new RunRegistry();
    const run = reg.begin("lane-A");
    expect(reg.isLive(run)).toBe(true);
    expect(reg.guardEmit(run, { ok: 1 })).toEqual({ ok: 1 });
  });

  it("a superseded run's results never emit (E2)", () => {
    const reg = new RunRegistry();
    const first = reg.begin("lane-A");
    const second = reg.begin("lane-A"); // supersedes `first`

    expect(reg.isLive(first)).toBe(false);
    expect(reg.isLive(second)).toBe(true);

    // The late result from the superseded run is refused at the gate.
    expect(() => reg.guardEmit(first, "late")).toThrow(SupersededRunError);
    // The current run still emits fine.
    expect(reg.guardEmit(second, "current")).toBe("current");
  });

  it("runs on different lanes do not supersede each other", () => {
    const reg = new RunRegistry();
    const a = reg.begin("lane-A");
    const b = reg.begin("lane-B");
    expect(reg.isLive(a)).toBe(true);
    expect(reg.isLive(b)).toBe(true);
  });

  it("cancel stops a run from emitting", () => {
    const reg = new RunRegistry();
    const run = reg.begin("lane-A");
    reg.cancel(run);
    expect(reg.isLive(run)).toBe(false);
    expect(() => reg.guardEmit(run, "x")).toThrow(SupersededRunError);
  });
});
