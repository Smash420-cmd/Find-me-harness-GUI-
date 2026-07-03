/** Eval the vision proof-reader against the labelled audit screenshots — the
 *  scar-tissue cases that fooled the regex extractors (UMart Notify-Me ghost,
 *  $0 header-cart, MemOZ MHz-less title, the massagers, bot-walls). Ground truth
 *  is what WE established by hand in screenshots/audit/AUDIT.md.
 *
 *  Needs a vision credential — the reader calls the API. Set it explicitly so
 *  it never touches a business key:
 *    READER_API_KEY=sk-... node scripts/eval-reader.mjs
 *  Prints a scorecard: per-case pass/fail on pageType + availability, and a
 *  total. This is the regression suite for every future guide edit. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeProofReader } from "../dist/providers/vision/proof-reader.js";
import { RAM_DOMAIN_HINT } from "../dist/providers/vision/sales-page-guide.js";

const AUDIT = "screenshots/audit";

// Ground truth per audit screenshot (from AUDIT.md). Each: file, and what a
// correct reading must conclude. `available`/`pageType` are the graded fields.
const CASES = [
  { file: "proof-1782941105856-u80w4b.png", want: "expected: out_of_stock (UMart Notify-Me ghost, the $149 trap)", pageType: "product", available: "out_of_stock" },
  { file: "proof-1782941131466-8edt9p.png", want: "expected: in_stock product (MemOZ 2x16 kit, title has no MHz)", pageType: "product", available: "in_stock" },
  { file: "proof-1782975000181-rpetnp.png", want: "expected: error page (Centre Com 404 cat)", pageType: "error", available: "unknown" },
  { file: "proof-1782975040931-a7ap2b.png", want: "expected: in_stock product with visible SKU (Centre Com Klevv $369)", pageType: "product", available: "in_stock" },
];

const apiKey = process.env.READER_API_KEY?.trim();
if (!apiKey) { console.error("refusing to run: set READER_API_KEY (never a business key)."); process.exit(1); }
const reader = new ClaudeProofReader({ client: new Anthropic({ apiKey }), model: process.env.READER_MODEL ?? "claude-haiku-4-5" });

let pass = 0;
for (const c of CASES) {
  const path = join(AUDIT, c.file);
  if (!existsSync(path)) { console.log(`SKIP (missing) ${c.file}`); continue; }
  const b64 = readFileSync(path).toString("base64");
  const r = await reader.read(b64, { domainHint: RAM_DOMAIN_HINT, want: c.want });
  const ptOk = r.pageType === c.pageType;
  const avOk = r.available === c.available || (c.available === "unknown");
  const ok = ptOk && avOk;
  if (ok) pass++;
  console.log(`${ok ? "✓" : "✗"} ${c.file}`);
  console.log(`    want pageType=${c.pageType} available=${c.available}`);
  console.log(`    got  pageType=${r.pageType} available=${r.available} price=${r.price} ids=[${r.identifiers.join(",")}] conf=${r.confidence}`);
  console.log(`    evidence: ${r.availabilityEvidence} | notes: ${r.notes}`);
}
console.log(`\n[eval] ${pass}/${CASES.length} passed`);
