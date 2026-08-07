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

const inner = new PlaywrightValidator({ artifactDir: join(worldDir, "capture") });
// Plain HTTP is what Cloudflare blocks, and the fetch BODY is what feeds the
// world's search index — a 403 makes the page undiscoverable even though its
// screenshot exists. Fall back to the rendered DOM so a page a browser can load
// is a page the student can find. A wall still records as the error.
const doFetch = recordingFetch(worldDir, undefined, async (url) => {
  const [html] = await inner.browse(url, "[document.documentElement.outerHTML]");
  return html ?? "";
});
const validator = new RecordingValidator(inner, worldDir);

const unreachable = [];
for (const item of spec.items) {
  const outcomes = [];
  try {
    await doFetch(item.url);
    outcomes.push("fetch ok");
  } catch (e) {
    outcomes.push(`fetch: ${String(e.message ?? e).slice(0, 50)}`);
    unreachable.push(item);
  }
  try { await validator.capture({ url: item.url, mustShow: "" }); outcomes.push("shot ok"); } catch (e) { outcomes.push(`shot: ${String(e.message ?? e).slice(0, 50)}`); }
  console.log(`[rec] ${(item.role ?? "?").padEnd(20)} ${outcomes.join(" · ")}  ${item.url}`);
}

// A bodyless TRUTH is the books-v1 failure: signed as findable, invisible to
// search, and it silently caps every score. Say so loudly here rather than
// discovering it three tests later.
const blindTruths = unreachable.filter((i) => (i.role ?? "") === "truth");
if (blindTruths.length) {
  console.error(`\n[rec] WARNING — ${blindTruths.length} truth(s) have NO body and will NOT appear in search:`);
  for (const i of blindTruths) console.error(`[rec]   ${i.url}`);
  console.error(`[rec] No student can discover these. Replace them with reachable sellers or demote them to bot-wall traps BEFORE signing the key.`);
}

const manifest = { name: spec.name ?? worldDir, recordedAt: new Date().toISOString(), request: spec.request, items: spec.items };
writeFileSync(join(worldDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n[rec] ${spec.items.length} page(s) frozen into ${worldDir}.`);
