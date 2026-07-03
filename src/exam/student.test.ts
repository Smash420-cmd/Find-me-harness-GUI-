/** Student tool tests (Plan 006 Step 6) — offline: the tools run against a
 *  tiny fabricated world; the vision call and model adapter need the API and
 *  are exercised by the shakedown (Step 7), not here. */
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { studentTools, CONSTITUTION } from "./student.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** A two-page world: a product page and a category page. */
function makeWorld(): string {
  const dir = mkdtempSync(join(tmpdir(), "w-"));
  mkdirSync(join(dir, "fetch"), { recursive: true });
  const page = (url: string, title: string, body: string) =>
    writeFileSync(join(dir, "fetch", `${sha(url)}.json`), JSON.stringify({ url, body: `<html><title>${title}</title><body>${body}</body></html>` }));
  page("https://a.shop/widget-9000", "Widget 9000 — A Shop", "The mighty widget 9000 gadget. Add to cart. $49");
  page("https://a.shop/all-widgets", "All Widgets", "widget widget widget catalogue of every widget");
  writeFileSync(join(dir, "fetch", `${sha("https://walled.shop/x")}.json`), JSON.stringify({ url: "https://walled.shop/x", error: "GET https://walled.shop/x → 403" }));
  return dir;
}

function make() {
  const worldDir = makeWorld();
  const workspace = mkdtempSync(join(tmpdir(), "ws-"));
  return { workspace, ...studentTools({ worldDir, workspace }) };
}

describe("student tools", () => {
  it("search: the world has its own engine over recorded pages", async () => {
    const { tools } = make();
    const out = (await tools.search!({ query: "widget 9000" })) as string;
    expect(out.split("\n")[0]).toContain("https://a.shop/widget-9000");
  });

  it("fetch: truncates long bodies, saves full copies on request, replays errors verbatim", async () => {
    const { tools, workspace } = make();
    const ok = await tools.fetch!({ url: "https://a.shop/widget-9000", saveTo: "page.html" });
    expect(ok).toContain("Widget 9000");
    expect(readFileSync(join(workspace, "page.html"), "utf8")).toContain("mighty widget");
    await expect(tools.fetch!({ url: "https://walled.shop/x" })).rejects.toThrow("403");
    await expect(tools.fetch!({ url: "https://missing.shop/y" })).rejects.toThrow("404");
  });

  it("write_file + run_script: the student can build and run its own tools", async () => {
    const { tools } = make();
    await tools.write_file!({ path: "skills/count.mjs", content: "import fs from 'node:fs'; const t = fs.readFileSync('page.html','utf8'); console.log('widgets:', (t.match(/widget/gi)||[]).length);" });
    await tools.fetch!({ url: "https://a.shop/all-widgets", saveTo: "page.html" });
    const out = (await tools.run_script!({ file: "skills/count.mjs" })) as string;
    expect(out).toContain("widgets: 5");
  });

  it("workspace jail: writes and scripts cannot escape", async () => {
    const { tools } = make();
    await expect(tools.write_file!({ path: "../escape.txt", content: "x" })).rejects.toThrow("outside your workspace");
    await expect(tools.run_script!({ file: "../../etc/passwd" })).rejects.toThrow("outside your workspace");
  });

  it("run_script: network is poisoned — a script cannot escape the snapshot", async () => {
    const { tools } = make();
    await tools.write_file!({ path: "net.mjs", content: "try { await fetch('https://example.com'); console.log('ESCAPED'); } catch { console.log('no network'); }" });
    const out = (await tools.run_script!({ file: "net.mjs" })) as string;
    expect(out).not.toContain("ESCAPED");
  });

  it("read_screenshot miss is neutral; no tool string carries examiner vocabulary", async () => {
    const { tools } = make();
    const miss = (await tools.read_screenshot!({ url: "https://a.shop/widget-9000", question: "price?" })) as string;
    expect(miss).toBe("no screenshot has been taken of that url");
    const strings = [miss, CONSTITUTION].join(" ").toLowerCase();
    for (const word of ["exam", "judge", "trap", "specimen", "harness", "record", "replay", "frozen"]) {
      expect(strings).not.toContain(word);
    }
  });
});
