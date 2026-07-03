#!/usr/bin/env node
/**
 * /analyze gate (Phase 4, before declaring implement done).
 *
 * Enforces the separation law (Constitution Law 7 / acceptance E6) structurally:
 *   1. No file under src/engine/ may import from src/chassis/ (the directory
 *      boundary IS the enforcement).
 *   2. No domain TOKEN may appear in engine non-comment code (the engine speaks
 *      only Spec/Candidate/VerifiedResult/ProofShot).
 *
 * Comments and *.test.ts are exempt: illustrative examples ("DDR4 @ 8000MHz")
 * are documentation, not domain logic. Exits non-zero on any violation.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ENGINE_DIR = "src/engine";
const DOMAIN_TOKENS = [
  /\bSKU\b/,
  /\bDDR4\b/,
  /\bDDR5\b/,
  /\bumart\b/i,
  /\bpriceAud\b/,
  /\bcapacityGb\b/,
  /\bdataRateMtps\b/,
  /\bRamCandidate\b/,
  /\bRamSpec\b/,
  /\bcasLatency\b/,
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** Strip // line comments and block comments so only real code remains. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const violations = [];
for (const file of walk(ENGINE_DIR)) {
  const raw = readFileSync(file, "utf8");
  const code = stripComments(raw);

  // 1. E6 — no engine→chassis import.
  for (const m of code.matchAll(/import[\s\S]*?from\s*["']([^"']+)["']/g)) {
    if (m[1].includes("chassis")) {
      violations.push(`${file}: engine imports from chassis → '${m[1]}' (E6 / Law 7)`);
    }
  }

  // 2. Domain-token leak in engine code.
  code.split("\n").forEach((line, i) => {
    for (const token of DOMAIN_TOKENS) {
      if (token.test(line)) {
        violations.push(`${file}:${i + 1}: domain token leaked into engine → ${line.trim()}`);
      }
    }
  });
}

// 3. Plan 006 §2 — the examiner is scaffolding AROUND the harness. src/exam
//    may import the harness; the harness may never import src/exam. The one
//    exemption is the composition root (src/ui/start.ts), which wires worlds.
const HARNESS_DIRS = ["src/engine", "src/chassis", "src/providers", "src/ui"];
const EXAM_EXEMPT = new Set(["src/ui/start.ts", "src\\ui\\start.ts"]);
for (const dir of HARNESS_DIRS) {
  for (const file of walk(dir)) {
    if (EXAM_EXEMPT.has(file)) continue;
    const code = stripComments(readFileSync(file, "utf8"));
    for (const m of code.matchAll(/import[\s\S]*?from\s*["']([^"']+)["']/g)) {
      if (/\/exam\//.test(m[1]) || m[1].endsWith("/exam")) {
        violations.push(`${file}: harness imports from exam → '${m[1]}' (Plan 006 §2 — only start.ts may)`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("✗ /analyze: separation law violated:\n" + violations.map((v) => "  - " + v).join("\n"));
  process.exit(1);
}
console.log("✓ /analyze: engine is domain-free; no engine→chassis import (E6); harness never imports exam (Plan 006 §2).");
