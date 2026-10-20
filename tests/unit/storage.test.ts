import { describe, expect, it } from "vitest";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import { createScenario, withOverride } from "@/lib/scenarios/scenarios";
import { clearState, decodeState, encodeState, loadState, saveState, STORAGE_KEY, type StoragePort } from "@/lib/storage/persistence";

describe("versioned browser state", () => {
  const { role } = loadDemoFixtures();
  const scenario = withOverride(role, createScenario(role), { constraintId: "role-work-mode", kind: "work_mode", value: ["office", "remote"] });
  it("round-trips only role and scenario, recomputing results elsewhere", () => {
    const encoded = encodeState(role, scenario);
    expect(Object.keys(JSON.parse(encoded))).toEqual(["schemaVersion", "role", "scenario"]);
    expect(decodeState(encoded, role)).toMatchObject({ role, scenario, status: "restored" });
  });
  it.each([[null, "missing"], ["{", "malformed"], ["[]", "malformed"], ['{"schemaVersion":2}', "unsupported_version"], ['{"schemaVersion":1,"role":{}}', "invalid_role"]] as const)("recovers from %s with %s", (raw, status) => {
    const state = decodeState(raw, role);
    expect(state.status).toBe(status);
    expect(state.role).toEqual(role);
    expect(state.scenario.overrides).toEqual([]);
  });
  it("keeps valid saved role while resetting stale or invalid overrides", () => {
    const saved = { ...role, title: "Saved title", revision: 2 };
    const state = decodeState(JSON.stringify({ schemaVersion: 1, role: saved, scenario }), role);
    expect(state.status).toBe("stale_scenario");
    expect(state.role).toEqual(saved);
    expect(state.scenario).toEqual(createScenario(saved));
    expect(decodeState(JSON.stringify({ schemaVersion: 1, role, scenario: { ...scenario, overrides: [{ kind: "skill", constraintId: "missing", value: "typescript" }] } }), role).status).toBe("invalid_scenario");
  });
  it("handles denied storage access, reads, writes and clearing", () => {
    const denied = () => { throw Error("denied"); };
    const broken: StoragePort = { getItem: denied, setItem: denied, removeItem: denied };
    expect(loadState(denied, role).status).toBe("unavailable");
    expect(loadState(() => broken, role).status).toBe("unavailable");
    expect(saveState(() => broken, role, scenario).ok).toBe(false);
    expect(clearState(() => broken).ok).toBe(false);
  });
  it("writes and clears only the documented key", () => {
    const map = new Map([["other", "keep"]]);
    const storage: StoragePort = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); }, removeItem: (key) => { map.delete(key); } };
    expect(saveState(() => storage, role, scenario).ok).toBe(true);
    expect(map.has(STORAGE_KEY)).toBe(true);
    expect(loadState(() => storage, role).scenario).toEqual(scenario);
    expect(clearState(() => storage).ok).toBe(true);
    expect(map.has(STORAGE_KEY)).toBe(false);
    expect(map.get("other")).toBe("keep");
  });
});
