/**
 * The wrapper server (Task 9) — composition + projection boundary. It WIRES
 * providers + the RAM chassis into the engine (the only place that's allowed),
 * runs the loop on request, and projects the result. It makes no verification or
 * ranking decision itself — those live in the engine/chassis (Law 4).
 *
 * v2: streams verified results as SSE events so cards appear as they land.
 * Sources: StaticICE (11 AU retailers) + Google (all .com.au).
 * Availability: universal "Add to Cart?" visual check — no per-site classifier.
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { runLoop } from "../engine/loop/index.js";
import { EphemeralSandbox } from "../engine/verify/index.js";
import { RunRegistry } from "../engine/run/index.js";
import { LoopBudgetExceededError, SpecInvalidError } from "../engine/errors/index.js";
import { fromStructured, fromConversation } from "../engine/converge/index.js";
import type { Candidate, ISourceProvider, Spec, VerifiedResult } from "../types/index.js";
import { createRamChassis, parseRamSpec, RAM_CONV_CONTEXT, type RamSpecFields } from "../chassis/ram/index.js";
import { matchesConstraints } from "../chassis/ram/policy.js";
import type { RamCandidateData } from "../chassis/ram/types.js";
import {
  UMART_RENDER_SELECTORS,
  interpretUmartFields,
  umartProofCaption,
} from "../chassis/ram/sources/umart.js";
import { StaticIceSource } from "../chassis/ram/sources/staticice.js";
import { GoogleSource } from "../chassis/ram/sources/google.js";
import { WebSearchSource } from "../chassis/ram/sources/websearch.js";
import { CatalogSource } from "../chassis/ram/sources/catalog.js";
import { contradictsSpec } from "../chassis/ram/verify.js";
import {
  skuIdentityOf,
  identityMatches,
  identityInBody as identityInBodyChassis,
  pseudoSpecFromTitle,
  type SkuIdentity,
} from "../chassis/ram/identity.js";
import { fetchText } from "../providers/net.js";
import { PlaywrightValidator } from "../providers/validation/playwright.js";
import { AnthropicLLMProvider } from "../providers/llm/anthropic.js";
import { ClaudeCLIProvider } from "../providers/llm/claude-cli.js";
import { renderPage } from "./page.js";
import { toViewModel } from "./view.js";

export interface HarnessServerOptions {
  readonly maxCandidates?: number;
  readonly maxIterations?: number;
  readonly wallClockMs?: number;
}

export function createHarnessServer(opts: HarnessServerOptions = {}): Server {
  const staticiceSource = new StaticIceSource({ maxCandidates: opts.maxCandidates ?? 20 });
  const validator = new PlaywrightValidator();
  const googleSource = new GoogleSource(validator);
  const webSearchSource = new WebSearchSource(validator); // browser fallback when engines bot-wall HTTP
  const catalogSource = new CatalogSource(validator); // retailers' own category pages — best recall

  // Dispatch Tier-2 reads to the source that observed the candidate
  const sourceMap = new Map<string, ISourceProvider<RamCandidateData>>([
    [staticiceSource.name, staticiceSource],
    [googleSource.name, googleSource],
    [webSearchSource.name, webSearchSource],
    [catalogSource.name, catalogSource],
  ]);

  const llm = process.env.ANTHROPIC_API_KEY
    ? new AnthropicLLMProvider(process.env.ANTHROPIC_API_KEY)
    : new ClaudeCLIProvider();
  console.log(`[harness] llm provider: ${llm.name}`);
  const runs = new RunRegistry();

  const chassis = createRamChassis({
    sources: [catalogSource, webSearchSource, staticiceSource, googleSource],
    readLive: async (c) => {
      const src = sourceMap.get(c.source) ?? staticiceSource;
      const live = await src.read(c) as import("../chassis/ram/types.js").RamLiveState;
      console.log(`[tier2] "${c.data.title}" — ${live.availability} @ $${live.priceAud} (${c.data.retailer ?? c.source})`);
      return live;
    },
    captureProof: (c, env) =>
      env.sandbox.run(async () => {
        console.log(`[tier3] rendering: ${c.data.url}`);
        const { proof, fields } = await validator.capture({
          url: c.data.url,
          mustShow: c.data.title,
          extract: UMART_RENDER_SELECTORS,
        });
        // interpretUmartFields handles: microdata (Umart/MSY) > universal _outOfStock/_visiblePrice > optimistic
        const live = interpretUmartFields(fields, c);
        console.log(`[tier3] "${c.data.title}" — ${live.availability} @ $${live.priceAud} (live from render)`);
        return { proof: { ...proof, shows: umartProofCaption(c.data.title, live) }, live };
      }),
  });

  // SKU identity ladder + pseudo-spec gate now live in the chassis (Law 7 —
  // domain meaning belongs there, not in the projection layer). identityInBody
  // takes the fetch it should use, so the chassis stays testable.
  const identityInBody = (id: SkuIdentity, url: string) => identityInBodyChassis(id, url, fetchText);

  /** Per-SKU candidate gathering for the price hunt: StaticICE (price engine) +
   * DDG/Bing part-number search + Google title search, in parallel, deduped. */
  async function gatherSkuCandidates(
    title: string,
    log: (msg: string) => void,
  ): Promise<Candidate<RamCandidateData>[]> {
    const [ice, webUrls, googleUrls] = await Promise.all([
      staticiceSource.searchForTitle(title).catch((e: unknown) => { log(`[sku] StaticICE error: ${e}`); return []; }),
      webSearchSource.searchForTitle(title).catch((e: unknown) => { log(`[sku] WebSearch error: ${e}`); return [] as string[]; }),
      googleSource.searchForTitle(title).catch((e: unknown) => { log(`[sku] Google error: ${e}`); return [] as string[]; }),
    ]);
    log(`[sku] staticice=${ice.length} websearch=${webUrls.length} google=${googleUrls.length}`);
    const seen = new Set<string>(ice.map((c) => c.key));
    const urlCandidates: Candidate<RamCandidateData>[] = [...webUrls.map((u) => ["websearch", u] as const), ...googleUrls.map((u) => ["google", u] as const)]
      .filter(([, u]) => !seen.has(u) && seen.add(u))
      .map(([source, u]) => ({
        key: u, source,
        data: { productId: u, title, url: u, attributes: {} as import("../chassis/ram/types.js").RamAttributes, priceAud: NaN, retailer: new URL(u).hostname.replace(/^www\./, "") },
        relevance: 1,
      }));
    return [...ice, ...urlCandidates];
  }

  // Runs in a Playwright page — returns [priceString] or [] so browse() string[] typing works
  const PRICE_EXTRACT_JS = `(() => {
    const md = document.querySelector('[itemprop="price"]');
    if (md) { const p = md.getAttribute('content') || md.textContent || ''; const m = p.match(/[\\d,]+\\.?\\d*/); if (m) return [m[0].replace(/,/g,'')]; }
    for (const s of ['.price','#price','[data-price]','[class*="price--"]','.product-price','.special-price','.woocommerce-Price-amount']) {
      const el = document.querySelector(s); if (!el) continue;
      const t = el.getAttribute('data-price') || el.textContent || '';
      const m = t.match(/\\$[\\d,]+\\.?\\d*/); if (m) return [m[0].replace(/[$,]/g,'')];
    }
    return [];
  })()`;

  // Shared Phase 1+2 pipeline: parallel HTTP reads → sort → sequential Playwright proofs.
  // budgetAud: filters out-of-budget items and sorts by price.
  // sortByPrice: forces price sort even without a budget (used by deepsearch so crown lands on cheapest).
  async function streamCandidates(
    candidates: Candidate<import("../chassis/ram/types.js").RamCandidateData>[],
    emit: (ev: object) => void,
    log: (msg: string) => void,
    specFields?: RamSpecFields, // undefined = deepsearch (user picked the exact SKU by title)
    budgetAud?: number,
    sortByPrice = false,
    identity?: { part?: string; tokens: string[] }, // per-SKU hunt: page must prove it's the same product
  ): Promise<void> {
    if (candidates.length === 0) {
      emit({ type: "done", order: [], exhausted: true, hasBudget: false, note: "No candidates found." });
      return;
    }
    const fmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
    type ScanHit = {
      c: Candidate<import("../chassis/ram/types.js").RamCandidateData>;
      priceAud: number;
      retailer: string;
      title: string; // live page title when the read produced one (beats SERP/slug titles)
    };
    const inStock: ScanHit[] = [];
    let identityDiscards = 0;
    await Promise.all(candidates.map(async (c) => {
      try {
        const src = sourceMap.get(c.source) ?? staticiceSource;
        const live = await src.read(c) as import("../chassis/ram/types.js").RamLiveState;
        if (live.availability === "out_of_stock") { log(`[scan] skip out-of-stock: ${c.data.retailer ?? c.key}`); return; }
        // Re-check the SKU on the attributes the live read filled in — slugs/SERP
        // titles lie, page titles don't. A contradiction is a hard drop; a page
        // that can't even confirm generation/capacity (OEM part-number titles,
        // bare-module shops) is noise, not a candidate — fail closed.
        if (specFields) {
          const why = contradictsSpec(live.attributes, specFields);
          if (why) { log(`[scan] skip (wrong SKU: ${why}): ${c.key}`); return; }
          if (live.attributes.generation === undefined) {
            log(`[scan] skip (unconfirmable SKU — page never says what it is): ${c.key}`);
            return;
          }
        }
        // Per-SKU identity ladder: title → page body. The price board is binary
        // — but unprovable finds go to a separate "couldn't confirm" section
        // (graceful UX fallback), never competing for the crown.
        if (identity) {
          let tier: string | null = identityMatches(identity, live.title ?? c.data.title);
          if (!tier && (await identityInBody(identity, c.data.url))) tier = "body";
          if (!tier) {
            identityDiscards++;
            const uncPrice = Number.isFinite(live.priceAud) ? live.priceAud : c.data.priceAud;
            if (identityDiscards <= 10 && Number.isFinite(uncPrice) && live.availability === "in_stock") {
              emit({
                type: "unconfirmed", key: c.key, url: c.data.url,
                title: live.title || c.data.title,
                retailer: c.data.retailer ?? new URL(c.data.url).hostname.replace(/^www\./, ""),
                priceLabel: fmt.format(uncPrice), priceAud: uncPrice,
              });
            }
            log(`[scan] unconfirmed (shown in fallback section): ${c.key}`);
            return;
          }
        }
        const priceAud = Number.isFinite(live.priceAud) ? live.priceAud : Number.isFinite(c.data.priceAud) ? c.data.priceAud : NaN;
        if (!Number.isFinite(priceAud)) { log(`[scan] skip (no price): ${c.key}`); return; }
        if (budgetAud && priceAud > budgetAud) { log(`[scan] skip over-budget: ${fmt.format(priceAud)} > ${fmt.format(budgetAud)}`); return; }
        const retailer = c.data.retailer ?? new URL(c.data.url).hostname.replace(/^www\./, "");
        // Prefer the page's own <title> over SERP/slug-derived candidate titles.
        inStock.push({ c, priceAud, retailer, title: live.title || c.data.title });
        log(`[scan] in-stock: ${retailer} @ ${fmt.format(priceAud)}`);
      } catch (e) {
        // 403 retailers block plain HTTP — fall back to Playwright price extraction
        if (String(e).includes("403")) {
          try {
            const result = await validator.browse(c.data.url, PRICE_EXTRACT_JS);
            const priceAud = result.length ? parseFloat(result[0]!) : NaN;
            if (Number.isFinite(priceAud) && priceAud > 0) {
              if (budgetAud && priceAud > budgetAud) { log(`[scan] skip over-budget (browser): ${fmt.format(priceAud)}`); return; }
              const retailer = c.data.retailer ?? new URL(c.data.url).hostname.replace(/^www\./, "");
              inStock.push({ c, priceAud, retailer, title: c.data.title });
              log(`[scan] in-stock (browser fallback): ${retailer} @ ${fmt.format(priceAud)}`);
              return;
            }
          } catch {}
        }
        log(`[scan] ✗ read: ${c.key}: ${e}`);
      }
    }));
    if (budgetAud || sortByPrice) {
      inStock.sort((a, b) => a.priceAud - b.priceAud);
    } else {
      inStock.sort((a, b) => a.retailer.localeCompare(b.retailer));
    }
    if (identityDiscards > 0) log(`[scan] ${identityDiscards} listing(s) could not be confirmed as this product — shown in the fallback section`);
    log(`[scan] ${inStock.length} in-stock — verifying on render (proof shots)…`);
    const MAX_PROOFS = 50;
    const PROOF_CONCURRENCY = 3;
    const queue = inStock.slice(0, MAX_PROOFS);
    // Cards stream in proof-completion order, but the FINAL order (and the
    // crown) must follow the sort above — keep it; orderedKeys is emit order.
    const sortedKeys = queue.map((h) => h.c.key);
    const orderedKeys: string[] = [];

    // The render IS the verification: availability + price are read off the same
    // DOM the screenshot shows. A render that says sold-out/notify-me kills the
    // card no matter what the HTTP read claimed — no ghost listings.
    async function proofOne({ c, priceAud, retailer, title }: ScanHit): Promise<void> {
      log(`[scan] verifying on render: ${retailer}…`);
      let proofUrl = "";
      let renderConfirmed = false;
      try {
        const capture = await validator.capture({ url: c.data.url, mustShow: title ?? retailer, extract: {} });
        const oos = capture.fields["_outOfStock"] === "true";
        const addToCart = capture.fields["_addToCart"] === "true";
        if (oos && !addToCart) { log(`[scan] drop (render shows sold out / notify me): ${retailer}`); return; }
        renderConfirmed = addToCart;
        const png = await readFile(capture.proof.artifactRef).catch(() => Buffer.from(""));
        proofUrl = `data:image/png;base64,${png.toString("base64")}`;
      } catch (e) { log(`[scan] proof failed (${retailer}): ${e}`); }
      orderedKeys.push(c.key);
      emit({
        type: "result", key: c.key, url: c.data.url,
        title: title ?? c.data.url, retailer,
        priceLabel: fmt.format(priceAud), priceAud,
        availability: "in_stock",
        honestLabel: renderConfirmed ? "In stock — verified on page" : "In stock (listing read)",
        flagged: !renderConfirmed,
        proofUrl,
        confidencePct: renderConfirmed ? 92 : 70,
      });
    }
    // Small worker pool — cards stream in completion order.
    const workers = Array.from({ length: Math.min(PROOF_CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) await proofOne(queue.shift()!);
    });
    await Promise.all(workers);
    const emitted = new Set(orderedKeys);
    const finalOrder = sortedKeys.filter((k) => emitted.has(k));
    const exhausted = finalOrder.length === 0;
    emit({ type: "done", order: finalOrder, exhausted, hasBudget: !!budgetAud, note: exhausted ? "No new in-stock results found." : `${finalOrder.length} result(s) found.` });
  }

  return createServer((req, res) => void handle(req, res).catch((e) => fail(res, 500, String(e))));

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderPage());
      return;
    }
    if (req.method === "GET" && req.url === "/favicon.ico") {
      res.writeHead(200, { "content-type": "image/svg+xml" });
      res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0b0f14"/><text x="16" y="23" text-anchor="middle" font-size="20">🔍</text></svg>');
      return;
    }

    // Fast scan: observe → Tier-2 HTTP read → stream cards. No Playwright proof shots.
    if (req.method === "POST" && req.url === "/api/scan") {
      const body = JSON.parse(await readBody(req)) as { door?: string; fields?: unknown; turns?: unknown[]; exclude?: string[]; title?: string };
      const excludeSet = new Set(body.exclude ?? []);
      const isFindMore = excludeSet.size > 0;
      const reqKey = (req.headers["x-anthropic-api-key"] as string | undefined)?.trim();
      const reqLlm = reqKey ? new AnthropicLLMProvider(reqKey) : llm;

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "x-accel-buffering": "no",
      });
      const emit = (ev: object) => res.write("data: " + JSON.stringify(ev) + "\n\n");
      const log = (msg: string) => { console.log(msg); emit({ type: "status", message: msg }); };

      // Deepsearch: focused SKU hunt — full tool belt by part number/title.
      // The clicked title becomes the identity gate: candidates that can't
      // prove they're the same class of product never reach the board.
      if (body.door === "deepsearch") {
        const title = body.title ?? "";
        const pseudo = pseudoSpecFromTitle(title);
        const identity = skuIdentityOf(title);
        log(`[scan] deepsearch: "${title}" (identity: part=${identity.part ?? "none"} tokens=[${identity.tokens.join(",")}])`);
        const candidates = (await gatherSkuCandidates(title, log)).filter((c) => !excludeSet.has(c.key));
        log(`[scan] ${candidates.length} deepsearch candidates`);
        await streamCandidates(candidates, emit, log, pseudo, undefined, true, identity);
        res.end(); return;
      }

      let spec: Spec<RamSpecFields>;
      try {
        if (body.door === "conversational") {
          const turns = Array.isArray(body.turns)
            ? (body.turns as { role: "user" | "assistant"; content: string }[])
            : [{ role: "user" as const, content: "" }];
          const conv = await fromConversation(turns, reqLlm, parseRamSpec, RAM_CONV_CONTEXT);
          if (conv.kind === "clarify") { emit({ type: "clarify", question: conv.question }); res.end(); return; }
          spec = conv.spec;
        } else {
          spec = fromStructured(body.fields, parseRamSpec);
        }
        log(`[scan] spec: ${JSON.stringify(spec.fields)}${isFindMore ? ` (find-more, ${excludeSet.size} excluded)` : ""}`);
      } catch (e) {
        if (e instanceof SpecInvalidError) { emit({ type: "error", message: e.message, issues: e.issues }); res.end(); return; }
        throw e;
      }

      log(`[scan] observing sources in parallel…`);
      // For "find more" also fetch Google page 2 to surface new results
      const observePromises: Promise<Candidate<import("../chassis/ram/types.js").RamCandidateData>[]>[] = [
        catalogSource.observe(spec as Spec<unknown>).catch((e: unknown) => { log(`[scan] Catalog error: ${e}`); return []; }),
        webSearchSource.observe(spec as Spec<unknown>).catch((e: unknown) => { log(`[scan] WebSearch error: ${e}`); return []; }),
        staticiceSource.observe(spec as Spec<unknown>).catch((e: unknown) => { log(`[scan] StaticICE error: ${e}`); return []; }),
        googleSource.observe(spec as Spec<unknown>).catch((e: unknown) => { log(`[scan] Google error: ${e}`); return []; }),
      ];
      if (isFindMore) {
        observePromises.push(
          googleSource.observeMore(spec as Spec<unknown>).catch((e: unknown) => { log(`[scan] Google page-2 error: ${e}`); return []; })
        );
      }
      const allBatches = await Promise.all(observePromises);

      const seen = new Set<string>();
      const retailerCount = new Map<string, number>();
      const candidates = allBatches.flat()
        .filter((c) => {
          if (seen.has(c.key) || excludeSet.has(c.key)) return false;
          seen.add(c.key);
          // Cap per retailer — catalog pages legitimately carry ~8 matching kits
          // per store; the cap only guards against one store flooding the board.
          const host = new URL(c.data.url).hostname.replace(/^www\./, "");
          const n = retailerCount.get(host) ?? 0;
          if (n >= 8) return false;
          retailerCount.set(host, n + 1);
          return true;
        })
        .filter((c) => matchesConstraints(c.data, spec.fields))
        .slice(0, 60) as Candidate<import("../chassis/ram/types.js").RamCandidateData>[];

      log(`[scan] ${candidates.length} unique new candidates (${retailerCount.size} retailers)`);
      await streamCandidates(candidates, emit, log, spec.fields, spec.fields.budgetAud);
      res.end();
      return;
    }

    // Deep per-SKU best-price: Phase 1 parallel HTTP reads (find in-stock) →
    // Phase 2 sequential Playwright proof shots (stream each card as screenshot done).
    if (req.method === "POST" && req.url === "/api/bestprice") {
      const body = JSON.parse(await readBody(req)) as { title: string };
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "x-accel-buffering": "no",
      });
      const emit = (ev: object) => res.write("data: " + JSON.stringify(ev) + "\n\n");
      const log = (msg: string) => { console.log(msg); emit({ type: "status", message: msg }); };

      log(`[bestprice] full-belt SKU hunt for: "${body.title}"`);
      const pseudo = pseudoSpecFromTitle(body.title);
      const identity = skuIdentityOf(body.title);
      log(`[bestprice] identity: part=${identity.part ?? "none"} tokens=[${identity.tokens.join(",")}]${pseudo ? ` attrs=${pseudo.generation} ${pseudo.capacityGb}GB` : ""}`);
      const skuCandidates = await gatherSkuCandidates(body.title, log);
      log(`[bestprice] ${skuCandidates.length} candidate listing(s) — checking stock…`);

      const fmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

      // Phase 1: parallel HTTP reads — in-stock AND identity-proven only
      type StockHit = { url: string; hostname: string; priceAud: number };
      const inStock: StockHit[] = [];
      await Promise.all(skuCandidates.slice(0, 40).map(async (c) => {
        const url = c.data.url;
        try {
          const hostname = c.data.retailer ?? new URL(url).hostname.replace(/^www\./, "");
          const src = sourceMap.get(c.source) ?? googleSource;
          const live = await src.read(c) as import("../chassis/ram/types.js").RamLiveState;
          // Identity gates — a massager is in stock too; it is not this SKU.
          if (pseudo) {
            const why = contradictsSpec(live.attributes, pseudo);
            if (why) { log(`[bestprice] skip (wrong product: ${why}): ${hostname}`); return; }
            if (live.attributes.generation === undefined) {
              log(`[bestprice] skip (page never says what it is): ${hostname} ${url}`);
              return;
            }
          }
          // Identity ladder: title → page body. Binary board; unprovable finds
          // stream to the "couldn't confirm" fallback section instead.
          let tier: string | null = identityMatches(identity, live.title ?? c.data.title);
          if (!tier && (await identityInBody(identity, url))) tier = "body";
          if (!tier) {
            const uncPrice = Number.isFinite(live.priceAud) ? live.priceAud : c.data.priceAud;
            if (Number.isFinite(uncPrice) && live.availability === "in_stock") {
              emit({
                type: "unconfirmed", key: url, url,
                title: live.title || c.data.title, retailer: hostname,
                priceLabel: fmt.format(uncPrice), priceAud: uncPrice,
              });
            }
            log(`[bestprice] unconfirmed (shown in fallback section): ${hostname}`);
            return;
          }
          const priceAud = Number.isFinite(live.priceAud) ? live.priceAud : c.data.priceAud;
          if (live.availability !== "in_stock" || !Number.isFinite(priceAud)) {
            log(`[bestprice] skip (${live.availability}): ${hostname}`);
            return;
          }
          inStock.push({ url, hostname, priceAud });
          log(`[bestprice] in-stock: ${hostname} @ ${fmt.format(priceAud)}`);
        } catch (e) {
          log(`[bestprice] ✗ read: ${url}: ${e}`);
        }
      }));

      // Every survivor IS this product — cheapest first, crown lands on [0].
      inStock.sort((a, b) => a.priceAud - b.priceAud);
      log(`[bestprice] ${inStock.length} in-stock retailer(s) — taking proof shots cheapest-first…`);

      // Phase 2: Playwright proof shots cheapest-first — the render is the
      // verification (same no-ghost rule as the scan): a sold-out/notify-me
      // render kills the card no matter what the HTTP read said.
      const MAX_PROOFS = 12;
      const orderedKeys: string[] = [];
      for (const { url, hostname, priceAud } of inStock.slice(0, MAX_PROOFS)) {
        log(`[bestprice] verifying on render: ${hostname}…`);
        let proofUrl = "";
        let renderConfirmed = false;
        try {
          const capture = await validator.capture({ url, mustShow: body.title, extract: {} });
          const oos = capture.fields["_outOfStock"] === "true";
          const addToCart = capture.fields["_addToCart"] === "true";
          if (oos && !addToCart) { log(`[bestprice] drop (render shows sold out / notify me): ${hostname}`); continue; }
          renderConfirmed = addToCart;
          const png = await readFile(capture.proof.artifactRef).catch(() => Buffer.from(""));
          proofUrl = `data:image/png;base64,${png.toString("base64")}`;
        } catch (e) {
          log(`[bestprice] proof failed (${hostname}): ${e}`);
        }
        orderedKeys.push(url);
        emit({
          type: "bestprice", key: url, url, retailer: hostname,
          priceLabel: fmt.format(priceAud), priceAud,
          availability: "in_stock",
          honestLabel: renderConfirmed ? "In stock — verified on page" : "In stock (listing read)",
          proofUrl,
        });
      }

      emit({ type: "done", order: orderedKeys });
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/api/find") {
      const body = JSON.parse(await readBody(req)) as { door?: string; fields?: unknown; text?: string; turns?: unknown[] };
      const lane = (req.headers["x-harness-lane"] as string) || "default";
      const run = runs.begin(lane);
      console.log(`[harness] request door=${body.door ?? "structured"} lane=${lane}`);

      const reqKey = (req.headers["x-anthropic-api-key"] as string | undefined)?.trim();
      const reqLlm = reqKey ? new AnthropicLLMProvider(reqKey) : llm;

      // SSE headers — stream results as they're verified
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "x-accel-buffering": "no", // disable nginx buffering if behind a proxy
      });

      function emit(event: object): void {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      let spec: Spec<RamSpecFields>;
      let convNote: string | undefined;
      try {
        if (body.door === "conversational") {
          const turns = Array.isArray(body.turns)
            ? (body.turns as { role: "user" | "assistant"; content: string }[])
            : [{ role: "user" as const, content: body.text ?? "" }];
          const conv = await fromConversation(turns, reqLlm, parseRamSpec, RAM_CONV_CONTEXT);
          if (conv.kind === "clarify") {
            console.log(`[harness] clarify: ${conv.question}`);
            emit({ type: "clarify", question: conv.question });
            res.end();
            return;
          }
          convNote = conv.note;
          if (convNote) console.log(`[harness] defaulted: ${convNote}`);
          spec = conv.spec;
        } else {
          spec = fromStructured(body.fields, parseRamSpec);
        }
        console.log(`[harness] spec converged:`, JSON.stringify(spec.fields));
      } catch (e) {
        if (e instanceof SpecInvalidError) {
          console.error(`[harness] spec invalid:`, e.message, e.issues ?? "");
          emit({ type: "error", message: e.message, issues: e.issues });
          res.end();
          return;
        }
        throw e;
      }

      // Collect ordered keys as results stream in (for final re-rank event)
      const streamedKeys: string[] = [];

      console.log(`[harness] loop start`);
      let out: Awaited<ReturnType<typeof runLoop<RamSpecFields, RamCandidateData>>>;
      try {
        out = await runLoop(spec, chassis, {
          maxIterations: opts.maxIterations ?? 2,
          wallClockMs: opts.wallClockMs ?? 300_000,
        }, {
          sandbox: new EphemeralSandbox(),
          log: console.log,
          onResult: async (result) => {
            try {
              runs.guardEmit(run, false); // superseded? stop streaming
            } catch {
              return; // run was superseded, silently drop
            }
            const r = result as VerifiedResult<RamCandidateData>;
            const png = await readFile(r.proof.artifactRef).catch(() => Buffer.from(""));
            const proofUrl = `data:image/png;base64,${png.toString("base64")}`;
            const vm = toViewModel([r], { stoppedBy: "streaming", bestOverall: r.confidence.overall }, () => proofUrl);
            streamedKeys.push(r.candidate.key);
            emit({ type: "result", ...vm.results[0] });
          },
        });
      } catch (e) {
        if (e instanceof LoopBudgetExceededError) {
          console.warn(`[harness] budget exceeded: ${e.detail.iterations} iterations / ${Math.round(e.detail.elapsedMs / 1000)}s`);
          emit({
            type: "done",
            stoppedBy: "budget-exceeded",
            iterations: e.detail.iterations,
            note: `Search timed out after ${Math.round(e.detail.elapsedMs / 1000)}s — some results may have been found above.`,
            order: streamedKeys,
          });
          res.end();
          return;
        }
        throw e;
      }

      console.log(`[harness] loop done iterations=${out.iterations} results=${out.results.length} stoppedBy=${out.stoppedBy}`);

      try {
        runs.guardEmit(run, true);
      } catch {
        console.warn(`[harness] run superseded`);
        res.end();
        return;
      }

      // Final ranked order (results may have streamed in cheapest-first from StaticICE;
      // Google results arrive after and may have different ordering)
      const rankedKeys = out.results.map((r) => r.candidate.key);
      const vm = toViewModel(out.results, { stoppedBy: out.stoppedBy, bestOverall: out.bestOverall }, () => "");

      emit({
        type: "done",
        stoppedBy: out.stoppedBy,
        iterations: out.iterations,
        note: vm.note,
        order: rankedKeys,
        ...(convNote ? { convNote } : {}),
      });
      res.end();
      return;
    }

    // AI recommendation: pick the single best value from a set of in-stock results.
    if (req.method === "POST" && req.url === "/api/recommend") {
      const body = JSON.parse(await readBody(req)) as { picks: { key: string; title: string; retailer: string; priceLabel: string; priceAud: number }[] };
      const reqKey = (req.headers["x-anthropic-api-key"] as string | undefined)?.trim();
      const reqLlm = reqKey ? new AnthropicLLMProvider(reqKey) : llm;
      const picks = body.picks ?? [];
      if (picks.length === 0) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ key: null, reason: "" })); return; }
      if (picks.length === 1) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ key: picks[0]!.key, reason: "Only in-stock result." })); return; }
      const list = picks.map((p, i) => `${i + 1}. ${p.title} | ${p.retailer} | ${p.priceLabel}`).join("\n");
      const prompt = `You are a RAM purchasing advisor. These in-stock results are sorted cheapest first. Pick the single best overall value considering price, brand reliability, and retailer reputation.\n\nResults:\n${list}\n\nRespond with valid JSON only (no markdown):\n{"index": <1-based number>, "reason": "<one concise sentence why>"}`;
      try {
        const raw = await reqLlm.complete(prompt);
        const parsed = JSON.parse(raw.trim().replace(/^```[a-z]*\s*/i, "").replace(/```$/, ""));
        const idx = Math.max(0, Math.min((Number(parsed.index) || 1) - 1, picks.length - 1));
        const pick = picks[idx]!;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ key: pick.key, reason: String(parsed.reason ?? "Best overall value.") }));
      } catch {
        const cheapest = [...picks].sort((a, b) => a.priceAud - b.priceAud)[0] ?? picks[0]!;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ key: cheapest.key, reason: "Best price available." }));
      }
      return;
    }

    fail(res, 404, "not found");
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
}
function fail(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}
