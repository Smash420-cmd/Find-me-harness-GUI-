/**
 * RAM spec schema + possibility rules (Task 7). The structured door cannot
 * express an invalid spec because this schema is the only path to a RamSpec; a
 * failing parse raises SpecInvalidError (Law 9). Canonical impossibility:
 * "DDR4 @ 8000 MHz" — DDR4 cannot reach that data rate, so it is rejected at the
 * door, never observed (R2).
 */
import { z } from "zod";
import type { Spec } from "../../types/index.js";
import { SpecInvalidError } from "../../engine/errors/index.js";
import type { RamSpecFields } from "./types.js";

/**
 * Feasible data-rate bands per generation (MT/s). Bands are generous enough to
 * cover real overclocked kits but reject cross-generation impossibilities.
 */
export const DATA_RATE_BANDS = {
  DDR4: { min: 1600, max: 5333 },
  DDR5: { min: 4000, max: 8400 },
} as const;

const Constraints = z
  .object({
    lowProfileOnly: z.boolean().optional(),
    excludeGreyImport: z.boolean().optional(),
    singleRankOnly: z.boolean().optional(),
    brandInclude: z.array(z.string().min(1)).optional(),
    brandExclude: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const RamSpecSchema = z
  .object({
    generation: z.enum(["DDR4", "DDR5"]),
    capacityGb: z.number().int().positive(),
    perStickGb: z.number().int().positive().optional(),
    kitCount: z.number().int().positive().optional(),
    dataRateMtps: z.number().int().positive(),
    casLatency: z.number().int().positive().optional(),
    budgetAud: z.number().positive().optional(),
    constraints: Constraints.optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    // 1. Generation/data-rate possibility (the "DDR4 @ 8000MHz" rejection).
    const band = DATA_RATE_BANDS[s.generation];
    if (s.dataRateMtps < band.min || s.dataRateMtps > band.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataRateMtps"],
        message: `${s.generation} cannot run at ${s.dataRateMtps} MT/s (feasible ${band.min}–${band.max}).`,
      });
    }
    // 2. Kit-config consistency: if all three are given they must agree.
    if (s.perStickGb !== undefined && s.kitCount !== undefined) {
      if (s.perStickGb * s.kitCount !== s.capacityGb) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["capacityGb"],
          message: `Kit config ${s.kitCount}×${s.perStickGb}GB = ${s.perStickGb * s.kitCount}GB ≠ ${s.capacityGb}GB total.`,
        });
      }
    }
  });

/** Parse unknown input into a RAM Spec, or throw SpecInvalidError (the door gate). */
export function parseRamSpec(input: unknown): Spec<RamSpecFields> {
  const result = RamSpecSchema.safeParse(input);
  if (!result.success) {
    throw new SpecInvalidError(
      "Invalid RAM request.",
      result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }
  return { fields: result.data };
}
