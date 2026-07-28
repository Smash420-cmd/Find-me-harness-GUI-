# T1 — Vision eval on the audit screenshots (CLI on Max)

**Run:** 2026-07-29 · `node scripts/eval-vision-cli.mjs --world ram-v1` ·
model **sonnet** · 83 screenshots, one `claude -p` each, native vision via
the built-in `Read` tool, no MCP server.

## BURN (measure-the-burn, iron rule 2)

| | |
|---|---|
| Calls | **83** (one `claude -p` per audit screenshot) |
| Wall-clock | **12 min** (~8.7 s/call, 2 outliers at 25–27 s) |
| Output tokens | **18,924** |
| Input tokens | 332 (uncached) |
| Cache write / read | 308,361 / 1,857,310 |
| Turns | 2 per call (Read → answer) |
| API-equivalent cost | **≈ $2.00** at Sonnet list rates |
| Metered spend | **$0.00** — ran on Max via the official `claude` binary |
| Weekly Max quota | **negligible**: 12 min of exam time out of a 5-hour window (~4% of one window's wall-clock); block showed 4h42m still free afterwards |

Cheaper and faster than T2 (75K output / 17 min for 5 episodes). The Opus
orchestrator driving the run out-burns the test itself, again.

## Headline

**Vision reads the audit screenshots correctly. The recorded DOM "truth"
does not.** Every disagreement inspected pixel-by-pixel went vision's way.
The product linchpin holds — but the recorder's `_visiblePrice` /
`_outOfStock` / `_addToCart` fields are not fit to be ground truth, and two
of them would certify a **dead page as in-stock**.

## Raw agreement with the recorded capture fields

| Field | Agreement | |
|---|---|---|
| pageType | 79/83 (95%) | all 4 "misses" are vision being right (below) |
| inStock | 71/83 (86%) | 10 of 12 misses are truth defects |
| addToCart | 64/83 (77%) | 18 of 19 misses are truth=true, vision=false |
| price | 58/81 (72%) | 19 of 23 misses are demonstrated truth defects |
| unparseable answers | 0/83 | the JSON contract held every time |

Raw agreement is the *wrong* number to quote. Adjudicated below.

## Adjudication — I opened the actual PNGs

Eight screenshots read directly, covering all six disagreement classes.
**Vision matched the pixels 8/8; the recorded field did not.** Remaining
disagreements are assigned to a class by mechanical signature (e.g. every
Scorptec capture carrying `_visiblePrice: "250"`), not individually eyeballed
— stated plainly so the number isn't over-read.

Root cause is one function, `src/providers/validation/playwright.ts:132-152`.
It scrapes the **whole DOM's innerText**, while the screenshot is
`fullPage: false` — a 1280×720 crop. Truth and proof are not looking at the
same thing.

| # | Class | n | Verified example | Who was right |
|---|---|---|---|---|
| A | `_visiblePrice` = *first* `$N` in document order = page chrome | 13/14 Scorptec captures all read **250** | `067db5ea` shows **$639**; `a792a921` shows **$659** | vision (13 distinct correct prices vs one constant) |
| B | `_visiblePrice` grabs the struck-through RRP | 5 Centrecom (+1 mwave) | `3a96394d`: "Don't Pay ~~$947~~ **$649**" — truth said 947 | vision. Truth > vision in **5/5** |
| C | `_outOfStock` regex fires on unrelated text | 8 of the 10 recorded OOS | `a792a921`: "Delivery: **In Stock**", 9 stores in stock, one row "Sold Out" → flagged OOS. `4c6c99b6`: hit the **filter label** "Currently Out of Stock (54)" | vision |
| D | `_addToCart` matches a button anywhere in the DOM | 18 of 19 | `4c9a4698` (umart) is genuinely sold out — page shows "**Notify Me When Available**", no cart button — truth still said `true`. `067db5ea`: real button, below the 720px fold | vision, for what the proof shows |
| E | **Error pages certify as in-stock** | 2 | `1c41bed1` = eBay "SORRY, something went wrong"; `cd000336` = SBTech "**404 — Page not found**". No OOS words on either → `_outOfStock:false` → reads as available | vision ("other", not in stock) |
| F | Listing pages recorded as product pages | 2 | `4c6c99b6` = mwave search ("Showing 1–40 of 78"); `f6cd5061` = Scorptec DDR4 category, page 1/2 | vision ("search") |
| G | **Proof contains no answer** | 3 | `d0179d7b` (memoz), `a6d80052`, `d92bf152` (cplonline): the 720px crop shows header + product photo only — no price, no stock, no button | neither. Vision correctly returned `price: null`, then *guessed* `inStock:false` |

Net: of 23 price disagreements, **zero** are vision misreading a visible
price — 19 are truth defects, 4 are pages where no price is on screen.

## What this means for the product

1. **Vision is the more trustworthy reader of the two.** On the visible
   evidence it beat DOM scraping in every class. T1's question — "does
   vision read the audit screenshots correctly?" — answers **yes**.
2. **Class E is a correctness bug, not a scoring artifact.** A 404 or an
   error page currently produces `_outOfStock:false`, i.e. an audit record
   asserting availability for a page that doesn't exist. Absence of
   "sold out" is being treated as presence of stock. Needs an explicit
   page-validity gate before any availability claim.
3. **Class G is an evidence bug.** `fullPage: false` means the artifact
   routinely omits the price and buy button it is supposed to prove.
   Either capture full-page, or capture the product region.
4. **Ground truth for future vision evals must be vision/human-adjudicated**,
   not `_visiblePrice`. Scoring vision against these fields measures the
   scraper, and marks vision wrong for being right.
5. Vision needs an **"unknown"** option. Forced into `true|false`, it
   guessed `inStock:false` on crops showing no stock information (class G).
   A calibrated abstain is worth more than a coin flip on an audit.

## Artifacts

- `scripts/eval-vision-cli.mjs` — resumable (skips scored hashes; run in
  <10-min foreground chunks, per the Relay background-kill rule).
- `specs/006-hidden-examiner/results/t1-vision-cli.jsonl` — all 83 rows:
  answer, truth, per-field verdict, per-call usage.

Supersedes the 2026-07-08 BLOCKED note: no metered key was needed. Per the
2026-07-24 ruling the whole test ran on the subscription, $0 metered.
