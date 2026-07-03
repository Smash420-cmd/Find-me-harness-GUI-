/** Plan 006 Step 1 acceptance: record a live scan into a world, replay it,
 *  assert the boards are identical. Result cards stream in completion order
 *  (worker pool), so we compare order-independently + the final done.order. */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const WORLD = "worlds/check-v0";
const SPEC = { door: "structured", fields: { generation: "DDR4", capacityGb: 32, kitCount: 2, perStickGb: 16, constraints: { brandInclude: ["gskill"], formFactor: "dimm" } } };

async function scanVia(mode, port) {
  const srv = spawn(process.execPath, ["dist/ui/start.js"], {
    env: { ...process.env, WORLD_MODE: mode, WORLD_DIR: WORLD, PORT: String(port) },
    stdio: ["ignore", "inherit", "inherit"],
  });
  try {
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const ok = await fetch(`http://localhost:${port}/`).then((r) => r.ok).catch(() => false);
      if (ok) break;
    }
    const res = await fetch(`http://localhost:${port}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SPEC),
    });
    const text = await res.text();
    const events = text.split("\n\n").filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, "")));
    const results = events
      .filter((e) => e.type === "result")
      .map(({ key, title, retailer, priceAud, honestLabel, flagged, proofUrl }) => ({
        key, title, retailer, priceAud, honestLabel, flagged, proofBytes: proofUrl.length,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const done = events.find((e) => e.type === "done");
    return { results, order: done?.order ?? [], note: done?.note };
  } finally {
    srv.kill("SIGTERM");
    await sleep(1000);
    srv.kill("SIGKILL");
  }
}

console.log(`[check] RECORD leg (live web) → ${WORLD} …`);
const recorded = await scanVia("record", 3210);
console.log(`[check] recorded: ${recorded.results.length} card(s) — ${recorded.note}`);

console.log(`[check] REPLAY leg (no network) …`);
const replayed = await scanVia("replay", 3211);
console.log(`[check] replayed: ${replayed.results.length} card(s) — ${replayed.note}`);

const same = JSON.stringify(recorded) === JSON.stringify(replayed);
if (!same) {
  console.error("[check] ✗ MISMATCH");
  console.error("record:", JSON.stringify(recorded, null, 1));
  console.error("replay:", JSON.stringify(replayed, null, 1));
  process.exit(1);
}
console.log(`[check] ✓ PASS — replay is identical to the recorded run (${recorded.results.length} cards, same order, same proof bytes)`);
