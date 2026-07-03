/** Draft an answer key from a url-recorded world (exam #2 path). Unlike
 *  draft-key.mjs (which runs the RAM harness), this transcribes the human's
 *  DRAFT roles from urls.json into an uncertified key + review sheet. The
 *  magistrate reads each screenshot and signs — same C7 gate as ram-v1. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const worldDir = process.argv[2];
if (!worldDir) { console.error("usage: node scripts/draft-key-urls.mjs <worldDir>"); process.exit(1); }
const sha = (s) => createHash("sha256").update(s).digest("hex");

const manifest = JSON.parse(readFileSync(join(worldDir, "manifest.json"), "utf8"));
const examId = manifest.name.replace(/[^a-z0-9]+/gi, "-");

const truths = [];
const traps = [];
for (const item of manifest.items) {
  const role = item.role ?? "trap:category-page";
  if (role === "truth") {
    truths.push({ url: item.url, title: item.note ?? "", priceAud: 0 }); // price is display-only for books; magistrate fills if wanted
  } else {
    traps.push({ url: item.url, category: role.replace(/^trap:/, "") });
  }
}

const key = {
  certifiedBy: "",
  certifiedAt: "",
  passMark: 0.9,
  weights: { missedTruth: 1, ghostShown: 3, wrongShown: 3, irrelevantShown: 5, unknownShown: 2 },
  exams: [{ id: examId, request: manifest.request, truths, traps }],
};
writeFileSync(join(worldDir, "key.json"), JSON.stringify(key, null, 2));

let md = `# Answer-key review — ${manifest.name} (exam #2, generality test)\n\nRequest: "${manifest.request}"\n\nDistant domain: booksellers, identity = ISBN not MPN. Roles below are DRAFT —\nopen each screenshot, confirm, tick, then sign \`certifiedBy\`/\`certifiedAt\` in\n\`${worldDir}/key.json\`. The Judge refuses an unsigned key (C7).\n\n## Truth candidates (${truths.length}) — must be the asked-for edition, new, buyable now\n\n| ok | url | note | proof |\n|---|---|---|---|\n`;
for (const t of truths) {
  const png = `capture/${sha(t.url)}.png`;
  md += `| [ ] | ${t.url} | ${t.title} | ${existsSync(join(worldDir, png)) ? png : "(no shot)"} |\n`;
}
md += `\n## Trap candidates (${traps.length}) — must deserve exclusion for THIS request\n\n| ok | category | url | proof |\n|---|---|---|---|\n`;
for (const t of traps) {
  const png = `capture/${sha(t.url)}.png`;
  md += `| [ ] | ${t.category} | ${t.url} | ${existsSync(join(worldDir, png)) ? png : "(no shot)"} |\n`;
}
md += `\n## Open rulings for the magistrate\n\n- USED hardcovers (HPB, ThriftBooks) are marked oem-opaque traps because the\n  request says "buy NEW". If you accept used copies, promote them to truths.\n- The publisher/author pages (jamesclear.com) are category-page traps — no\n  single buyable product. Confirm.\n- B&N (1129201155) role is "truth" but verify on the shot that it is the\n  HARDCOVER in stock, not the paperback landing page.\n- mcnallyrobinson has the right ISBN but is out of stock → ghost. Confirm the\n  shot shows unavailability.\n`;
writeFileSync(join(worldDir, "REVIEW-KEY.md"), md);
console.log(`[key] draft: ${worldDir}/key.json (UNCERTIFIED) + REVIEW-KEY.md — ${truths.length} truths, ${traps.length} traps`);
