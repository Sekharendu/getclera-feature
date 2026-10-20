import { z } from "zod";
import { roleSchema } from "@/lib/domain/schemas";

export const MAX_TEXT_LENGTH = 20_000;
export const MAX_REQUEST_BYTES = 128 * 1024;
export const extractionRequestSchema = z.strictObject({ text: z.string().max(MAX_TEXT_LENGTH).refine((text) => text.trim().length > 0, "Description must not be blank") });
export const extractionWarningSchema = z.strictObject({ code: z.string(), message: z.string(), constraintId: z.string().optional(), field: z.string().optional() });
export const extractionSuccessSchema = z.strictObject({ draftRole: roleSchema, warnings: z.array(extractionWarningSchema) });
export type ExtractionWarning = z.infer<typeof extractionWarningSchema>;
export type ExtractionSuccess = z.infer<typeof extractionSuccessSchema>;

const span = { quote: z.string().max(2000).nullable(), start: z.number().int().nonnegative().nullable(), end: z.number().int().nonnegative().nullable() };
const claim = { ...span, importance: z.enum(["mandatory", "preferred"]), importanceExplicit: z.boolean() };
const salary = z.strictObject({ min: z.number().nullable(), max: z.number().nullable(), currency: z.string().max(3).nullable(), basis: z.string().max(30).nullable(), minExplicitlyUnbounded: z.boolean(), maxExplicitlyUnbounded: z.boolean() });
/** All keys required; optional information is explicitly null for strict Structured Outputs. */
export const providerOutputSchema = z.strictObject({
  title: z.strictObject({ value: z.string().max(160).nullable(), ...span }),
  claims: z.array(z.discriminatedUnion("kind", [
    z.strictObject({ ...claim, kind: z.literal("skill"), value: z.string().max(80).nullable() }),
    z.strictObject({ ...claim, kind: z.literal("salary"), value: salary.nullable() }),
    z.strictObject({ ...claim, kind: z.literal("work_mode"), value: z.array(z.enum(["remote", "office", "hybrid"])).max(3).nullable() }),
    z.strictObject({ ...claim, kind: z.literal("location"), value: z.array(z.string().max(100)).max(20).nullable() }),
    z.strictObject({ ...claim, kind: z.literal("latest_start"), value: z.string().max(10).nullable() }),
  ])).max(30),
  unsupportedFields: z.array(z.string().max(120)).max(20),
});
export type ProviderOutput = z.infer<typeof providerOutputSchema>;
export type ProviderClaim = ProviderOutput["claims"][number];
/** Zod discriminated unions emit oneOf/const; disjoint kind enums permit supported anyOf. */
function structuredSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuredSchema);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$schema").map(([key, item]) => [key === "oneOf" ? "anyOf" : key === "const" ? "enum" : key, key === "const" ? [item] : structuredSchema(item)]));
  return value;
}
export const providerJsonSchema = structuredSchema(z.toJSONSchema(providerOutputSchema));

export class ExtractionError extends Error {
  constructor(public readonly code: "not_configured" | "timeout" | "cancelled" | "provider_error" | "invalid_output" | "refused", public readonly status: number) {
    super({ not_configured: "Role extraction is not configured. The fictional demo remains available.", timeout: "Extraction timed out. Please try again.", cancelled: "Extraction was cancelled.", provider_error: "Extraction provider is unavailable. Please try again later.", invalid_output: "The provider returned an invalid extraction. Please try again or enter requirements manually.", refused: "The provider could not extract this description. Please review the text." }[code]);
    this.name = "ExtractionError";
  }
}
