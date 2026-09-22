# T5 — Re-record books-v1 and widen the board (sliced across runs)

T5 does not fit one 45-minute Relay box as written (widen + re-record, review
every screenshot, re-sign, re-run T4). It is being done in slices, each
committed on its own:

| slice | work | status |
|---|---|---|
| 1 | back up, widen `urls.json`, re-record | **2026-09-23 — this run** |
| 2 | open every proof shot, fill `REVIEW-KEY.md`, draft the new `key.json` | next |
| 3 | Patrick certifies the key (his signature, not mine) | ruling |
| 4 | re-run T4 into `results/t4-rerun-<date>.md` | after 3 |

**I will not sign the key.** `key.json` carries `certifiedBy: "Patrick"`;
putting a date on it is his certification, not a step I can take for him. The
recorder never touches `key.json`, so the certified 2026-08-07 key is still the
one on disk after this slice.

## Slice 1 — 2026-09-23

Run started 09:00 AEST. No ruling had landed; RAM key unchanged
(`certifiedAt: 2026-08-07`, 34/22/33).

### Backup before overwriting

`worlds/` is gitignored and **nothing under it is tracked** (`git ls-files
worlds/` is empty; the `!worlds/*/urls.json` and `!worlds/*/manifest.json`
negations in `.gitignore` cannot re-include files under an ignored directory).
A re-record overwrites the frozen bodies in place, so the pre-T5 world would be
unrecoverable. Copied first, 14 MB, to the Relay task dir
(`~/.relay/context/ms4fkxk9emekyh/books-v1.bak-2026-09-23`) — deliberately
outside `worlds/` so the copy's `urls.json`/`manifest.json` cannot leak into a
commit.

Because `urls.json` is not tracked either, **the widened list is recorded here**
so it survives in git.

### Widening: 5 truths -> 12 draft truths, four markets

The TEST-PLAN asks for 5-6 reachable new-hardcover truths for ISBN
9780735211292, spread across markets (Spec 005 is region-free by design), and
says to over-supply and let the recorder's bodyless-truth warning decide.

Candidates were status-checked with plain `curl` (desktop Chrome UA) first:

| market | seller | URL | curl |
|---|---|---|---|
| AU | Booktopia | `booktopia.com.au/atomic-habits-james-clear/book/9780735211292.html` | 200 |
| AU | Dymocks | `dymocks.com.au/book/atomic-habits-by-james-clear-9780735211292` | 403 |
| UK | Waterstones | `waterstones.com/book/atomic-habits/james-clear/9780735211292` | 200 |
| UK | Blackwell's | `blackwells.co.uk/bookshop/product/9780735211292` | 403 |
| CA | Indigo | `indigo.ca/en-ca/atomic-habits-...-bad-ones/9780735211292.html` | 403 |
| US | Bookshop.org | `bookshop.org/book/9780735211292` | 403 |
| US | Powell's | `powells.com/book/-9780735211292` | 403 |

All seven were added as **draft** truths (`role: "truth"`, note prefixed
`DRAFT (T5 widen 2026-09-23)`). A 403 to curl is usually a bot wall that the
recorder's Playwright fallback can pass, so those stay in and the recording
decides.

Dropped before recording:
- **QBD** (`qbd.com.au/atomic-habits/james-clear/9780735211292/`) — 404, my URL
  guess was wrong.
- **Foyles** (`foyles.co.uk/book/atomic-habits/james-clear/9780735211292`) — 404,
  same.
- **Book Depository** — redirects to an Amazon books landing page; the store has
  closed.

One caution for the review slice: **Waterstones sells the UK edition under a
different ISBN.** A 200 on a URL containing 9780735211292 does not prove the page
is that hardcover or that it is buyable. The screenshot decides.

### Recording result (09:01-09:04, 20 URLs, ~3 min)

`node scripts/record-urls.mjs worlds/books-v1`. Every URL was compared against
the backup, body by body. **Nothing was lost:** every page that had a body in
July still has one, and Books-A-Million was already bodyless in July.

| page | July body | today body | today shot |
|---|---|---|---|
| Amazon | 2.45 MB | 2.45 MB | product, **Hardcover AUD 26.13, In Stock** |
| Christianbook | 219 KB | 224 KB | product, **In Stock, $14.40, Add to Cart**, stock no. WW211299 (July: backorder) |
| Barnes & Noble | 1.64 MB | 1.72 MB | **"Something went wrong"**, same as July (see below) |
| Third Place Books | error | **175 KB via render** | 1st shot: bot wall. **Re-shot: product, Hardcover (10/16/2018), $27.00, add-to-cart** |
| Booktopia (AU) | - | **261 KB** | product, **HARDCOVER $48.75, Add to Cart**, "Hardcover, 16 October 2018" |
| Indigo (CA) | - | 584 KB | **Indigo homepage**, twice. The product URL redirects |
| Books-A-Million | error | error (403) | - |
| Dymocks (AU) | - | error (403) | - |
| Waterstones (UK) | - | error (403) | **captcha** ("Complete this captcha to connect to Waterstones") |
| Blackwell's (UK) | - | error (403) | - |
| Bookshop.org (US) | - | error (403) | - |
| Powell's (US) | - | error (403) | - |
| thriftbooks (trap) | error | **848 KB** | shot failed: `page.goto: Download is starting` |

The recorder's warning listed 6 bodyless truths. The mechanism: plain HTTP
returns 403, the Playwright render fallback runs, and `looksLikeBotWall()`
(`src/exam/world.ts:52`) rejects what it renders, so an error is written. That
is the recorder working as designed, not a bug. A "shot ok" line only means a
screenshot was taken; for these pages it is a picture of the wall.

