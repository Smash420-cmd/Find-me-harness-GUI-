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

(recording results appended below)
