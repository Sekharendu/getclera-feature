import type { Role, Scenario } from "@/lib/domain/types";
import { roleSchema, scenarioSchema } from "@/lib/domain/schemas";
import { applyScenario, createScenario } from "@/lib/scenarios/scenarios";

export const STORAGE_KEY = "clera-match-explorer.state.v1";
export interface PersistedState { schemaVersion: 1; role: Role; scenario: Scenario }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type RestoreStatus = "missing" | "restored" | "malformed" | "unsupported_version" | "invalid_role" | "invalid_scenario" | "stale_scenario" | "unavailable";
export interface RestoredState { role: Role; scenario: Scenario; status: RestoreStatus; notice: string }

export function decodeState(raw: string | null, fallback: Role): RestoredState {
  const sample = (status: RestoreStatus, notice: string): RestoredState => ({ role: structuredClone(fallback), scenario: createScenario(fallback), status, notice });
  if (raw === null) return sample("missing", "Fictional sample ready. Changes are saved only in this browser.");
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return sample("malformed", "Saved data could not be read. Using the fictional sample."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return sample("malformed", "Saved data has an invalid format. Using the fictional sample.");
  const envelope = input as Record<string, unknown>;
  if (envelope.schemaVersion !== 1) return sample("unsupported_version", "Saved data uses an unsupported version. Using the fictional sample.");
  const parsed = roleSchema.safeParse(envelope.role);
  if (!parsed.success) return sample("invalid_role", "Saved role is invalid. Using the fictional sample.");
  const role = parsed.data;
  try {
    const identity = scenarioFrom(envelope.scenario);
    if (identity.roleId !== role.id || identity.baselineRevision !== role.revision) return { role, scenario: createScenario(role), status: "stale_scenario", notice: "Saved scenario is stale for this role revision. Your valid role was retained; scenario changes were reset." };
    applyScenario(role, envelope.scenario);
    // Parsing occurs in applyScenario; preserve only validated scenario fields.
    const scenario = scenarioFrom(envelope.scenario);
    return { role, scenario, status: "restored", notice: "Restored your role and scenario from this browser." };
  } catch {
    return { role, scenario: createScenario(role), status: "invalid_scenario", notice: "Saved scenario is invalid or stale. Your valid role was retained; scenario changes were reset." };
  }
}

function scenarioFrom(input: unknown): Scenario { return scenarioSchema.parse(input); }

export function encodeState(role: Role, scenario: Scenario): string {
  const parsed = roleSchema.parse(role);
  applyScenario(parsed, scenario);
  return JSON.stringify({ schemaVersion: 1, role: parsed, scenario: scenarioFrom(scenario) } satisfies PersistedState);
}

/** Acquire storage lazily inside try/catch: even the localStorage getter may throw. */
export function loadState(getStorage: () => StoragePort, fallback: Role): RestoredState {
  try { return decodeState(getStorage().getItem(STORAGE_KEY), fallback); }
  catch { return { role: structuredClone(fallback), scenario: createScenario(fallback), status: "unavailable", notice: "Browser storage is unavailable. The sample still works; changes will not survive reload." }; }
}

export function saveState(getStorage: () => StoragePort, role: Role, scenario: Scenario): { ok: boolean; notice: string } {
  try { getStorage().setItem(STORAGE_KEY, encodeState(role, scenario)); return { ok: true, notice: "Scenario saved in this browser." }; }
  catch { return { ok: false, notice: "Could not save locally. Your current scenario still works, but may be lost on reload." }; }
}

export function clearState(getStorage: () => StoragePort): { ok: boolean; notice: string } {
  try { getStorage().removeItem(STORAGE_KEY); return { ok: true, notice: "Local data cleared. Fictional sample restored; nothing is saved until your next change." }; }
  catch { return { ok: false, notice: "Could not clear browser storage. Sample restored for this session; saved data may return on reload." }; }
}
