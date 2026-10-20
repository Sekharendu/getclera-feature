import type { ProviderClaim, ProviderOutput } from "@/lib/extraction/contracts";

export function claim(overrides: Partial<ProviderClaim> = {}): ProviderClaim {
  return { kind: "skill", value: "typescript", quote: "Must have TypeScript skills.", start: null, end: null, importance: "mandatory", importanceExplicit: true, ...overrides } as ProviderClaim;
}
export function output(claims: ProviderClaim[] = [claim()]): ProviderOutput {
  return { title: { value: null, quote: null, start: null, end: null }, claims, unsupportedFields: [] };
}
export function completion(value: unknown = output()): Response {
  return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
}
