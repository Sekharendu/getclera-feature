import { useState } from "react";
import type { Constraint, ConstraintPatch, SalaryRange } from "@/lib/domain/types";
import { constraintPatchSchema } from "@/lib/domain/schemas";

export function constraintLabel(constraint: Constraint): string {
  switch (constraint.kind) {
    case "skill": return `Skill · ${constraint.requirement.value ?? "unspecified"}`;
    case "salary": return "Annual base salary";
    case "work_mode": return "Work mode";
    case "location": return "Geographic eligibility";
    case "latest_start": return "Latest start date";
  }
}

function RequirementFields({ constraint, value, onChange }: { constraint: Constraint; value: string; onChange: (value: string) => void }) {
  if (constraint.kind === "work_mode") {
    const modes = value.split(",").filter(Boolean);
    return <div className="choice-row">{["office", "remote", "hybrid"].map((mode) => <label key={mode}><input type="checkbox" checked={modes.includes(mode)} onChange={(event) => onChange((event.target.checked ? [...modes, mode] : modes.filter((m) => m !== mode)).join(","))} />{mode}</label>)}</div>;
  }
  return <label>{constraint.kind === "location" ? "Location IDs, comma separated" : constraint.kind === "latest_start" ? "Date (YYYY-MM-DD)" : "Canonical skill ID"}<input value={value} placeholder={constraint.kind === "latest_start" ? "2027-01-15" : undefined} onChange={(event) => onChange(event.target.value)} /></label>;
}

function initialValue(constraint: Constraint): string {
  const value = constraint.requirement.value;
  return Array.isArray(value) ? value.join(",") : typeof value === "string" ? value : "";
}

export function ConstraintEditor({ constraint, edited, disabled, onApply, onDraftChange }: { constraint: Constraint; edited: boolean; disabled: boolean; onApply: (patch: ConstraintPatch) => void; onDraftChange?: (pending: boolean) => void }) {
  const [value, setValue] = useState(initialValue(constraint));
  const salary = constraint.kind === "salary" ? constraint.requirement.value : null;
  const [min, setMin] = useState(salary?.min?.toString() ?? "");
  const [max, setMax] = useState(salary?.max?.toString() ?? "");
  const [currency, setCurrency] = useState(salary?.currency ?? "");
  const [openMin, setOpenMin] = useState(salary?.minExplicitlyUnbounded ?? false);
  const [openMax, setOpenMax] = useState(salary?.maxExplicitlyUnbounded ?? false);
  const [error, setError] = useState("");
  const label = constraintLabel(constraint);
  function applyValue() {
    let nextValue: unknown = value.trim();
    if (constraint.kind === "work_mode" || constraint.kind === "location") nextValue = value.split(",").map((v) => v.trim()).filter(Boolean);
    if (constraint.kind === "salary") nextValue = {
      min: openMin || min.trim() === "" ? null : Number(min), max: openMax || max.trim() === "" ? null : Number(max),
      minExplicitlyUnbounded: openMin, maxExplicitlyUnbounded: openMax, currency: currency.trim(), basis: "annual_base",
    } satisfies SalaryRange;
    const parsed = constraintPatchSchema.safeParse({ constraintId: constraint.id, kind: constraint.kind, value: nextValue });
    if (!parsed.success) { setError("Enter a valid requirement. Use canonical IDs, a real ISO date, or a salary range with minimum ≤ maximum and a three-letter currency."); return; }
    try { onApply(parsed.data); setError(""); onDraftChange?.(false); } catch (error) { setError(error instanceof Error ? error.message : "Requirement could not be applied."); }
  }
  return <details className="constraint-editor" data-testid={constraint.id}>
    <summary><span>{label}</span><span className="tiny">{edited ? "Edited" : constraint.importance === "mandatory" ? "Required" : "Preferred"}{!constraint.enabled ? " · Off" : ""}</span></summary>
    <fieldset disabled={disabled} aria-label={label}>
      <div className="editor-row"><label>Importance<select value={constraint.importance} onChange={(event) => { try { onApply({ constraintId: constraint.id, kind: constraint.kind, importance: event.target.value as "mandatory" | "preferred" }); setError(""); } catch { setError("Importance change could not be applied."); } }}><option value="mandatory">Mandatory</option><option value="preferred">Preferred</option></select></label><label className="check-label"><input type="checkbox" checked={constraint.enabled} onChange={(event) => { try { onApply({ constraintId: constraint.id, kind: constraint.kind, enabled: event.target.checked }); setError(""); } catch { setError("Cannot enable a requirement with zero weight."); } }} />Enabled</label></div>
      {constraint.kind === "salary" ? <><div className="editor-row"><label>Minimum<input inputMode="decimal" value={min} disabled={openMin} onChange={(e) => { setMin(e.target.value); onDraftChange?.(true); }} /></label><label>Maximum<input inputMode="decimal" value={max} disabled={openMax} onChange={(e) => { setMax(e.target.value); onDraftChange?.(true); }} /></label></div><div className="choice-row"><label><input type="checkbox" checked={openMin} onChange={(e) => { setOpenMin(e.target.checked); onDraftChange?.(true); }} />No lower bound</label><label><input type="checkbox" checked={openMax} onChange={(e) => { setOpenMax(e.target.checked); onDraftChange?.(true); }} />No upper bound</label></div><label>Currency<input value={currency} maxLength={3} onChange={(e) => { setCurrency(e.target.value); onDraftChange?.(true); }} /></label></> : <RequirementFields constraint={constraint} value={value} onChange={(next) => { setValue(next); onDraftChange?.(true); }} />}
      <button className="small-button" type="button" onClick={applyValue}>Apply requirement</button>
      {error && <p className="field-error" role="alert">{error}</p>}
      <p className="tiny">{constraint.requirement.origin === "manual" ? "Manual value · no source quote" : constraint.requirement.value === null ? "Unknown value · no source quote" : "Source quote supports value only"}</p>
    </fieldset>
  </details>;
}
