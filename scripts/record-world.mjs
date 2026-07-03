/** Plan 006 Step 2a — record worlds/ram-v1: three specs through the full live
 *  harness. Everything the tool belt touches lands in the world; manifest.json
 *  records what the exam asks. Run once; ~15-20 min of live scans. */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const WORLD = process.env.WORLD_DIR ?? "worlds/ram-v1";
const PORT = 3220;

// The three exam specs (Plan 006 Step 2) + the natural-language request the
// Student will receive for each (Spec 007 C6 — no rubric language).
const EXAMS = [
  {
    id: "ddr4-open",
    request: "find me a 32GB DDR4 kit of 2x16GB sticks for my desktop that I can actually buy right now",
    fields: { generation: "DDR4", capacityGb: 32, kitCount: 2, perStickGb: 16, constraints: { formFactor: "dimm" } },
  },
  {
    id: "ddr4-gskill",
    request: "find me G.Skill 32GB DDR4 desktop RAM, 2x16GB, in stock somewhere I can order today",
    fields: { generation: "DDR4", capacityGb: 32, kitCount: 2, perStickGb: 16, constraints: { brandInclude: ["gskill"], formFactor: "dimm" } },
  },
  {
    id: "ddr5-6000",
    request: "find me a 32GB DDR5-6000 kit (2x16GB) for a new desktop build that is genuinely available",
    fields: { generation: "DDR5", capacityGb: 32, kitCount: 2, perStickGb: 16, dataRateMtps: 6000, constraints: { formFactor: "dimm" } },
  },
];

mkdirSync(WORLD, { recursive: true });
const srv = spawn(process.execPath, ["dist/ui/start.js"], {
  env: { ...process.env, WORLD_MODE: "record", WORLD_DIR: WORLD, PORT: String(PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

try {
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    if (await fetch(`http://localhost:${PORT}/`).then((r) => r.ok).catch(() => false)) break;
  }

  const scans = [];
  for (const exam of EXAMS) {
    console.log(`\n[record] scanning: ${exam.id} …`);
    const res = await fetch(`http://localhost:${PORT}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ door: "structured", fields: exam.fields }),
    });
    const events = (await res.text()).split("\n\n").filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, "")));
    const results = events.filter((e) => e.type === "result").map((e) => e.key);
    const done = events.find((e) => e.type === "done");
    console.log(`[record] ${exam.id}: ${results.length} card(s) — ${done?.note}`);
    scans.push({ ...exam, liveCards: results, liveOrder: done?.order ?? [] });
  }

  const manifestPath = join(WORLD, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  manifest.name = "ram-v1";
  manifest.recordedAt = new Date().toISOString();
  manifest.exams = scans;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n[record] world written to ${WORLD}; manifest has ${scans.length} exam(s).`);
} finally {
  srv.kill("SIGTERM");
  await sleep(1000);
  srv.kill("SIGKILL");
}
