# Plan 004 — Multi-source finder

## Findings from probes

- StaticICE HTML is table-based CGI — regex-parseable, no JS needed.
- MSY and Umart run the SAME ecommerce platform:
  - `span[itemprop="price"]` + `content` attr → price ✓
  - `link[itemprop="availability"]` + `href` → schema.org/InStock ✓
  - Page title format: `Product Name - retailer.com.au`
- Existing `UMART_RENDER_SELECTORS` and `interpretUmartFields` work for MSY unchanged.
- v1 scope: Umart + MSY (same platform). PLE/Scorptec in a future iteration.

## Steps

### Step 1 — `parse.ts`: make cleanTitle generic
Strip ` - *.com.au` not just ` - Umart.com.au`.

### Step 2 — `types.ts`: add `retailer?` to `RamCandidateData`

### Step 3 — `staticice.ts`: new `StaticIceSource`
- Build query from spec: `{generation} {capacityGb}GB RAM`
- Fetch `https://www.staticice.com.au/cgi-bin/search.cgi?q=...&stype=1&etype=1`
- Parse each product row from `<a>` tags with `linkid=2`:
  - URL from `newurl` param (URL-decode)
  - Price from link text
  - Title + retailer name + stock hint from `alt` attribute
- Filter: only candidates whose URL hostname is `umart.com.au` or `msy.com.au`
- `read()`: fetch retailer page, use existing `parseProductPage` (microdata)

### Step 4 — `server.ts`: swap source
Replace `UmartSource` with `StaticIceSource`. captureProof unchanged.

### Step 5 — `view.ts` + `page.ts`: show retailer on card
