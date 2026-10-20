import { useEffect, useRef, useState } from "react";
import type { Role, Scenario } from "@/lib/domain/types";
import { extractionRequestSchema, extractionSuccessSchema, MAX_TEXT_LENGTH } from "@/lib/extraction/contracts";
import { confirmReview, createReview, editReview, revertReviewConstraint, type ExtractionReview } from "@/lib/extraction/review";
import { ConstraintEditor } from "./role-editor";

export function ExtractionWorkspace({ role, disabled, onConfirm }: { role: Role; disabled: boolean; onConfirm: (state: { role: Role; scenario: Scenario }) => void }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState<ExtractionReview | null>(null);
  const [title, setTitle] = useState("");
  const [titlePending, setTitlePending] = useState(false);
  const [pendingFields, setPendingFields] = useState<Record<string, boolean>>({});
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [constraintEpochs, setConstraintEpochs] = useState<Record<string, number>>({});
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);

  function invalidate(message: string) {
    generation.current++; controller.current?.abort(); controller.current = null;
    setPending(false); setReview(null); setPendingFields({}); setTitlePending(false); setNotice(message);
  }
  async function submit() {
    if (!extractionRequestSchema.safeParse({ text }).success) { setNotice("Enter a nonblank description of at most20,000 characters."); return; }
    invalidate("");
    const session = generation.current;
    const request = new AbortController(); controller.current = request;
    setPending(true); setNotice("Extracting a proposed role. Your current baseline is unchanged…");
    try {
      const response = await fetch("/api/extract-role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: request.signal });
      if (session !== generation.current) return;
      if (!response.ok) {
        setNotice(response.status === 503 ? "Extraction is not configured. Your text and current role are preserved; the fictional demo still works." : response.status === 504 ? "Extraction timed out. Your text and current role are preserved. Try again." : "Extraction failed. Your text and current role are preserved. Try again or continue with the sample.");
        return;
      }
      const success = extractionSuccessSchema.parse(await response.json());
      if (session !== generation.current) return;
      if (success.draftRole.sources.length !== 1 || success.draftRole.sources[0].text !== text) throw new Error("Draft does not match submitted source");
      const next = createReview(success, role, session);
      setReview(next); setTitle(next.draft.title); setTitlePending(false); setPendingFields({}); setEditorEpoch((value) => value + 1);
      setNotice("Draft ready for review. Matching and saved data still use your confirmed baseline.");
    } catch {
      if (session === generation.current) setNotice("Could not read a valid extraction. Your text and current role are preserved. Try again.");
    } finally { if (session === generation.current) { setPending(false); controller.current = null; } }
  }
  const unapplied = titlePending || Object.values(pendingFields).some(Boolean);
  function confirm() {
    if (!review || pending || unapplied || disabled) return;
    try {
      const next = confirmReview(role, review, generation.current);
      onConfirm(next); invalidate("Role confirmed. Matching now uses the new baseline; scenario changes were cleared.");
    } catch { setNotice("This draft cannot be confirmed. Review the title and requirements, or extract again against the current baseline."); }
  }
  return <section className="extraction-panel panel" aria-labelledby="extraction-heading">
    <div className="extraction-intro"><div><p className="eyebrow">Bring your own role</p><h2 id="extraction-heading">Extract, review, then confirm.</h2><p className="muted">Pasting stays here until you request extraction. Extracting sends the description to this app server and OpenAI. Review every proposed fact before it changes matching.</p></div><span className="badge">Optional · sample needs no key</span></div>
    <label className="paste-label" htmlFor="job-description">Job description</label><textarea id="job-description" rows={5} value={text} disabled={disabled} aria-describedby="description-count" onChange={(event) => { setText(event.target.value); invalidate(pending || review ? "Input changed. Extract again to review this version." : ""); }} placeholder="Paste a job description. Skills, salary, work policy, geography, and start date are supported." />
    <div className="extraction-actions"><p id="description-count" className={text.length > MAX_TEXT_LENGTH ? "field-error" : "tiny"}>{text.length.toLocaleString("en-US")} /20,000 characters · unconfirmed text and drafts are not saved</p><div><button className="primary-button" disabled={disabled || pending || !text.trim() || text.length > MAX_TEXT_LENGTH} onClick={submit}>Extract role</button>{pending && <button className="small-button" onClick={() => invalidate("Extraction cancelled. Your text and current role are preserved.")}>Cancel extraction</button>}</div></div>
    <p className="extraction-status" role="status" aria-label="Extraction status" aria-live="polite">{notice}</p>
    {review && <section className="review-panel" aria-labelledby="review-heading"><div className="review-header"><div><p className="eyebrow">Unconfirmed draft</p><h3 id="review-heading">Review proposed requirements</h3></div><button className="text-button" onClick={() => invalidate("Draft discarded. Your confirmed role and scenario are unchanged.")}>Discard draft</button></div>
      <div className="review-warnings"><strong>Review warnings</strong><ul>{review.original.warnings.map((warning, index) => <li key={`${warning.code}:${index}`}>{warning.message}{warning.constraintId ? ` (${warning.constraintId})` : ""}</li>)}</ul></div>
      {review.draft.constraints.length === 0 && <p className="field-error">This draft has no requirements. Confirming it cannot establish employer fit; define requirements before assessing candidates.</p>}
      <div className="title-review"><label>Draft role title<input value={title} onChange={(event) => { setTitle(event.target.value); setTitlePending(true); }} /></label><button className="small-button" onClick={() => { try { setReview(editReview(review, { kind: "title", value: title })); setTitlePending(false); setNotice("Draft title applied. Confirm role when all requirements are reviewed."); } catch { setNotice("Enter a nonblank title before confirming."); } }}>Apply title</button><p className="tiny">{review.titleManual ? "Manual title correction" : "Proposed title · verify against original source"}</p></div>
      <div className="review-grid">{review.draft.constraints.map((constraint) => <div className="review-requirement" key={constraint.id}><ConstraintEditor key={`${editorEpoch}:${constraint.id}:${constraintEpochs[constraint.id] ?? 0}`} constraint={constraint} edited={!!review.edits[constraint.id]?.valueManual || !!review.edits[constraint.id]?.importanceEdited || !!review.edits[constraint.id]?.enabledEdited} disabled={disabled || pending} onApply={(patch) => setReview(editReview(review, { kind: "constraint", patch }))} onDraftChange={(dirty) => setPendingFields((fields) => ({ ...fields, [constraint.id]: dirty }))} />
        <div className="review-source"><p className="tiny">{constraint.requirement.origin === "manual" ? "Manual value · no source evidence" : constraint.requirement.value === null ? "Unknown · clarify before relying on this requirement" : "Exact source evidence for value"}{review.edits[constraint.id]?.importanceEdited ? " · Importance edited by recruiter" : " · Importance needs recruiter review"}{review.edits[constraint.id]?.enabledEdited ? " · Enabled state edited by recruiter" : ""}</p>
          {constraint.requirement.evidence.map((evidence, index) => { const source = review.draft.sources.find((item) => item.id === evidence.sourceId)!; return <blockquote className="evidence" key={index}><span className="source-label">Role source · {evidence.start}–{evidence.end}</span><p>{source.text.slice(Math.max(0, evidence.start - 35), evidence.start)}<mark>{source.text.slice(evidence.start, evidence.end)}</mark>{source.text.slice(evidence.end, Math.min(source.text.length, evidence.end + 35))}</p></blockquote>; })}
          {review.edits[constraint.id] && <button className="text-button" onClick={() => { setReview(revertReviewConstraint(review, constraint.id)); setPendingFields((fields) => ({ ...fields, [constraint.id]: false })); setConstraintEpochs((epochs) => ({ ...epochs, [constraint.id]: (epochs[constraint.id] ?? 0) + 1 })); }}>Restore extracted requirement</button>}
        </div></div>)}</div>
      <details className="original-draft"><summary>Inspect original description and proposed facts</summary><pre>{review.original.draftRole.sources.map((source) => source.text).join("\n")}</pre><pre>{JSON.stringify(review.original.draftRole.constraints, null, 2)}</pre></details>
      <div className="confirm-bar"><div><strong>Ready to replace the baseline?</strong><p className="tiny">Confirmation creates revision {role.revision + 1}, clears scenario overrides, and saves the confirmed role locally. Quotes support values; importance is your editorial decision.</p>{unapplied && <p className="field-error">Apply or restore every pending field edit before confirmation.</p>}</div><button className="primary-button" disabled={disabled || pending || unapplied} onClick={confirm}>Confirm role</button></div>
    </section>}
  </section>;
}
