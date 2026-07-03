# Spec 005 — Regional and global source support

## Context

StaticICE covers AU retailers only. The harness engine is domain-free and
region-free — it has no opinion on geography. Regional logic belongs in the
chassis and its sources.

## Goal

Support international sources and per-region configuration, while preserving
warranty and grey-import visibility for the user.

## Behavioural claims

**C1 — Region is a first-class spec field.**
The spec (and the structured/conversational doors) can carry a `region` field
(e.g. "AU", "US", "UK", "global"). Sources that are region-specific declare
their region. The engine routes to sources that match.

**C2 — International shipping is a valid result.**
A result from a US retailer that ships to AU is a valid candidate. The proof-
shot must show the AU-shipping price (not just the USD price), or the card is
flagged as "price unconfirmed for your region."

**C3 — Warranty and grey import are surfaced, not hidden.**
Results from non-local distributors are labelled (e.g. "grey import — check
warranty"). The existing `greyImport` flag on `RamCandidateData` is the
foundation. For international results, this flag is set unless the retailer is
a known authorised distributor for the user's region.

**C4 — Regional default is set at startup, overridable per search.**
A `HARNESS_REGION` env var (default "AU") sets the default. The UI exposes a
region selector. The conversational door can ask "are you happy to consider
international retailers?" during triage.

**C5 — Sources self-declare their region coverage.**
Each source carries `readonly regions: string[]` (e.g. `["AU"]` for
StaticICE, `["US","global"]` for a future Newegg source). The chassis filters
sources whose regions overlap with the spec region.

## Source candidates for non-AU regions

| Region | Candidate source | Notes |
|---|---|---|
| Global | Google Shopping | Wide coverage, fragile (CAPTCHA risk) |
| US | Newegg | Stable, structured, ships globally |
| US/Global | Amazon | Huge but complex (affiliate, dynamic pricing) |
| EU | Geizhals | German price comparison, covers DE/AT/CH |
| Global | PriceMe / Nexus | Smaller but more scraper-friendly |

## Out of scope for v1 (Spec 004)

Everything in this spec. AU-only via StaticICE is acceptable for now.
