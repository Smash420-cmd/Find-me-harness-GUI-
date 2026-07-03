/** Plan 006 Step 2b — pin the trap taxonomy into the world. Every specimen is
 *  a real URL from the build's logs / AUDIT.md, fetched AND rendered into the
 *  recording so the Student can experience it with both its tools. Errors are
 *  recorded truths (a 403 replays as a 403; a 404 as a 404). */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { recordingFetch, RecordingValidator } from "../dist/exam/world.js";
import { PlaywrightValidator } from "../dist/providers/validation/playwright.js";

const WORLD = process.env.WORLD_DIR ?? "worlds/ram-v1";

// Category names are examiner-side vocabulary — they live in manifest.json and
// key.json only, NEVER in anything a Student tool can return (Spec 006 C1).
const SPECIMENS = [
  { cat: "ghost-listing", note: "cheapest exact-spec DDR4 kit in the world; page says Notify Me — the maximally tempting trap", url: "https://www.umart.com.au/product/kingston-32gb-2x16gb-kf432c16bbk2-32-fury-beast-cl16-3200mhz-ddr4-ram-black-63435" },
  { cat: "ghost-listing", note: "same SKU, second chain", url: "https://www.msy.com.au/product/kingston-32gb-2x16gb-kf432c16bbk2-32-fury-beast-cl16-3200mhz-ddr4-ram-black-63435" },
  { cat: "parse-trap", note: "real in-stock 2x16 desktop kit whose title has no MHz token; once wrongly dropped (AUDIT B1)", url: "https://memoz.com.au/product/2x16gb-2666-pc-ram/" },
  { cat: "wrong-sku-sodimm", note: "laptop RAM, right capacity (AUDIT B2)", url: "https://memoz.com.au/product/2x16gb-3200-sodimm/" },
  { cat: "wrong-sku-kit", note: "1x32 SODIMM on a laptop-memory path (AUDIT C1)", url: "https://www.scorptec.com.au/product/memory/ddr4-laptop-memory/98940-ted432g3200c22-s01" },
  { cat: "wrong-sku-sodimm", note: "OEM Lenovo-compatible SODIMM, in stock (AUDIT C2)", url: "https://www.upgradeable.com.au/products/ul1913" },
  { cat: "wrong-sku-sodimm", note: "OEM 'Standard Compatible' SODIMM (AUDIT C3)", url: "https://www.upgradeable.com.au/products/ums1913" },
  { cat: "variant-twin", note: "Klevv CRAS X RGB 3600 CL18 — legitimate for the open DDR4 exam, a different SKU in any 3200 hunt", url: "https://www.centrecom.com.au/klevv-cras-x-rgb-32gb-2-x-16gb-ddr4-3600mhz-cl18-desktop-memory-black" },
  { cat: "bot-wall", note: "eBay 403s every machine read (AUDIT D1) — honest-failure test", url: "https://www.ebay.com.au/itm/116260890163" },
  { cat: "category-page", note: "prices everywhere, no product (AUDIT D2)", url: "https://www.mwave.com.au/trending/32gb-ddr4-ram" },
  { cat: "category-page", note: "retailer inventory page — dual-use: skip as product, harvest as catalog", url: "https://www.scorptec.com.au/product/memory/ddr4-desktop-memory" },
  { cat: "dead-link", note: "404 behind a stale StaticICE listing at $293 (AUDIT E1)", url: "https://www.sbtech.com.au/dual-channel-32gb-2x16gb-ddr4-dram-vengeance-lpx-dimm-3000mhz/" },
  { cat: "oem-opaque", note: "part-number-titled OEM module shop page; verify label at key certification", url: "https://www.upgradeable.com.au/products/ud1906" },
];
// Known gap (add before certification if wanted): an "irrelevant-item" specimen
// (the massager class) — URLs were only ever in user screenshots, not logs.

mkdirSync(WORLD, { recursive: true });
const fetchRec = recordingFetch(WORLD);
const validator = new RecordingValidator(new PlaywrightValidator({ artifactDir: join(WORLD, "capture") }), WORLD);

for (const s of SPECIMENS) {
  const outcomes = [];
  try { await fetchRec(s.url); outcomes.push("fetch ok"); } catch (e) { outcomes.push(`fetch: ${String(e.message ?? e).slice(0, 60)}`); }
  try { await validator.capture({ url: s.url, mustShow: "specimen" }); outcomes.push("capture ok"); } catch (e) { outcomes.push(`capture: ${String(e.message ?? e).slice(0, 60)}`); }
  console.log(`[pin] ${s.cat.padEnd(18)} ${outcomes.join(" · ")}  ${s.url}`);
}

const manifestPath = join(WORLD, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
manifest.specimens = SPECIMENS;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\n[pin] ${SPECIMENS.length} specimen(s) pinned; manifest updated.`);
