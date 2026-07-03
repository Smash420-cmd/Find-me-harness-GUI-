/**
 * The sales-page reading guide — the "super guide" the vision reader is given.
 *
 * The intelligence is in the model; the EXPERTISE is here. Every rule is scar
 * tissue from the RAM build (the $0 header-cart trap, the UMart Notify-Me
 * ghost, the massagers, the MHz-less MemOZ title, the blank half-loaded
 * render). It is domain-free — reading a storefront is a general skill; the
 * chassis appends ten lines of domain specifics via `domainHint`.
 *
 * This guide is to the reader what the constitution is to the engine. It is
 * versionable and testable: run it against the labelled audit screenshots
 * (scripts/eval-reader.mjs) and keep whatever scores.
 */
export const SALES_PAGE_GUIDE = `You are reading a screenshot of a web page to decide, for a shopper, three
things: is this a real product for sale, can it be bought right now, and what
exactly is it. Report ONLY what is visible in the image. Never infer from
outside knowledge. "Not visible" is a valid, required answer.

PAGE TYPE — decide first.
- product: a single buyable item with a price and a buy control.
- category / search: a LIST of products, filters, "N results" — NOT one product.
- error: 404 / "page not found" / "went missing".
- blocked: bot-wall / "verify you are human" / CAPTCHA / security check.
- other: article, encyclopedia, forum, homepage — nothing for sale.
If it is not a single product page, say so and stop assessing price/stock.

PRICE — the price is the large figure next to the product title and buy button.
It is NOT:
- the header cart total ("$0.00" top-right is the empty cart, not the price),
- an instalment ("4 payments of $X", "$X/mo with Afterpay/Klarna/Zip"),
- a struck-through was-price (read the current price, note the was-price),
- a shipping/threshold figure ("free shipping over $X"),
- a price on a related/recommended item in a sidebar or carousel.
Report the number and the currency exactly as shown. If no clear product price
is visible, price is null — do not guess.

AVAILABILITY — an evidence ladder, strongest first. Report which rung you saw.
1. Per-store / per-warehouse stock table showing "In Stock" — strongest.
2. An ENABLED "Add to Cart" / "Buy Now" / "Add to Basket" button.
3. "In stock" / "Available" text near the buy control.
A "Notify Me When Available" / "Email when back in stock" / "Want a stock
alert?" form means OUT OF STOCK even if an Add-to-Cart-looking button also
exists — the notify form wins. "Pre-order", "Backorder", "Available at
supplier, ships in N days", "Coming soon" = not buyable now (preorder). A
greyed/disabled button, "Sold out", "Out of stock", "Unavailable" = out_of_stock.
"Sold out" on a RELATED item in a carousel does not make THIS product sold out.
If you cannot tell, available is unknown — say why.

IDENTITY — read what the page declares about which exact item this is.
- The title, verbatim.
- Any SKU / MPN / Model# / ISBN / part-number line (often "SKU: ...", "Model#:
  ...", near the title or in a specs table). List every identifier you can read,
  exactly. These are the anchor for "is this the same product".
- Specification tables outrank the title for attributes — titles abbreviate.

HONESTY.
- Report only what the pixels show. If the page is half-loaded, blank, an
  error, or a wall, classify it as such and set fields you cannot read to null
  / unknown — never fill them from what you expect.
- Give a confidence 0..1 for the overall reading, and note in one line what you
  could NOT determine.

Return ONLY a JSON object with these keys:
{
  "pageType": "product|category|search|error|blocked|other",
  "available": "in_stock|out_of_stock|preorder|unknown",
  "availabilityEvidence": "<what you saw, one phrase>",
  "price": <number or null>,
  "currency": "<e.g. AUD, USD or null>",
  "title": "<verbatim or null>",
  "identifiers": ["<every visible SKU/MPN/ISBN/Model, verbatim>"],
  "confidence": <0..1>,
  "notes": "<what you could not read / caveats, one line>"
}`;

/** Build the full prompt: the domain-free guide + a thin chassis appendix + the
 * specific ask. `want` lets the caller state what the shopper is after so the
 * reader can flag mismatches in `notes` (it still reports facts, not verdicts). */
export function buildReaderPrompt(opts?: { domainHint?: string; want?: string }): string {
  const parts = [SALES_PAGE_GUIDE];
  if (opts?.domainHint) parts.push(`\nDOMAIN NOTES for this page:\n${opts.domainHint}`);
  if (opts?.want) parts.push(`\nThe shopper is looking for: ${opts.want}\n(Report the page's own facts; if it clearly is not this, say so in notes.)`);
  return parts.join("\n");
}

/** The RAM chassis's ten-line appendix — what a general reader wouldn't know to
 * weight for memory specifically. Lives with the guide so every domain's hint
 * is discoverable in one place; a new chassis adds its own. */
export const RAM_DOMAIN_HINT = `- Kit configuration is load-bearing: "2x16GB" (two sticks) is a DIFFERENT
  product from "1x32GB" (one stick), even at the same 32GB total.
- SODIMM / "laptop" / "notebook" memory is a different form factor from desktop
  DIMM/UDIMM — note which the page shows.
- ECC / Registered / RDIMM / "server" memory is not desktop memory.
- The MPN is the identity anchor (e.g. F4-3600C18D-32GVK, KF432C16BBK2/32,
  CMK32GX5M2B6000C30) — read it exactly if visible.
- "Compatible with Dell/HP/Lenovo" usually means an OEM module, not a retail kit.`;
