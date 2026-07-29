# T3 — Books transfer test (generality, Spec 007 C8)

`node scripts/exam-cli.mjs --world books-v1 --exam books-v1 --student books-cc-01 --episodes 8`
Student model: sonnet. Ran 2026-07-29 (eps 1–7 at 09:20–09:45, ep 8 at 13:46 in the catch-up run).

## BURN — read this first

| metric | T3 (8 eps, books) | T2 (5 eps, RAM) |
|---|---|---|
| output tokens | **106,924** | 75,000 |
| turns | **288** | 232 |
| model time | **25.1 min** | 17 min |
| cache read | 7,126,650 | — |
| cache write | 455,628 | — |
| input (uncached) | 450 | — |
| API-equivalent | **≈ $5.45** | ≈ $5.80 |
| metered spend | **$0** | $0 |

Per episode: **~3.1 min, ~13.4K output, ~890K cache read, 36 turns.** Episodes ranged
92 s → 287 s. That per-episode figure is the number that governs scheduling — see the
wall-clock section below.

Weekly Max quota: the exam is not the expensive thing. 8 episodes ≈ $5.45 API-equivalent
against a plan that costs far more per week; the orchestrating session out-burns the
student. **Wall clock, not quota, is the binding constraint.**

## Result: transfer is real, the ceiling is the world

Score curve across 8 episodes:

```
0.5 → 0.5 → 0.6667 → 0.5 → 0.5 → 0.6667 → 0.5 → 0.6667
```

`bestEver` 0.6667, `lastImprovedEpisode` 3. No pass (pass mark not reached).

Compared against T2 (RAM: 0.61 → 0.57 → 0.57 → 0.39 → 0.57, best 0.61):

- **The approach transfers.** A structurally distant domain — ISBN not MPN, bookshops not
  component retailers — produced a *higher* best score (0.6667 vs 0.6087) and reached it
  faster (episode 3 vs episode 1). Nothing about the method was RAM-specific.
- **Same plateau shape.** Both curves flatten early and oscillate rather than climb. The
  ceiling is not domain knowledge.

## The headline finding: 2 of 5 truths are unreachable, so 0.6667 may be the max

`worlds/books-v1/key.json` lists 5 truths:

| truth | in `urls.json` | ever returned by `search` |
|---|---|---|
| amazon.com | yes | **yes** |
| barnesandnoble.com | yes | **yes** |
| christianbook.com | yes | **yes** |
| booksamillion.com | yes | **NO** |
| thirdplacebooks.com | yes | **NO** |

The student's own `notes.md` worked this out independently and correctly:

> Environment has a FIXED closed set of 8 candidate URLs (search always returns same 8
> regardless of query)

Confirmed against the episode-8 stream: the only retailer hosts the student ever saw were
amazon, barnesandnoble, christianbook, books2door, goodreads, jamesclear.com, target,
walmart. **The student cannot submit URLs it cannot discover.**

### Root cause: those two truths were never captured at all

Not a ranking problem — a recording problem. Their `worlds/books-v1/fetch` records have
keys `url,error` and **zero body**:

```
GET https://www.booksamillion.com/p/Atomic-Habits/James-Clear/9780735211292 → 403
GET https://www.thirdplacebooks.com/book/9780735211292 → 403
```

**5 of 13 fetch records are error-only** (403/406 bot-walls): booksamillion, thirdplacebooks,
thriftbooks, hpb.com, mcnallyrobinson. With no body there is no text and no `<title>`, so
they are not in the search index, cannot be fetched, cannot be screenshotted, and cannot be
verified. They are unreachable by every tool the student has.

The world author clearly knew bot-walls existed — **mcnallyrobinson (403) is correctly
filed as a trap with `category: "bot-wall"`**. But booksamillion and thirdplacebooks, which
failed exactly the same way, are filed as **truths**. `key.json` certifies (C7 `loadKey`
passes) a rubric that demands two URLs the student is physically prevented from seeing.

So the reachable truth set is 3, not 5: amazon, barnesandnoble, christianbook. The student
submitted exactly those three in episode 8 and scored 0.6667 — it hit the reachable ceiling.

Open question, not chased here: christianbook is a captured truth, yet the student's probing
showed it contributing zero credit (submitting Amazon+B&N alone and Amazon+B&N+christianbook
both scored 0.6667). Its page carries a `dataLayer` "Out of Stock" and a past-due backorder
date, so the judge may be penalising it against the "buy new right now" clause. Worth a look
before anyone treats 0.6667 as the true maximum — the real ceiling may be 2 reachable truths,
not 3.

