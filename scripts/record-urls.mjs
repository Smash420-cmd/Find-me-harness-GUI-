/** Generic, domain-agnostic world recorder (Spec 007 C8 — exam #2 needs a
 *  distant world, and the RAM recorder is welded to the harness). Reads a
 *  manifest of { url, note, role } and freezes each page (fetch + screenshot)
 *  into a world dir, so ANY domain can become an exam without a chassis.
 *
 *  Usage: node scripts/record-urls.mjs worlds/books-v1
 *  Reads worlds/books-v1/urls.json  → { request, items: [{url, note, role}] }
 *  role: "truth" | "trap:<category>" — the recorder just freezes; the human
 *  certifies. A fetch/capture error is recorded verbatim (a 403 stays a 403). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recordingFetch, RecordingValidator } from "../dist/exam/world.js";
import { PlaywrightValidator } from "../dist/providers/validation/playwright.js";

const worldDir = process.argv[2];
if (!worldDir) { console.error("usage: node scripts/record-urls.mjs <worldDir>"); process.exit(1); }

const spec = JSON.parse(readFileSync(join(worldDir, "urls.json"), "utf8"));
mkdirSync(join(worldDir, "capture"), { recursive: true });

const doFetch = recordingFetch(worldDir);
const validator = new RecordingValidator(new PlaywrightValidator({ artifactDir: join(worldDir, "capture") }), worldDir);

for (const item of spec.items) {
  const outcomes = [];
  try { await doFetch(item.url); outcomes.push("fetch ok"); } catch (e) { outcomes.push(`fetch: ${String(e.message ?? e).slice(0, 50)}`); }
  try { await validator.capture({ url: item.url, mustShow: "" }); outcomes.push("shot ok"); } catch (e) { outcomes.push(`shot: ${String(e.message ?? e).slice(0, 50)}`); }
  console.log(`[rec] ${(item.role ?? "?").padEnd(20)} ${outcomes.join(" · ")}  ${item.url}`);
}

const manifest = { name: spec.name ?? worldDir, recordedAt: new Date().toISOString(), request: spec.request, items: spec.items };
writeFileSync(join(worldDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n[rec] ${spec.items.length} page(s) frozen into ${worldDir}.`);
