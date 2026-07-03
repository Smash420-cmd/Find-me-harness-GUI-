/** Plan 006 Step 3 (prep) — draft the answer key from REPLAY scans of the
 *  frozen world, and emit the magistrate's review sheet (REVIEW-KEY.md).
 *  The draft is born UNCERTIFIED: certifiedBy is empty, so the Judge refuses
 *  it until a human signs (Spec 006 C7). */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const WORLD = process.env.WORLD_DIR ?? "worlds/ram-v1";
const PORT = 3230;
const sha = (s) => createHash("sha256").update(s).digest("hex");

const manifest = JSON.parse(readFileSync(join(WORLD, "manifest.json"), "utf8"));

const srv = spawn(process.execPath, ["dist/ui/start.js"], {
  env: { ...process.env, WORLD_MODE: "replay", WORLD_DIR: WORLD, PORT: String(PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

try {
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    if (await fetch(`http://localhost:${PORT}/`).then((r) => r.ok).catch(() => false)) break;
  }

  const exams = [];
  for (const exam of manifest.exams) {
    const res = await fetch(`http://localhost:${PORT}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ door: "structured", fields: exam.fields }),
    });
    const events = (await res.text()).split("\n\n").filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, "")));
    const truths = events
      .filter((e) => e.type === "result")
      .map((e) => ({ url: e.key, title: e.title, priceAud: e.priceAud, retailer: e.retailer, honestLabel: e.honestLabel }))
      .sort((a, b) => a.url.localeCompare(b.url));
    // Specimens become this exam's traps — unless the harness itself verified
    // the URL as a truth here (e.g. the 3600 variant-twin IS a valid answer to
    // the open DDR4 exam). Those collisions are exactly what the magistrate
    // rules on.
    const truthUrls = new Set(truths.map((t) => t.url));
    const traps = manifest.specimens
      .filter((s) => !truthUrls.has(s.url))
      .map((s) => ({ url: s.url, category: s.cat }));
    console.log(`[key] ${exam.id}: ${truths.length} truth(s), ${traps.length} trap(s)`);
    exams.push({ id: exam.id, request: exam.request, truths, traps });
  }

  const key = {
    certifiedBy: "", // ← the magistrate signs here; empty = refuses to grade
    certifiedAt: "",
    passMark: 0.9,
    weights: { missedTruth: 1, ghostShown: 3, wrongShown: 3, irrelevantShown: 5, unknownShown: 2 },
    exams,
  };
  writeFileSync(join(WORLD, "key.json"), JSON.stringify(key, null, 2));

  // The magistrate's review sheet — every claim next to its proof shot.
  let md = `# Answer-key review — ${manifest.name}\n\nFor each row: open the proof shot, confirm the verdict, tick the box.\nWhen every box is ticked, sign by setting \`certifiedBy\`/\`certifiedAt\` in\n\`${WORLD}/key.json\`. The Judge refuses an unsigned key.\n`;
  for (const exam of exams) {
    md += `\n## ${exam.id} — "${exam.request}"\n\n### Truths (${exam.truths.length}) — every one must be real, buyable, and the asked-for thing\n\n| ok | price | retailer | title | proof |\n|---|---|---|---|---|\n`;
    for (const t of exam.truths) {
      const png = `capture/${sha(t.url)}.png`;
      const proof = existsSync(join(WORLD, png)) ? png : "(no shot recorded)";
      md += `| [ ] | $${t.priceAud} | ${t.retailer} | ${t.title.slice(0, 70)} | ${proof} |\n`;
    }
    md += `\n### Traps (${exam.traps.length}) — every one must deserve exclusion FOR THIS REQUEST\n\n| ok | category | url | proof |\n|---|---|---|---|\n`;
    for (const t of exam.traps) {
      const png = `capture/${sha(t.url)}.png`;
      const proof = existsSync(join(WORLD, png)) ? png : "(no shot)";
      md += `| [ ] | ${t.category} | ${t.url} | ${proof} |\n`;
    }
  }
  md += `\n## Open rulings for the magistrate\n\n- If a pinned specimen shows up as a TRUTH above (e.g. the 3600 variant-twin\n  in the open DDR4 exam), that is correct behaviour — it only stays a trap in\n  exams it contradicts.\n- The memoz parse-trap page is a REAL buyable kit: if it appears in no truth\n  list, decide whether to promote it (add to truths) or leave it as an\n  unverifiable trap for v1.\n- No irrelevant-item specimen (massager class) is pinned yet — optional add\n  before certification.\n`;
  writeFileSync(join(WORLD, "REVIEW-KEY.md"), md);
  console.log(`[key] draft written: ${WORLD}/key.json (UNCERTIFIED) + ${WORLD}/REVIEW-KEY.md`);
} finally {
  srv.kill("SIGTERM");
  await sleep(1000);
  srv.kill("SIGKILL");
}