**The reachable board doubles, from 3 truths to 6 bodies, but only 5 are real
products.** Indigo has a body, and that body is the homepage (title
*"Indigo - Chapters - Coles | Canada's Biggest Bookstore"*, zero mentions of
9780735211292). It would be searchable and wrong, which is worse than
bodyless. **It must not be a truth.**

**Market spread: 4 US + 1 AU. Nothing from the UK or CA reached the world.**
Every UK candidate was bot-walled, and the one CA candidate redirected. The
region-free goal is only partly met, and a second round of candidates is the
way to widen it. Different seller domains matter more than different URL guesses
for the same ones.

### Vision beat the DOM again (T1's finding, reconfirmed)

Booktopia's capture fields say `_outOfStock: "true"` and `_visiblePrice: "15"`.
The shot shows **Hardcover, $48.75, Add to Cart**. The `15` is from a
*"$15 off when you spend $100"* banner. Both DOM fields are wrong, so any key
built from `fields` rather than the shots would mis-key this page.

### Body and shot can disagree: which one the student sees matters

Third Place (first shot) and Barnes & Noble (both shots, July and today) show a
wall or error in the **shot** while the **body** is the real product page (B&N:
ISBN x37; Third Place: ISBN x22, "In Stock", "Add to cart"). The student reads
bodies, not shots. So a page can look dead in the review and be fully live to
the student.

The certified review sheet already knows this for B&N: *"B&N 'Something went
wrong' error page - kept as truth per 2026-08-07 ruling."* **That is a ruling,
not a defect, and I am not re-opening it.** Recording it here because the same
split now applies to Third Place, and it will keep recurring.

## THE WORLD ON DISK NO LONGER MATCHES ITS CERTIFIED KEY

`worlds/books-v1/key.json` (`certifiedAt: 2026-08-07`, 3 truths, 10 traps) was
certified against the **July** recording. After this re-record:

- **Third Place Books is keyed `trap: bot-wall`**, but it is now a genuine,
  buyable hardcover in both body and shot. A student that finds it would be
  **docked 2 points (`bot-wall` maps to `unknownShown` in `judge.ts` `classify()`) for a correct answer**. That is the
  `ddr4-open` pathology, created by the re-record itself.
- **thriftbooks** (`oem-opaque`) now has an 848 KB body, so it is newly
  discoverable. Its category is unchanged, and the effect of that is Patrick's
  call.
- Booktopia and the five other new drafts are **unkeyed**. A student showing
  Booktopia, a genuine buyable hardcover, loses 2.

**Do not run any student on `books-v1` until the key is re-certified.** The
July world is intact in the backup if T4 needs re-running against the old key
in the meantime (copy it back over `worlds/books-v1`).

## Proposed key for Patrick to certify (draft - not written to disk)

**Truths (5):**

| # | seller | market | evidence |
|---|---|---|---|
| 1 | Amazon `dp/0735211299` | US (ships to AU) | shot: Hardcover AUD 26.13, In Stock |
| 2 | Christianbook `pd/211299` | US | shot: In Stock, $14.40, Add to Cart |
| 3 | Barnes & Noble `1129201155` | US | body is product; shot is error page - **per the 2026-08-07 ruling** |
| 4 | **Booktopia** `9780735211292.html` | **AU** | **new**; shot: Hardcover $48.75, Add to Cart |
| 5 | **Third Place Books** `book/9780735211292` | US | **promote from `bot-wall` trap**; re-shot: Hardcover $27.00, add-to-cart. Its stock line sits under a cookie banner in the shot; the body says "In Stock" |

**Changes to traps / drafts:**
- **Indigo**: do not key as truth. Either `dead-link` (redirects to homepage) or
  drop it from `urls.json`.
- **Dymocks, Waterstones, Blackwell's, Bookshop.org, Powell's**: bodyless. The
  recorder's own rule is to demote them to `bot-wall` traps or replace them
  before signing. Only Waterstones' shot has been confirmed a captcha; the
  other four shots have not been opened yet.
- **Books-A-Million**: stays `bot-wall` as certified.
- **thriftbooks**: now has a body. Check whether `oem-opaque` still fits.

### The board is still too narrow to leave room for a single miss

`judge.ts`: `scale = |truths| + 1` and a pass needs `1 - penalty/scale >= 0.9`.
**One miss passes only when `1/(n+1) <= 0.1`, i.e. n >= 9 truths.** With 5
truths, one miss scores `1 - 1/6 = 0.8333` and fails. The widened board is
still pass-only-if-perfect, just as T4's 3-truth board was. It is no longer
trivially enumerable (5 sellers across 2 markets, not 3 pages), but the T5
question *"with a board too wide to enumerate, does the student still pass"*
needs **at least 9 real, bodied truths**. Today's candidates yield 5.
**Flagging, not fixing** - `passMark` and weights stay untouched.

## Slice 1 verdict

- Re-record **done**; July world backed up; no data lost.
- Reachable truths **3 -> 5 real products** (+ Indigo's false body).
- Markets **US + AU only**; UK and CA all walled or redirected.
- **The certified key is now stale against its world** - Third Place would be
  mis-scored. No student should run on `books-v1` before re-certification.
- A 5-truth board still fails on one miss; a board that tolerates one miss
  needs 9.
- Nothing written to `key.json`; `passMark`, weights and `MAX_SUBMISSIONS`
  untouched.

## Slice 2 (next run)

1. Open the four unreviewed bodyless shots (Dymocks, Blackwell's, Bookshop.org,
   Powell's) and the traps' new shots, and fill `REVIEW-KEY.md` for the new
   recording.
2. Source a second round of **UK/CA/AU candidates on different domains**, aiming
   for 9+ bodied truths. Walled domains fail as domains, so re-guessing their
   URLs won't help.
3. Write the proposed key as a **separate draft file**, not over `key.json`, for
   Patrick to sign.
