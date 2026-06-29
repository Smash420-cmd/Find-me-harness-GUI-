/**
 * The wrapper server (Task 9) — composition + projection boundary. It WIRES
 * providers + the RAM chassis into the engine (the only place that's allowed),
 * runs the loop on request, and projects the result. It makes no verification or
 * ranking decision itself — those live in the engine/chassis (Law 4).
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { runLoop } from "../engine/loop/index.js";
import { EphemeralSandbox } from "../engine/verify/index.js";
import { RunRegistry } from "../engine/run/index.js";
import { SpecInvalidError } from "../engine/errors/index.js";
import { fromStructured, fromConversation } from "../engine/converge/index.js";
import type { Spec, VerifiedResult } from "../types/index.js";
import { createRamChassis, parseRamSpec, type RamSpecFields } from "../chassis/ram/index.js";
import type { RamCandidateData } from "../chassis/ram/types.js";
import { UmartSource } from "../chassis/ram/sources/umart.js";
import { PlaywrightValidator } from "../providers/validation/playwright.js";
import { HeuristicLLMProvider } from "../providers/llm/heuristic.js";
import { renderPage } from "./page.js";
import { toViewModel } from "./view.js";

export interface HarnessServerOptions {
  readonly maxCandidates?: number;
  readonly maxIterations?: number;
  readonly wallClockMs?: number;
}

export function createHarnessServer(opts: HarnessServerOptions = {}): Server {
  const source = new UmartSource({ maxCandidates: opts.maxCandidates ?? 4 });
  const validator = new PlaywrightValidator();
  const llm = new HeuristicLLMProvider();
  const runs = new RunRegistry();

  const chassis = createRamChassis({
    source,
    readLive: (c) => source.read(c),
    captureProof: (c, env) =>
      env.sandbox.run(() =>
        validator.capture({ url: c.data.url, mustShow: `${c.data.title} @ $${c.data.priceAud} in stock` }),
      ),
  });

  return createServer((req, res) => void handle(req, res).catch((e) => fail(res, 500, String(e))));

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderPage());
      return;
    }
    if (req.method === "POST" && req.url === "/api/find") {
      const body = JSON.parse(await readBody(req)) as { door?: string; fields?: unknown; text?: string };
      const lane = (req.headers["x-harness-lane"] as string) || "default";
      const run = runs.begin(lane);

      // Converge through the chosen door (the engine's two doors).
      let spec: Spec<RamSpecFields>;
      try {
        if (body.door === "conversational") {
          const turns = [{ role: "user" as const, content: body.text ?? "" }];
          const conv = await fromConversation(turns, llm, parseRamSpec);
          if (conv.kind === "clarify") return json(res, 200, { clarify: conv.question });
          spec = conv.spec;
        } else {
          spec = fromStructured(body.fields, parseRamSpec);
        }
      } catch (e) {
        if (e instanceof SpecInvalidError) return json(res, 400, { error: e.message, issues: e.issues });
        throw e;
      }

      // Run the engine. The wrapper only consumes the result.
      const out = await runLoop(spec, chassis, {
        maxIterations: opts.maxIterations ?? 2,
        wallClockMs: opts.wallClockMs ?? 180_000,
      }, { sandbox: new EphemeralSandbox() });

      // Superseded run? Its results must not render (E2).
      try {
        runs.guardEmit(run, true);
      } catch {
        return json(res, 409, { error: "superseded by a newer request" });
      }

      const vm = await projectWithProofs(out.results, out.stoppedBy, out.bestOverall);
      return json(res, 200, { ...vm, iterations: out.iterations });
    }
    fail(res, 404, "not found");
  }

  async function projectWithProofs(
    results: VerifiedResult<RamCandidateData>[],
    stoppedBy: string,
    bestOverall: number,
  ) {
    // Resolve each proof image to a data URL (IO done here, not in the pure view).
    const urls = new Map<string, string>();
    for (const r of results) {
      try {
        const png = await readFile(r.proof.artifactRef);
        urls.set(r.proof.artifactRef, `data:image/png;base64,${png.toString("base64")}`);
      } catch {
        urls.set(r.proof.artifactRef, "");
      }
    }
    return toViewModel(results, { stoppedBy, bestOverall }, (ref) => urls.get(ref) ?? "");
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
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
function fail(res: ServerResponse, status: number, message: string): void {
  json(res, status, { error: message });
}
