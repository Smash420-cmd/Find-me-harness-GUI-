# Spec 004 — Multi-source finder with LLM-directed tool selection

## Problem

The current harness has one source (Umart) hardwired into the engine loop.
This means:
- Any Umart stock gap = zero results, no fallback
- The engine can't discover better prices elsewhere
- Adding a second retailer requires duplicating the whole loop

## Unlock

Adopting StaticICE as the finder breaks the Umart lock completely. The harness
becomes genuinely multi-retailer without building a per-retailer scraper for
each one. StaticICE already indexes Umart, PLE, Scorptec, MSY, Centrecom and
others — the harness inherits that coverage for free. Umart remains the first
retailer with a fully tested field interpreter, but it is no longer the only
one results can come from.

## Goal

Give the engine a **tool belt** of named finder tools. The LLM decides which
tools to invoke for a given spec — not always the same tool, not always all of
them. Then the verifier (Playwright, Law 1) runs on every candidate regardless
of source. The user only ever sees proof-shot-backed results.

## Behavioural claims

**C1 — Tool selection is LLM-directed.**
Given a spec, the engine asks the LLM "which of these tools should I use and
why?" The LLM returns an ordered list of tool names to invoke. The engine never
hard-codes a search order.

**C2 — All candidates are verified.**
Every URL returned by any finder tool must pass Playwright verification (live
render + proof-shot) before appearing on a result card. Law 1 is unconditional.

**C3 — Source is surfaced on the card.**
Each result card shows which retailer the URL came from (Umart, PLE, Scorptec,
etc.) so the user knows where to buy.

**C4 — Deduplication before verify.**
If two tools return the same URL, it is verified once, not twice.

**C5 — Tool failure is isolated.**
If one finder tool errors (site down, parse failure), the engine logs it and
continues with other tools. A single tool failure must not abort the run.

**C6 — The engine/chassis seam holds (Law 7).**
Finder tools are chassis-supplied and domain-specific. The engine only knows
about `IFinderTool` (name + invoke). It never imports a tool directly.

## Background: Umart is a vertical slice, not a tool

Umart was the first full end-to-end proof of the harness pattern:
source → chassis → verifier → result card. It proved the architecture works.
It is not a selectable tool — it is the foundation.

## Tool belt — v1 tools

The tool belt contains **discovery/search strategies**, not retailers.

| Name | What it does |
|---|---|
| `staticice_search` | Searches staticice.com.au — returns candidate product URLs spanning all major AU retailers (Umart, PLE, Scorptec, MSY, Centrecom, etc.) without stock filtering |

`staticice_search` intentionally returns ghost inventory. The verifier filters
it. That is the point — StaticICE casts a wide net, Playwright culls it.

Future tools (not in scope for v1):
- `google_shopping_search` — broader but fragile (CAPTCHA risk)
- `retailer_direct_search` — search one retailer's own catalogue when a brand/retailer is specified

## LLM tool-selection prompt (sketch)

```
You are selecting search tools for: {spec summary}.
Available tools: {tool names + one-line descriptions}.
Return a JSON array of tool names to invoke, most promising first.
Reply with ONLY the JSON array, e.g. ["staticice_search","umart_direct"]
```

The engine invokes them in order, collecting candidates, then verifies all at
once. The LLM is not in the verify loop — it only picks tools upfront.

## Per-retailer field interpretation

StaticICE returns URLs pointing to pages on Umart, PLE, Scorptec, etc.
The Playwright verifier captures raw fields from those pages. The chassis must
supply a per-retailer interpreter: given a hostname + raw fields → structured
candidate data (price, title, in-stock).

v1 interpreters needed:
- `umart.com.au` — already exists
- `ple.com.au` — new
- `scorptec.com.au` — new
- `msy.com.au` — new (optional, lower priority)

A fallback generic interpreter reads price from any obvious price selector.

## Out of scope

- Building a Google Shopping scraper (fragile, ToS risk)
- Retailer account login / cart integration
- Price history / alerting
- More than 2 finder tools in v1
