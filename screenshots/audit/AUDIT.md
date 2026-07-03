# Filtered-Results Audit — last 2 scans (DDR4 32GB 2×16GB, desktop)

Every suspect drop re-verified independently on 2026-07-02: once with the same
HTTP read the harness uses, once with a fresh Playwright render (universal
add-to-cart / out-of-stock / price signals) + screenshot. Raw data:
`audit-raw.json` in this folder. Screenshots referenced per row — open them to
check my calls.

## Verdicts

| # | Link | Harness said | My re-check | Verdict |
|---|------|--------------|-------------|---------|
| A1 | [UMart — Kingston Fury Beast 2×16 3200 CL16 $149](https://www.umart.com.au/product/kingston-32gb-2x16gb-kf432c16bbk2-32-fury-beast-cl16-3200mhz-ddr4-ram-black-63435) | out of stock | Page shows **"Want a stock alert? Notify Me When Available!"** — see `proof-1782941105856-u80w4b.png` | ✅ CORRECT DROP (shortage is real, even on the exact-spec cheapest kit) |
| A2 | [MSY — same SKU](https://www.msy.com.au/product/kingston-32gb-2x16gb-kf432c16bbk2-32-fury-beast-cl16-3200mhz-ddr4-ram-black-63435) | out of stock | Same platform, same signals — `proof-1782941113101-pycput.png` | ✅ CORRECT DROP |
| B1 | [MemOZ — 32GB 2×16GB 2666 DDR4 Desktop](https://memoz.com.au/product/2x16gb-2666-pc-ram/) | "unconfirmable SKU" | **Real desktop 2×16 kit, IN STOCK** (Sale badge, add-to-cart) — `proof-1782941131466-8edt9p.png` | ❌ **WRONG DROP — two bugs found & fixed** (see below) |
| B2 | [MemOZ — 2×16GB 3200 SODIMM](https://memoz.com.au/product/2x16gb-3200-sodimm/) | "unconfirmable SKU" | Laptop SODIMM — right outcome, wrong reason | ✅ correct outcome (now dropped as `sodimm ≠ dimm` after parser fix) |
| C1 | [Scorptec — Team Elite 1×32 SODIMM](https://www.scorptec.com.au/product/memory/ddr4-laptop-memory/98940-ted432g3200c22-s01) | wrong SKU: kit 1≠2 | 1×32, SODIMM, and render shows out-of-stock — wrong three ways | ✅ CORRECT DROP |
| C2 | [Upgradeable UL1913](https://www.upgradeable.com.au/products/ul1913) | sodimm ≠ dimm | "32GB DDR4 3200 SODIMM Module Lenovo Compatible" — in stock but laptop RAM | ✅ CORRECT DROP |
| C3 | [Upgradeable UMS1913](https://www.upgradeable.com.au/products/ums1913) | sodimm ≠ dimm | Same, "Standard Compatible" SODIMM | ✅ CORRECT DROP |
| D1 | [eBay item 116260890163](https://www.ebay.com.au/itm/116260890163) | no RAM attrs in URL slug | eBay bot-walls both HTTP (403) and the render — **cannot be audited by machine** | ⚠️ UNKNOWABLE — eBay needs its own handling or honest exclusion |
| D2 | [Mwave trending/32gb-ddr4-ram](https://www.mwave.com.au/trending/32gb-ddr4-ram) | "unconfirmable SKU" | Category page, no product, no price | ✅ CORRECT DROP |
| E1 | [SB Tech — Vengeance LPX 3000 $293](https://www.sbtech.com.au/dual-channel-32gb-2x16gb-ddr4-dram-vengeance-lpx-dimm-3000mhz/) | HTTP 404 | 404 on my read too — dead link; StaticICE's index is stale | ✅ CORRECT DROP |

## Cards that PASSED (for your cross-check)

- [Centre Com — G.Skill Trident Z RGB 2×16 DDR4-3600 CL18 @ $369](https://www.centrecom.com.au/gskill-trident-z-rgb-32gb2x16gb-ddr4-3600mhz-cl18-ram-black)
- [Computer Alliance — G.Skill Ripjaws V 2×16 DDR4-3600 F4-3600C18D-32GVK @ $399](https://www.computeralliance.com.au/product/32gb-ddr4-g-skill-2x16gb-3600mt-s-ripjaws-v-ram-kit-f4-3600c18d-32gvk/)

## Bugs found by this audit (all fixed)

1. **Parser demanded an explicit "MHz" token** — "32GB 2x16GB 2666 PC RAM DDR4"
   parsed as nothing → real in-stock kits dropped as "unconfirmable". Now also
   reads PC4/PC5 bandwidth ratings (PC4-21300 → 2666), bare in-band speeds
   ("2666"), and G.Skill part numbers (F4-3600C18D → 3600 CL18).
2. **Universal price signal took the FIRST "$" on the page** — which is the
   header cart's "$0.00" on many stores (MemOZ, Upgradeable, Scorptec). Now
   takes the first **positive** price.
3. **`addToCart` render signal false-positives** on notify-me pages (A1 shows
   `addToCart:true` on a notify-me page — some unrelated button matched). The
   HTTP read catches these first today; noted as a known weakness of the
   render-side gate.

## Answer to "why so few results when I left it wide open"

Of everything discovered across both runs, the genuinely buyable desktop
2×16 kits numbered well under ten — the shortage is real (A1: even the $149
Fury Beast is notify-me at two chains). But the harness was ALSO throwing away
real stock (B1) and never seeing more because discovery is shallow (DDG
bot-walls, StaticICE stale/narrow, eBay unreachable). Coverage fixes so far:
brand-seeded queries, SERP cache, browser fallback, and this audit's parser
fixes. The remaining structural gap is the verified-SKU ledger — the harness
still forgets everything it has ever proven between runs.
