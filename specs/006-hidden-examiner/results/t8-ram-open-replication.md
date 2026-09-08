# T8 — does the ddr4-open curve replicate? (pre-registered)

Run started 2026-09-09 09:00 AEST. World verified before spending:
`worlds/ram-v1/key.json` reads `certifiedAt: 2026-08-07`, truths 34 / 22 / 33,
traps 13 / 13 / 14. Unchanged since 08-07; no ruling has landed.

## Pre-registration (written BEFORE any episode was run)

T7 (`ram-open-01`) produced this project's first cross-episode improvement on
`ddr4-open`: **0.8857 FAIL -> 0.9429 PASS**, on 157 then 95 tool calls. n=1.
This test asks whether that replicates with a **fresh student id**
(`ram-open-02`), same exam, same cap 120, same model `claude-opus-5`.

Registered predictions:

1. **ep1 fails**, scoring in the **0.83-0.90** band. Reason: the ep1 ceiling is
   not truth coverage — T7 swept **34/34 truths and still failed**. The penalty
   comes from traps/unkeyed, and a cold student has no way to know which pages
   the key refuses.
2. **ep1 includes the memoz `2x16gb-2666-pc-ram` trap.** Its proof shot shows a
   genuine 2x16GB DDR4 kit, so a correct reader submits it.
3. **ep2 > ep1**, and ep2 uses **fewer tool calls** than ep1 — world knowledge is
   what transferred in T7, not judgement.
4. **ep2 sub1 still contains at least one page the judge rejects.** T7's notes
   said "next episode: resubmit minus memoz" and the student did not do it; the
   correction needed judge confirmation. If this repeats, "notes made it faster,
   not righter" survives replication.

Falsifier: if ep1 passes outright, or ep2 <= ep1, the T7 curve was a one-off.

## Key audit (no episodes needed) — the contradiction is WORSE than recorded

Ran `ddr4-gskill`'s 22 truths against `ddr4-open`'s 34. `ddr4-open` is the
**broader** request and subsumes the G.Skill-only one, so every gskill truth must
appear in open. **Two do not:**

| URL | in `ddr4-gskill` | in `ddr4-open` |
|---|---|---|
| `pcbyte.com.au/...ripjaws-v-3600mhz-cl16-ddr4-ram-72183` | TRUTH | **absent** |
| `jbhifi.com.au/...g-skill-trident-z-neo-32gb-2x16gb-ddr4-3200mhz...` | TRUTH | **absent** |

Absent, not trapped: `truth in gskill AND trap in open = 0`. So both are
**unkeyed** in `ddr4-open`, and by the T6d asymmetry (`unknownShown: 2` vs
`missedTruth: 1`) a student that shows them is docked **2 points each** for pages
this same certified key calls correct one exam over.

The 09-02 note recorded only `pcbyte`. **`jbhifi` is new.** Together they are
4 points of available penalty on a 35-point scale - larger than T7's entire ep1
penalty (4). This is not a judgement call; it is an internal contradiction in a
key signed `certifiedAt: 2026-08-07`. **Nothing has been changed on disk.**

## Results

(episodes appended below as they land)
