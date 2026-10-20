import { useEffect, useRef } from "react";
import type { Candidate, ConstraintCheck, MatchResult, Role } from "@/lib/domain/types";
import { explainMatch } from "@/lib/matching/explanations";
import { constraintLabel } from "./role-editor";

export const statusLabel = { eligible: "Eligible", blocked: "Blocked", needs_clarification: "Needs clarification" };
export const checkLabel = { pass: "Passed", fail: "Failed", unknown: "Unknown" };
export function percent(value: number | null): string { return value === null ? "—" : `${Math.round(value)}%`; }

export function EvidenceQuote({ evidence, role, candidate }: { evidence: ConstraintCheck["evidence"][number]; role: Role; candidate: Candidate }) {
  const source = [...role.sources, ...candidate.sources].find((item) => item.id === evidence.sourceId);
  if (!source || source.text.slice(evidence.start, evidence.end) !== evidence.quote) return <p className="field-error">Source span unavailable; no quote displayed.</p>;
  const start = Math.max(0, evidence.start - 55);
  const end = Math.min(source.text.length, evidence.end + 55);
  return <blockquote className="evidence"><span className="source-label">{source.kind === "job_description" ? "Role source" : "Candidate source"} · {source.id} · {evidence.start}–{evidence.end}</span><p>{start > 0 ? "…" : ""}{source.text.slice(start, evidence.start)}<mark>{source.text.slice(evidence.start, evidence.end)}</mark>{source.text.slice(evidence.end, end)}{end < source.text.length ? "…" : ""}</p></blockquote>;
}

export function CandidateDetail({ role, candidate, match, baseline, changedIds, onClose }: { role: Role; candidate: Candidate; match: MatchResult; baseline: MatchResult; changedIds: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal(); close.current?.focus();
    return () => { element?.close(); opener?.focus(); };
  }, []);
  const explanation = explainMatch(match);
  const removed = baseline.checks.filter((check) => !match.checks.some((next) => next.constraintId === check.constraintId));
  return <dialog className="candidate-dialog" ref={dialog} aria-labelledby="detail-heading" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary, [tabindex="0"]') ?? [])];
    const first = elements[0]; const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="dialog-header"><div><p className="eyebrow">Mutual fit · evidence trail</p><h2 id="detail-heading">{candidate.displayName}</h2><span className={`badge ${match.eligibility}`}>{statusLabel[match.eligibility]}</span></div><button ref={close} className="small-button" onClick={onClose}>Close details</button></div>
    <p>{explanation.summary}</p><div className="detail-metrics"><p>{explanation.preferenceLabel}<strong>{percent(match.preferenceScore)}</strong></p><p>{explanation.coverageLabel}<strong>{percent(match.evidenceCoverage)}</strong></p></div>
    {(["employer", "candidate"] as const).map((direction) => <section key={direction} className="detail-section"><h3>{direction === "employer" ? "Employer requirements" : "Candidate preferences"}</h3>{explanation.checks.filter((check) => check.direction === direction).map((check) => {
      const constraint = direction === "employer" ? role.constraints.find((c) => c.id === check.constraintId) : candidate.preferences.find((c) => c.id === check.constraintId);
      return <article key={check.constraintId} className={`check-item ${check.status}`}><div className="check-title"><h4>{constraint ? constraintLabel(constraint) : check.constraintId}</h4><span className={`badge ${check.status}`}>{checkLabel[check.status]}</span></div><p className="tiny">{check.importance} · {check.direction}{changedIds.includes(check.constraintId) ? " · Changed in scenario" : ""}</p><p>{check.text}</p>{check.clarificationQuestion && check.status === "unknown" && <p className="question"><strong>Clarify:</strong> {check.clarificationQuestion}</p>}{constraint?.requirement.origin === "manual" && <p className="manual-label">Manual requirement · no source quote for this value</p>}{check.evidence.map((evidence, index) => <EvidenceQuote key={`${evidence.sourceId}:${evidence.start}:${index}`} evidence={evidence} role={role} candidate={candidate} />)}</article>;
    })}{!explanation.checks.some((check) => check.direction === direction) && <p className="muted">No enabled checks in this direction.</p>}</section>)}
    {removed.length > 0 && <section className="detail-section"><h3>Removed in this scenario</h3>{removed.map((check) => <p key={check.constraintId}>{check.constraintId} · Baseline {checkLabel[check.status].toLowerCase()} · disabled</p>)}</section>}
    <p className="fine-print">{explanation.disclaimer}</p><button className="primary-button" onClick={onClose}>Return to shortlist</button>
  </dialog>;
}
