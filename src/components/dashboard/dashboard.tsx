"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ConstraintPatch, Eligibility, Role, Scenario } from "@/lib/domain/types";
import type { FixtureDataset } from "@/lib/domain/fixtures";
import { evaluateMatches } from "@/lib/matching/match";
import { compareScenarioDetails, createScenario, evaluateScenario, withOverride } from "@/lib/scenarios/scenarios";
import { evaluateSuggestions } from "@/lib/scenarios/suggestions";
import { clearState, loadState, saveState } from "@/lib/storage/persistence";
import { ConstraintEditor } from "./role-editor";
import { CandidateDetail, percent, statusLabel } from "./candidate-detail";
import { ExtractionWorkspace } from "./extraction-workspace";

const categories: Eligibility[] = ["eligible", "needs_clarification", "blocked"];

export default function Dashboard({ fixtures }: { fixtures: FixtureDataset }) {
  const [workspace, setWorkspace] = useState<{ role: Role; scenario: Scenario }>(() => ({ role: fixtures.role, scenario: createScenario(fixtures.role) }));
  const { role, scenario } = workspace;
  const [restored, setRestored] = useState(false);
  const [notice, setNotice] = useState("Restoring browser state…");
  const [filter, setFilter] = useState<Eligibility | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [extractionEpoch, setExtractionEpoch] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      const state = loadState(() => window.localStorage, fixtures.role);
      if (active) { setWorkspace({ role: state.role, scenario: state.scenario }); setNotice(state.notice); setRestored(true); setEditorEpoch((value) => value + 1); }
    });
    return () => { active = false; };
  }, [fixtures.role]);
  const baseline = useMemo(() => evaluateMatches(role, fixtures.candidates), [role, fixtures.candidates]);
  const evaluation = useMemo(() => evaluateScenario(role, fixtures.candidates, scenario), [role, fixtures.candidates, scenario]);
  const details = useMemo(() => compareScenarioDetails(baseline, evaluation.matches), [baseline, evaluation.matches]);
  const candidatesById = useMemo(() => new Map(fixtures.candidates.map((candidate) => [candidate.id, candidate])), [fixtures.candidates]);
  const suggestions = useMemo(() => evaluateSuggestions(role, fixtures.candidates, scenario, undefined, 2), [role, fixtures.candidates, scenario]);
  const visible = evaluation.matches.filter((match) => (filter === "all" || match.eligibility === filter) && `${candidatesById.get(match.candidateId)?.displayName} ${match.candidateId}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedMatch = evaluation.matches.find((match) => match.candidateId === selected);
  function updateScenario(next: Scenario) { setWorkspace({ role, scenario: next }); setNotice(saveState(() => window.localStorage, role, next).notice); }
  function apply(patch: ConstraintPatch) { updateScenario(withOverride(role, scenario, patch)); }
  function sample(clear: boolean) {
    const fresh = createScenario(fixtures.role);
    setWorkspace({ role: fixtures.role, scenario: fresh }); setSelected(null); setFilter("all"); setSearch(""); setEditorEpoch((value) => value + 1); setExtractionEpoch((value) => value + 1);
    setNotice(clear ? clearState(() => window.localStorage).notice : saveState(() => window.localStorage, fixtures.role, fresh).notice + " Fictional sample loaded.");
  }
  function reset() { updateScenario(createScenario(role)); setEditorEpoch((value) => value + 1); }
  function confirm(state: { role: Role; scenario: Scenario }) {
    setWorkspace(state); setSelected(null); setFilter("all"); setSearch(""); setEditorEpoch((value) => value + 1);
    setNotice(`Role confirmed at revision ${state.role.revision}. Scenario reset. ${saveState(() => window.localStorage, state.role, state.scenario).notice}`);
  }
  return <div className="app-shell">
    <header className="topbar"><Link className="wordmark" href="/" aria-label="Clera Match Explorer home"><span className="brand-symbol">c</span><span>clera<span className="brand-divider">/</span><span className="brand-product">Match Explorer</span></span></Link><span className="prototype-label"><span className="status-dot" />Independent prototype</span></header>
    <main id="main-content">
      <section className="page-heading"><div><p className="eyebrow">Recruiter workspace</p><h1>A clearer view of mutual fit.</h1><p className="muted">See what shapes your shortlist. Explore a change, follow the evidence.</p></div><div className="heading-actions"><button disabled={!restored} className="small-button" onClick={() => sample(false)}>Load fictional sample</button><button disabled={!restored} className="text-button" onClick={() => sample(true)}>Clear local data</button></div></section>
      <div className="demo-banner"><span className="demo-icon">i</span><p><strong>Fictional demonstration</strong> · 25 invented profiles. {role.sources.some((source) => source.id === "extracted-role-source") ? "Using your recruiter-confirmed role." : "A sample role is loaded. No AI key needed."} Not a hiring recommendation.</p></div>
      <p className="save-status" role="status" aria-label="Local save status" aria-live="polite">{notice}</p>
      <ExtractionWorkspace key={extractionEpoch} role={role} disabled={!restored} onConfirm={confirm} />
      <div className="workspace"><aside className="role-panel panel"><div className="panel-heading"><p className="eyebrow">01 / Define the match</p><h2>Role & scenario</h2><p className="muted role-title">{role.title}</p><span className="tiny">Confirmed baseline · revision {role.revision}</span><p className="tiny">Title and importance are recruiter-confirmed; quotes support values only.</p></div><div className="scenario-toolbar"><span>{evaluation.editedIds.length === 0 ? "Baseline unchanged" : `${evaluation.editedIds.length} edited requirements`}</span><button className="text-button" disabled={!restored} onClick={reset}>Reset scenario</button></div><p className="editor-help">Open a requirement to edit. Apply values to compare; your confirmed baseline stays intact.</p>{evaluation.role.constraints.map((constraint) => <ConstraintEditor key={`${editorEpoch}:${constraint.id}`} constraint={constraint} edited={evaluation.editedIds.includes(constraint.id)} disabled={!restored} onApply={apply} />)}<div className="sidebar-note"><strong>Two sides of the match</strong><p>Employer requirements and candidate preferences are evaluated independently. A change may resolve one blocker while another remains.</p></div></aside>
        <section className="results-column" aria-label="Candidate results"><div className="summary-grid">{categories.map((category) => {
          const count = evaluation.matches.filter((match) => match.eligibility === category).length;
          const baseCount = baseline.filter((match) => match.eligibility === category).length;
          return <button className={`summary-card ${category} ${filter === category ? "active" : ""}`} key={category} onClick={() => setFilter(filter === category ? "all" : category)} aria-pressed={filter === category}><span>{statusLabel[category]}</span><strong data-testid={`count-${category}`}>{count}<small>/ {fixtures.candidates.length}</small></strong><span className="tiny">Baseline {baseCount} <b>{count === baseCount ? "· no change" : `· ${count > baseCount ? "+" : ""}${count - baseCount}`}</b></span></button>;
        })}</div>
        <div className="results-toolbar"><div><p className="eyebrow">02 / Understand the evidence</p><h2>Your candidate pool <span className="count-pill">{visible.length}</span></h2></div><div className="filter-controls"><label className="sr-only" htmlFor="candidate-search">Search candidates</label><input id="candidate-search" type="search" placeholder="Search name or ID…" value={search} onChange={(event) => setSearch(event.target.value)} /><label className="sr-only" htmlFor="status-filter">Filter eligibility</label><select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value as Eligibility | "all")}><option value="all">All statuses</option>{categories.map((category) => <option key={category} value={category}>{statusLabel[category]}</option>)}</select></div></div>
        <p className="ranking-note">Sorted by eligibility, preferred fit, known-outcome coverage, then candidate ID. Scores are rule-based comparisons, not hiring probabilities.</p>
        {visible.length === 0 ? <div className="empty-state panel"><h3>No candidates match these filters.</h3><p>Try another name or show the full candidate pool.</p><button className="small-button" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button></div> : <div className="candidate-list">{visible.map((match) => {
          const candidate = candidatesById.get(match.candidateId)!;
          const old = baseline.find((result) => result.candidateId === candidate.id)!;
          const blockers = match.checks.filter((check) => check.importance === "mandatory" && check.status === "fail").length;
          const unknowns = match.checks.filter((check) => check.status === "unknown").length;
          return <article key={candidate.id} className="candidate-card" data-testid={candidate.id}><div className="candidate-top"><div className="candidate-identity"><span className="avatar">{candidate.displayName.replace("Demo ", "").slice(0, 2).toUpperCase()}</span><div><h3>{candidate.displayName}</h3><p className="tiny">{candidate.id} · Fictional profile</p></div></div><span className={`badge ${match.eligibility}`}>{statusLabel[match.eligibility]}</span></div><div className="candidate-stats"><div><span>Preferred fit</span><strong>{match.preferenceScore === null ? "No preferences scored" : percent(match.preferenceScore)}</strong></div><div><span>Known-outcome coverage</span><strong>{percent(match.evidenceCoverage)}</strong></div><div><span>Checks to explore</span><strong className="check-count">{blockers} blockers · {unknowns} unknowns</strong></div></div><div className="candidate-bottom"><p className="tiny">{old.eligibility !== match.eligibility ? `Baseline ${statusLabel[old.eligibility].toLowerCase()} → ${statusLabel[match.eligibility].toLowerCase()}` : details.comparison.changedChecks[candidate.id]?.length ? "Checks changed · eligibility unchanged" : "Same eligibility as baseline"}</p><button className="detail-button" disabled={!restored} onClick={() => setSelected(candidate.id)}>Explore {candidate.displayName}<span aria-hidden="true"> ↗</span></button></div></article>;
        })}</div>}
        <section className="suggestions panel"><p className="eyebrow">03 / Explore alternatives</p><h2>Optional trade-offs</h2><p className="muted">Each option is evaluated on this sample. These are independent alternatives, with no requirement to relax your criteria.</p>{suggestions.map((suggestion, index) => <div className="suggestion" key={`${suggestion.patch.constraintId}:${index}`}><div><p>{suggestion.tradeoff}</p><span className="tiny">Would yield {suggestion.counts.eligible} eligible · {suggestion.counts.needs_clarification} need clarification · {suggestion.counts.blocked} blocked</span></div><button className="small-button" disabled={!restored} onClick={() => { updateScenario(suggestion.scenario); setEditorEpoch((value) => value + 1); }}>Try this change</button></div>)}</section>
        </section>
      </div>
    </main>
    <footer>Independent portfolio project. Not affiliated with Clera. Fictional profiles only. Matching and scenarios run locally in your browser. Requesting extraction sends pasted text to the app server and configured OpenAI provider.</footer>
    {selectedMatch && <CandidateDetail key={selectedMatch.candidateId} role={evaluation.role} candidate={candidatesById.get(selectedMatch.candidateId)!} match={selectedMatch} baseline={baseline.find((match) => match.candidateId === selectedMatch.candidateId)!} changedIds={details.comparison.changedChecks[selectedMatch.candidateId] ?? []} onClose={() => setSelected(null)} />}
  </div>;
}
