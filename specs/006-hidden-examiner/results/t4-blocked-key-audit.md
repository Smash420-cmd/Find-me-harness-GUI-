# T4 — NOT RUN (blocked). books-v1 answer key audited instead.

**Date:** 2026-08-05 · **Burn:** ~0 model tokens beyond this session; **no episodes run, $0 metered.**
Wall-clock ~26 min of the 45-min cap. 11 of 13 key screenshots opened by hand (vision).

T4 was the first unchecked test, and the brief blocks it until Patrick rules on the
books-v1 key. Rather than just ask, this run **opened the screenshots the key was
signed without opening.** The rulings are now answerable from evidence.

## Headline: `passMark: 0.9` is unreachable on books-v1 by arithmetic

`judge.ts:112-134` with `weights.missedTruth: 1` and 5 truths:

```
score = 1 - missed / (5·1 + 1)
```

Two truths (booksamillion, thirdplacebooks) return **403 with zero body** in
`fetch/`, so they are not in the search index and cannot be discovered. Best
possible = 3 of 5 found → `1 - 2/6` = **0.6667**. That is *exactly* T3's ep-8
best, which confirms the model: **the student hit the world's ceiling, not its
own.** 0.9 cannot be scored. T4 as written (10–15 episodes chasing ≥0.9) would
have burned a whole window measuring a recording bug.

## What the screenshots actually show

The key was signed `certifiedBy: Patrick, certifiedAt: 2026-07-04` with **every
checkbox in `REVIEW-KEY.md` unticked**. The "note" column was drafted from URLs,
not from the shots. Opening them:

### Truths (5 keyed → 1 clean)

| keyed as | url | what the shot shows | verdict |
|---|---|---|---|
| truth | amazon `/dp/0735211299` | **Format: Hardcover · Buy New AUD 25.95 · In Stock** | ✅ genuine truth |
| truth | booksamillion | Cloudflare **"Performing security verification"** (Ray a158026019e92a2a) | ❌ bot-wall |
| truth | thirdplacebooks | Cloudflare **"Checking connection…"** | ❌ bot-wall |
| truth | barnesandnoble `/1129201155` | B&N **"Something went wrong — An unexpected error occurred"** | ❌ error page |
| truth | christianbook | real hardcover page, ADD TO CART $16.28, but **"Expected to ship on or about 07/22/26"** + "Email me when this product is available" | ⚠️ backorder, not "buy now" |

The note "Books-A-Million, in stock $21.56" describes a page **nobody ever saw** —
the capture is a bot-wall and the fetch is a 403.

### The four open rulings — answered

1. **Promote used hardcovers (HPB, ThriftBooks) to truths?** **Moot.** HPB's shot
   is a Cloudflare bot-wall (Ray a158043d388a1a6e); ThriftBooks has no shot and a
   **406**. Neither page was ever captured, so neither can be promoted whatever
   the new/used policy. (HPB is filed `oem-opaque` but is really `bot-wall` —
   score-neutral: `classify()` maps both to `unknownShown`.)
2. **jamesclear.com a category-page trap?** **Confirmed.** Author landing page
   headed "Books", no price, no buy control.
3. **Is the B&N URL the hardcover in stock?** **Unanswerable from the proof** —
   the shot is an error page. Cannot be certified as a truth on this evidence.
4. **Is mcnallyrobinson genuinely a ghost?** **Right category, wrong reason.** It
   is correctly filed `bot-wall`, but the shot shows a Cloudflare wall, *not* the
   out-of-stock page the ruling describes.

## Root cause — one bug, and T1 already found it

All three failures are the same defect T1 documented on the RAM world: **a page
the recorder never actually loaded is recorded as healthy.** Both bot-walled
captures carry `"_addToCart": "false", "_outOfStock": "false"` — i.e. a Cloudflare
interstitial certifies as *not out of stock*, exactly T1's worst finding ("a 404
and an eBay error page both recorded `_outOfStock:false`"). This is now confirmed
on a second, structurally distant world. It is a recorder bug, not a books quirk.

5 of 13 `fetch/` records are error-only (403/403/403/406 + one more); 4 of the 11
opened screenshots are bot-walls or error pages.

## Recommended ruling (Patrick's call — nothing changed on disk)

Reclassify **booksamillion** and **thirdplacebooks** as `bot-wall` traps, matching
mcnallyrobinson which failed identically and is already filed that way. Then:

- truths = 3 (amazon, christianbook, barnesandnoble) → T3's ep-8 submission
  scores **1.0000**, and 0.9 becomes reachable.
- If B&N and christianbook are *also* dropped on the evidence above, truths = 1
  (amazon) and the exam is too thin to be interesting — **re-record the world with
  a real browser** instead (the successful captures came via Playwright).

Either way the key must be re-signed, this time with the boxes actually ticked.

## Do not read T3's numbers as a student ceiling

T3 (0.5→0.6667, best 0.6667) measured a world that caps at 0.6667. The student
reached the cap in episode 3 and never had anywhere to go. Any conclusion about
compounding drawn from that curve is confounded.

## Also this run

- Committed the long-uncommitted `og:title` fallback in `src/exam/student.ts`
  (helps the RAM/PLE generic-`<title>` case; does **not** help here — the two
  403 records have no body at all).
- Student model is now `claude-opus-5` (commit `1f0964a`). **No Opus episode has
  ever been timed** — the ~3.1 min/episode baseline is still sonnet-only and
  still void. Time one episode before sizing any future batch.
