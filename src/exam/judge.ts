/**
 * The Judge (Spec 006, Plan Step 4) — a pure function. No model, ever.
 *
 * Returns exactly three things: a scalar score, category hints, pass/fail
 * (C4: category-grade feedback, never item-grade). Grading is deterministic
 * (C2). Loss is asymmetric (C3): showing an irrelevant item costs more than
 * showing a ghost, which costs more than missing a real one — the harness's
 * "no ghost inventory" values expressed as a loss function.
 *
 * The hint strings are the ONLY vocabulary that ever reaches the Student:
 * plain outcome language, no examiner jargon (C1).
 */
import { readFileSync } from "node:fs";

export interface KeyTruth {
  readonly url: string;
  readonly title: string;
  readonly priceAud: number;
}

export interface KeyTrap {
  readonly url: string;
  /** Examiner-side taxonomy — never shown to the Student. */
  readonly category:
    | "ghost-listing"
    | "wrong-sku-sodimm"
    | "wrong-sku-kit"
    | "variant-twin"
    | "category-page"
    | "dead-link"
    | "bot-wall"
    | "oem-opaque"
    | "irrelevant-item"
    | "parse-trap";
}

export interface ExamKey {
  readonly id: string;
  readonly request: string;
  readonly truths: KeyTruth[];
  readonly traps: KeyTrap[];
}

export interface AnswerKey {
  readonly certifiedBy: string; // C7 — an uncertified key refuses to grade
  readonly certifiedAt: string;
  readonly passMark: number; // e.g. 0.9
  readonly weights: {
    readonly missedTruth: number; // per missed real item
    readonly ghostShown: number; // shown but not purchasable
    readonly wrongShown: number; // shown but not the asked-for thing
    readonly irrelevantShown: number; // shown but not a product at all — worst
    readonly unknownShown: number; // shown but not in the key — unverifiable
  };
  readonly exams: ExamKey[];
}

export interface Submission {
  readonly examId: string;
  /** URLs the student presents as its answer. */
  readonly shown: string[];
}

export interface Verdict {
  readonly score: number; // 0..1
  readonly categories: string[]; // plain-outcome hints, deterministic order
  readonly pass: boolean;
}

// The only words the Student ever hears from the Judge (C1/C4).
const HINTS = {
  coverage: "much of what exists is missing from your answer",
  availability: "something you show cannot actually be purchased right now",
  identity: "something you show is not what was asked for",
  relevance: "something you show is not a product for sale",
} as const;

const norm = (u: string) => u.replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();

/** Trap category → (weight class, hint). Unknown URLs are graded as
 * unverifiable: in a frozen world the key is the whole truth — a shown item
 * the key can't vouch for cannot be crowned truth (student discoveries beyond
 * the key are exam-2+ territory, not v1). */
function classify(cat: KeyTrap["category"]): { weight: keyof AnswerKey["weights"]; hint: keyof typeof HINTS } {
  switch (cat) {
    case "ghost-listing":
      return { weight: "ghostShown", hint: "availability" };
    case "dead-link":
      return { weight: "ghostShown", hint: "availability" };
    case "wrong-sku-sodimm":
    case "wrong-sku-kit":
    case "variant-twin":
      return { weight: "wrongShown", hint: "identity" };
    case "irrelevant-item":
      return { weight: "irrelevantShown", hint: "relevance" };
    case "category-page":
    case "bot-wall":
    case "oem-opaque":
    case "parse-trap":
      return { weight: "unknownShown", hint: "relevance" };
  }
}

export function judge(submission: Submission, key: AnswerKey): Verdict {
  const exam = key.exams.find((e) => e.id === submission.examId);
  if (!exam) throw new Error(`no exam '${submission.examId}' in key`);

  const shown = new Set(submission.shown.map(norm));
  const truthUrls = new Set(exam.truths.map((t) => norm(t.url)));
  const trapByUrl = new Map(exam.traps.map((t) => [norm(t.url), t.category]));

  const found = [...truthUrls].filter((u) => shown.has(u)).length;
  const missed = truthUrls.size - found;

  let penalty = missed * key.weights.missedTruth;
  const hints = new Set<keyof typeof HINTS>();
  if (missed > 0) hints.add("coverage");

  for (const u of shown) {
    if (truthUrls.has(u)) continue;
    const cat = trapByUrl.get(u);
    if (cat !== undefined) {
      const { weight, hint } = classify(cat);
      penalty += key.weights[weight];
      hints.add(hint);
    } else {
      penalty += key.weights.unknownShown;
      hints.add("relevance");
    }
  }

  // Normalise: a perfect board = 1; every truth missed = 1 - missedTruth·|truths|/scale.
  const scale = Math.max(1, truthUrls.size) * key.weights.missedTruth + 1;
  const score = Math.max(0, Math.min(1, 1 - penalty / scale));
  const categories = (Object.keys(HINTS) as (keyof typeof HINTS)[])
    .filter((h) => hints.has(h))
    .map((h) => HINTS[h]);

  return { score: Number(score.toFixed(4)), categories, pass: score >= key.passMark };
}

/** C7 — keys are certified or they do not grade. */
export function loadKey(path: string): AnswerKey {
  const key = JSON.parse(readFileSync(path, "utf8")) as AnswerKey;
  if (!key.certifiedBy || key.certifiedBy.trim() === "") {
    throw new Error(`answer key at ${path} is not certified — a human must audit it first (Spec 006 C7)`);
  }
  return key;
}
