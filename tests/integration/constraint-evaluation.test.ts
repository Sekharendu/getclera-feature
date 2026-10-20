import { describe, expect, it } from "vitest";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import { constraintCheckSchema } from "@/lib/domain/schemas";
import type { Constraint, Fact, Role } from "@/lib/domain/types";
import { evaluateConstraint, evaluateConstraints } from "@/lib/matching/evaluate";

const manual = <T>(value: T | null): Fact<T> => ({ value, evidence: [], origin: "manual" });
const data = loadDemoFixtures();

describe("constraint evaluation on the fictional dataset", () => {
  it.each([
    [1, "role-skill-typescript", "pass"],
    [2, "role-work-mode", "fail"],
    [3, "role-salary", "fail"],
    [4, "role-skill-typescript", "unknown"],
    [5, "role-skill-react", "fail"],
    [6, "role-location", "fail"],
    [7, "role-latest-start", "fail"],
    [8, "role-salary", "unknown"],
    [9, "role-work-mode", "unknown"],
    [10, "role-location", "unknown"],
    [11, "role-latest-start", "unknown"],
    [12, "role-salary", "pass"],
    [13, "role-latest-start", "pass"],
    [14, "role-salary", "pass"],
    [15, "role-work-mode", "fail"],
    [15, "role-salary", "fail"],
    [16, "role-skill-typescript", "fail"],
    [16, "role-salary", "unknown"],
    [17, "role-skill-typescript", "unknown"],
    [18, "role-skill-react", "unknown"],
    [19, "role-work-mode", "fail"],
    [20, "role-salary", "pass"],
    [21, "role-salary", "unknown"],
    [22, "candidate-22-preference-remote", "fail"],
    [23, "role-skill-nodejs", "unknown"],
    [24, "role-skill-nodejs", "fail"],
    [25, "role-skill-react", "unknown"],
    [25, "role-location", "fail"],
  ] as const)("profile %s check %s is %s", (index, constraintId, status) => {
    const checks = evaluateConstraints(data.role, data.candidates[index - 1]);
    expect(checks.find((check) => check.constraintId === constraintId)?.status).toBe(status);
  });

  it("returns valid, deterministic checks in both directions with resolvable evidence", () => {
    const original = JSON.stringify(data);
    for (const candidate of data.candidates) {
      const checks = evaluateConstraints(data.role, candidate);
      expect(evaluateConstraints(data.role, candidate)).toEqual(checks);
      expect(checks.some((check) => check.direction === "employer")).toBe(true);
      expect(checks.some((check) => check.direction === "candidate")).toBe(true);
      expect(checks.map((check) => check.constraintId)).toEqual([...data.role.constraints, ...candidate.preferences].map((constraint) => constraint.id));
      const sources = [...data.role.sources, ...candidate.sources];
      for (const check of checks) {
        expect(constraintCheckSchema.safeParse(check).success).toBe(true);
        if (check.status === "unknown") expect(check.clarificationQuestion).toBeTruthy();
        for (const span of check.evidence) {
          expect(sources.find((source) => source.id === span.sourceId)?.text.slice(span.start, span.end)).toBe(span.quote);
        }
      }
    }
    expect(JSON.stringify(data)).toBe(original);
  });

  it("evaluates candidate salary, mode, and location preferences against the role", () => {
    for (const [index, suffix] of [[2, "work_mode"], [3, "salary"], [6, "location"]] as const) {
      const candidate = data.candidates[index - 1];
      const result = evaluateConstraints(data.role, candidate).find((check) => check.constraintId === `${candidate.id}-preference-${suffix}`);
      expect(result?.status).toBe("fail");
      expect(result?.direction).toBe("candidate");
      expect(result?.evidence.some((span) => span.sourceId === candidate.sources[0].id)).toBe(true);
      expect(result?.evidence.some((span) => span.sourceId === data.role.sources[0].id)).toBe(true);
    }
  });

  it("keeps a candidate preference independent of their broader accepted modes", () => {
    const candidate = data.candidates[21];
    const checks = evaluateConstraints(data.role, candidate);
    expect(checks.find((check) => check.constraintId === "role-work-mode")?.status).toBe("pass");
    expect(checks.find((check) => check.constraintId === "candidate-22-preference-remote")).toMatchObject({ status: "fail", importance: "preferred" });
  });

  it("skips disabled constraints without changing their baseline values", () => {
    const role = structuredClone(data.role);
    role.constraints[0].enabled = false;
    expect(evaluateConstraint(role.constraints[0], role, data.candidates[0])).toBeNull();
    expect(evaluateConstraints(role, data.candidates[0]).some((check) => check.constraintId === role.constraints[0].id)).toBe(false);
    expect(data.role.constraints[0].enabled).toBe(true);
  });

  it("keeps geography checks active when remote modes match", () => {
    const role = structuredClone(data.role);
    const work = role.constraints.find((constraint) => constraint.kind === "work_mode")!;
    if (work.kind === "work_mode") work.requirement = manual(["remote"]);
    const candidate = structuredClone(data.candidates[1]);
    candidate.acceptedLocations = manual(["ca-toronto"]);
    const checks = evaluateConstraints(role, candidate);
    expect(checks.find((check) => check.constraintId === "role-work-mode")?.status).toBe("pass");
    expect(checks.find((check) => check.constraintId === "role-location")?.status).toBe("fail");
    candidate.acceptedLocations = manual<string[]>(null);
    expect(evaluateConstraints(role, candidate).find((check) => check.constraintId === "role-location")?.status).toBe("unknown");
  });

  it("does not let office mode compatibility hide a location mismatch", () => {
    const checks = evaluateConstraints(data.role, data.candidates[5]);
    expect(checks.find((check) => check.constraintId === "role-work-mode")?.status).toBe("pass");
    expect(checks.find((check) => check.constraintId === "role-location")?.status).toBe("fail");
  });

  it("asks for clarification when the role has no single salary offering", () => {
    const candidate = data.candidates[0];
    const preference = candidate.preferences.find((constraint) => constraint.kind === "salary")!;
    const role: Role = { ...data.role, constraints: data.role.constraints.filter((constraint) => constraint.kind !== "salary") };
    expect(evaluateConstraint(preference, role, candidate)?.status).toBe("unknown");
    const offer = data.role.constraints.find((constraint) => constraint.kind === "salary")!;
    role.constraints.push(offer, { ...offer, id: "role-salary-alternative" });
    expect(evaluateConstraint(preference, role, candidate)?.reasonCode).toBe("role_offer_ambiguous");
  });

  it("checks candidate skill preferences using explicit role skill declarations", () => {
    const preference: Constraint = {
      id: "candidate-role-skill", direction: "candidate", importance: "preferred", weight: 1,
      enabled: true, kind: "skill", requirement: manual("ts"),
    };
    expect(evaluateConstraint(preference, data.role, data.candidates[0])?.status).toBe("pass");
    preference.requirement = manual("java");
    expect(evaluateConstraint(preference, data.role, data.candidates[0])?.status).toBe("unknown");
  });

  it("does not infer a role's actual start from its latest acceptable deadline", () => {
    const preference: Constraint = {
      id: "candidate-start-deadline", direction: "candidate", importance: "mandatory", weight: 1,
      enabled: true, kind: "latest_start", requirement: manual("2027-01-01"),
    };
    expect(evaluateConstraint(preference, data.role, data.candidates[0])).toMatchObject({
      status: "unknown", reasonCode: "role_start_date_unknown", evidence: [],
    });
  });

  it("deduplicates source-span references and returns independent evidence objects", () => {
    const role = structuredClone(data.role);
    const candidate = data.candidates[0];
    const constraint = role.constraints[0];
    constraint.requirement.evidence.push({ ...constraint.requirement.evidence[0] });
    const check = evaluateConstraint(constraint, role, candidate)!;
    const first = check.evidence[0];
    expect(check.evidence.filter((span) => span.sourceId === first.sourceId && span.start === first.start && span.end === first.end)).toHaveLength(1);
    first.quote = "edited result";
    expect(constraint.requirement.evidence[0].quote).not.toBe("edited result");
  });
});