### This is not fixed by the in-flight `og:title` change

There is an uncommitted change in `src/exam/student.ts` preferring `og:title` when `<title>`
is shorter than 12 chars. Sound fix for the RAM/PLE case (generic "Home" titles losing the
per-term title bonus at `student.ts:107`). It does **nothing** here: these two records have
`<title>` length 0 **and** empty `og:title`, so the fallback resolves back to `""`. Verified
by reading the capture bodies directly.

The fix for T3's ceiling is at record time, not index time: re-record with a real browser
(the successful captures came through Playwright), or reclassify the 403s as traps the way
mcnallyrobinson already is.

## The other finding: memory is now READ, and it still doesn't compound

This is the direct opposite of T2, where the student wrote excellent strategy notes in
ep 2 and never once listed its workspace again.

Here the student built a real memory loop:

- `workspace/MEMORY.md` written ep 1, `workspace/notes.md` maintained through to ep 8.
- `readmem.mjs` / `readmore.mjs` (ep 7) and `parse_bn*.mjs` (ep 8) — it actively read its
  own prior notes back.
- The ep-8 `notes.md` is genuinely good analysis: it enumerates the closed candidate set,
  marks each CONFIRMED CORRECT / CONFIRMED WRONG with the evidence, reverse-engineers the
  scoring model from three data points, and writes a ranked plan for the next episode
  including "submit the bare B&N URL, no query string".

And the score still did not move. Episodes 7 and 8 read that file and scored 0.5 and
0.6667 — the same two values the first six episodes oscillated between.

So T2's conclusion ("no compounding because it never reads its notes") is **wrong as a
general claim**. Reading the notes is not sufficient. In ep 8 the student used all 3
submissions to A/B-test hypotheses (0.5 → 0.3333 → 0.6667), spending two of them on
probes — good method, and it still landed exactly where ep 3 landed five episodes earlier,
because the missing information was never on the board.

Tool usage across all 8 episodes: fetch 97, search 96, write_file 52, run_script 50,
screenshot 30, read_screenshot 30, submit_answer 28. It builds scripts and uses vision
freely — the agent behaviour is not the bottleneck.

## Runner mechanics — append vs overwrite (verified by reading the source)

Asked because the killed 09:45 run left one banked submission and restarting naively would
have destroyed it.

- **`submissions.jsonl` is OVERWRITTEN, not appended.** `exam-cli.mjs:37` —
  `if (existsSync(subsLog)) rmSync(subsLog)` — deletes the log at process start, every run.
- **Episodes DO resume.** `exam-cli.mjs:47` — `for (let i = state.episodes; i < maxEpisodes; i++)`
  starts from the episode count in `students/<id>/state.json`, and `scoreHistory` /
  `bestEver` persist there. So the *scores* survive a kill; only the raw submission lines don't.
- Consequence for this run: `state.json` showed `episodes: 7`, so `--episodes 8` re-ran
  episode 8 only, ~4 min. The banked 09:44 line (ep 8, score 0.5) was copied aside before
  launching rather than silently destroyed; the re-run produced a complete episode 8 with
  all 3 submissions and a better best (0.6667 vs the banked 0.5), so nothing was lost.

The comment on line 37 — "fresh per process; scores persist in state" — is accurate but
easy to misread as safe. It is safe *only* because state.json carries the scores.

## Wall clock — what the 45-minute cap actually costs

The 09:00 run was killed at 09:45 having completed 7 of 8 episodes with **zero committed**.
All of that work survived only because `state.json` is written after each episode; had the
runner not persisted state, 25 minutes of model time would have been lost outright.

Calibration for future runs, from measured per-episode cost of **~3.1 min**:

- Setup (read plan, arm auto-resume, build, inspect state) costs **~8 min** before the
  first episode starts.
- Wrap-up (results file, tick, notes, commit, push, card) costs **~10 min** and must not
  be squeezed.
- That leaves **~27 min** of episode budget → **8 episodes is the realistic ceiling for a
  single 45-minute run, and 6 is the safe number.** The 09:00 run attempting 8 from cold
  was over budget by roughly one episode plus the entire wrap-up.

## Verdict

T3 passes as a generality test: **the method transfers to a structurally distant domain**,
scoring slightly better there than on RAM. It does not pass as a capability test, because
the world caps the reachable score. The plateau is now shown to survive a working
read-write memory loop, which relocates the compounding problem from "the agent forgets"
to something harder.
