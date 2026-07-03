/** Full in-app run: drive the real GUI, screenshot the results in readable
 *  viewport-sized sections (not one unreadable full-page image).
 *  Search 1: DDR4 32GB 2x16GB desktop → sectioned screenshots of the board.
 *  Search 2: click "find best price" on the AI-RECOMMENDED card → sectioned shots. */
import { chromium } from "playwright";

const OUT = "C:/Users/pmdse/Documents/Find-me-harness-GUI/screenshots";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

/** Scroll through the page and capture readable viewport-sized sections. */
async function sectionShots(prefix) {
  const total = await page.evaluate("document.body.scrollHeight");
  const step = 900; // slight overlap with the 950px viewport
  let n = 0;
  for (let y = 0; y < total; y += step) {
    await page.evaluate(`window.scrollTo(0, ${y})`);
    await page.waitForTimeout(250);
    n++;
    await page.screenshot({ path: `${OUT}/${prefix}-${String(n).padStart(2, "0")}.png` });
  }
  await page.evaluate("window.scrollTo(0, 0)");
  console.log(`[run] ${n} section shot(s) → ${prefix}-*.png`);
  return n;
}

console.log("[run] opening app…");
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

await page.selectOption("#generation", "DDR4");
await page.waitForTimeout(300);
await page.selectOption("#capacityGb", "32");
await page.waitForTimeout(300);
const kitOpts = await page.$$eval("#kitConfig option", (os) => os.map(o => ({ v: o.value, t: o.textContent })));
const kit = kitOpts.find(o => /2\s*[×x]\s*16/i.test(o.t ?? ""));
if (kit) await page.selectOption("#kitConfig", kit.v);
await page.selectOption("#formFactor", "dimm");

console.log("[run] Search 1: Find me RAM (DDR4 32GB 2x16 desktop, any brand)…");
await page.click("#go");
await page.waitForSelector("#find-more", { state: "visible", timeout: 900_000 });
const status1 = await page.textContent("#status");
const cards1 = await page.$$eval("#board .result", (els) => els.length);
console.log(`[run] Search 1 done: "${status1}" — ${cards1} card(s)`);

// Wait for the AI recommendation to be anointed (async after done)
let aiPicked = true;
await page.waitForSelector("#board .result.ai-pick", { timeout: 90_000 }).catch(() => { aiPicked = false; });
const aiTitle = aiPicked ? await page.textContent("#board .result.ai-pick .title") : null;
console.log(aiPicked ? `[run] AI pick: "${aiTitle?.slice(0, 70)}"` : "[run] no AI pick appeared — will use first card");

await sectionShots("run2-scan");

// Search 2: best price on the AI-recommended card (fallback: first card)
const btnSel = aiPicked ? "#board .result.ai-pick button.link" : "#board .result button.link";
console.log("[run] Search 2: find best price on the AI-recommended card…");
await page.click(btnSel);
await page.waitForTimeout(2000);
await page.waitForSelector("#find-more", { state: "visible", timeout: 900_000 });
const status2 = await page.textContent("#status");
const cards2 = await page.$$eval("#board .result", (els) => els.length);
const unc = await page.$$eval("#unconfirmed .result", (els) => els.length).catch(() => 0);
console.log(`[run] Search 2 done: "${status2}" — ${cards2} confirmed, ${unc} unconfirmed`);
await sectionShots("run2-bestprice");

await browser.close();
console.log("[run] all screenshots written.");
