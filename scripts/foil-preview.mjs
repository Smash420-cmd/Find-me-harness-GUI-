/** Quick visual check of the foil winner / AI-pick card styling with mock cards. */
import { chromium } from "playwright";

const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
await p.goto("http://localhost:3000/");

await p.evaluate(() => {
  /* eslint-disable no-undef */
  window._currentDoor = "deepsearch";
  addCard({ url: "https://x1", title: "G.Skill Ripjaws V 32GB (2x16GB) DDR4 3600MHz CL18", retailer: "MSY", priceLabel: "$349.00", priceAud: 349, availability: "in_stock", honestLabel: "In stock — verified on page", flagged: false, proofUrl: "" });
  addCard({ url: "https://x2", title: "G.Skill Ripjaws V 32GB (2x16GB) DDR4 3600MHz CL18", retailer: "MegaBuy", priceLabel: "$350.24", priceAud: 350, availability: "in_stock", honestLabel: "In stock (listing read)", flagged: true, proofUrl: "" });
  window._currentDoor = "";
  addCard({ url: "https://x3", title: "Kingston Fury Beast 32GB (2x16GB) DDR4 3200MHz CL16", retailer: "UMart", priceLabel: "$149.00", priceAud: 149, availability: "in_stock", honestLabel: "In stock — verified on page", flagged: false, proofUrl: "" });
  const board = document.getElementById("board");
  board.children[0].classList.add("winner");
  const badge = document.createElement("span");
  badge.className = "winner-badge";
  badge.textContent = "Best Price";
  board.children[0].querySelector(".price").after(badge);
  board.children[2].classList.add("ai-pick");
  const panel = document.createElement("div");
  panel.className = "ai-pick-panel";
  panel.innerHTML = '<div class="ai-star-line">★ AI Recommendation</div><div class="ai-reason">Best value: name-brand CL16 kit at the price floor.</div>';
  board.children[2].querySelector(".body").appendChild(panel);
});

await p.waitForTimeout(1200);
await p.screenshot({ path: "screenshots/foil-preview.png" });
await b.close();
console.log("done → screenshots/foil-preview.png");
