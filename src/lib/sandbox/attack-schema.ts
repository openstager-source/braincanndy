// Kept apart from attacks.ts so zod stays out of the client bundle.
import { z } from "zod";
import { MAX_FAKES, type AttackConfig } from "./attacks";
import { RESTAURANTS } from "./restaurants";

const restaurantId = z.string().regex(/^r\d{2}$/).refine((id) => RESTAURANTS.some((r) => r.id === id));

export const AttackSchema: z.ZodType<AttackConfig> = z.object({
  boost: z.number().int().min(0).max(MAX_FAKES),
  boostTarget: restaurantId,
  smear: z.number().int().min(0).max(MAX_FAKES),
  smearTarget: restaurantId,
  injection: z.boolean(),
  smart: z.boolean(),
});
