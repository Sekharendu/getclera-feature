import type { ProviderClaim, ProviderOutput } from "@/lib/extraction/contracts";

export function claim(overrides: Partial<ProviderClaim> = {}): ProviderClaim {
  return { kind: "skill", value: "typescript", quote: "Must have TypeScript skills.", start: null, end: null, importance: "mandatory", importanceExplicit: true, ...overrides } as ProviderClaim;
}
export function output(claims: ProviderClaim[] = [claim()]): ProviderOutput {
  return { title: { value: null, quote: null, start: null, end: null }, claims, unsupportedFields: [] };
}
export function completion(value: unknown = output()): Response {
  return Response.json({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: JSON.stringify(value) }] } }] });
}
