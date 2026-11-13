"use client";

import { useState } from "react";
import type { DemoRow as Row, DemoDataset, DemoOutcome as Outcome, DemoView } from "@/lib/demo/datasets";
import { rowsForView } from "@/lib/demo/queue";
import { validateReply } from "@/lib/validation/reply";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";

const priorityLabel = (row: Row) => row.historical ? "Historical case" : row.triage.sensitive ? "Sensitive concern" : row.triage.riskLevel === "high" ? "Needs attention" : row.triage.riskLevel === "medium" ? "Check the concern" : "Ready to review";
const recommendation = (row: Row) => row.triage.sensitive
  ? "Check the facts and review personally before deciding on a response."
  : row.triage.riskLevel === "high" ? "Review the concern and check the proposed response."
  : row.triage.riskLevel === "medium" ? "Acknowledge the concern while preserving the positive feedback."
  : "Check the thank-you draft, or close the review if no response is needed.";

export function HostedDemo({ datasets }: { datasets: DemoDataset[] }) {
  const [datasetId, setDatasetId] = useState("dataset2");
  const dataset = datasets.find(item => item.id === datasetId) ?? datasets[0];
  const { rows, facts } = dataset;
  const [selected, setSelected] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [reset, setReset] = useState(0);
  const [view, setView] = useState<DemoView>("active");
  const [notice, setNotice] = useState("");
  const active = rowsForView(rows, outcomes, "active");
  const completed = rowsForView(rows, outcomes, "completed");
  const historical = rowsForView(rows, outcomes, "historical");
  const visible = rowsForView(rows, outcomes, view);
  const row = visible.find(item => item.review.id === selected) ?? visible[0];
  function record(status: Outcome["status"], text: string) {
    if (!row || row.historical || outcomes[row.review.id]) return;
    const id = row.review.id;
    setOutcomes(current => ({ ...current, [id]: { status, text, decidedAt: new Date().toISOString() } }));
    setNotice(`${row.review.author}: ${status === "approved" ? "response approved" : "no response required"}. Moved to Completed.`);
    setSelected(active.find(item => item.review.id !== id)?.review.id ?? "");
  }
  return <main className="review-desk">
    <header className="desk-header">
      <div><p className="desk-eyebrow">REVIEW DESK</p><h1>{facts.businessName}</h1><p className="desk-intro">{dataset.kind === "screenshots" ? "Practice with real reviews · independent case study, not affiliated with this business." : "The reviews that need your judgment. Check the facts, then decide."}</p></div>
      <div className="desk-demo"><span>Demo · nothing is sent</span><button className="btn-link" onClick={() => { setOutcomes({}); setView("active"); setNotice(""); setSelected(""); setReset(n => n + 1); }}>Start over</button></div>
    </header>
    <div className="desk-dataset"><label htmlFor="dataset-select">Review dataset</label><select id="dataset-select" value={dataset.id} onChange={event => { setDatasetId(event.target.value); setView("active"); setSelected(""); setNotice(""); }}>{datasets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{dataset.kind === "screenshots" && <span>5 supplied cases · original replies included</span>}</div>
    {notice && <p role="status" className="desk-notice">{notice}</p>}
    <div className="hosted-grid">
      <section className="desk-queue" aria-label="Review queue">
        <div className="desk-queue-head"><h2>{view === "completed" ? "Completed reviews" : view === "historical" ? "Historical examples" : "Needs your review"}</h2><p className="page-sub">{view === "historical" ? "Outside the six-month queue · read only" : dataset.kind === "screenshots" ? "Within 6 months in screenshots · priority first" : "Past 6 months · priority first, newest next"}</p>
          <div className="desk-tabs"><button aria-pressed={view === "active"} onClick={() => setView("active")}>Active <span>{active.length}</span></button><button aria-pressed={view === "completed"} onClick={() => setView("completed")}>Completed <span>{completed.length}</span></button>{historical.length > 0 && <button aria-pressed={view === "historical"} onClick={() => setView("historical")}>Historical <span>{historical.length}</span></button>}</div>
        </div>
        <div className="desk-review-list">
          {visible.length === 0 && <p className="desk-empty">{view === "completed" ? "No completed decisions yet." : "All caught up. Your decisions are in Completed."}</p>}
          {visible.map(item => <button className={`hosted-review ${row?.review.id === item.review.id ? 'selected' : ''}`} key={item.review.id} onClick={() => setSelected(item.review.id)} aria-pressed={row?.review.id === item.review.id}>
            <span className="desk-card-top"><strong>{item.review.author}</strong><span>{item.review.stars}/5 ★</span></span>
            <span className={`desk-priority priority-${item.triage.sensitive ? 'sensitive' : item.triage.riskLevel}`}>{outcomes[item.review.id] ? outcomes[item.review.id].status === 'approved' ? 'Response approved' : 'No response required' : priorityLabel(item)}</span>
            <span className="desk-excerpt">{item.review.text}</span><span className="desk-date">{item.dateLabel}{item.source ? " · screenshot" : ""}</span>
          </button>)}
        </div>
      </section>
      {row ? <section className="desk-workspace" aria-label="Review workspace">
        <div className="desk-workspace-head"><div><p className="desk-eyebrow">{row.historical ? "HISTORICAL CASE" : outcomes[row.review.id] ? "COMPLETED DECISION" : "YOUR NEXT REVIEW"}</p><h2>{row.review.author}’s review</h2></div><span className="page-sub">{row.review.stars}/5 ★ · {row.dateLabel}</span></div>
        <blockquote className="desk-review-text" tabIndex={0} aria-label="Full customer review">{row.review.text}</blockquote>{row.source?.subratings && <p className="desk-subratings">Food {row.source.subratings.food}/5 · Service {row.source.subratings.service}/5 · Atmosphere {row.source.subratings.atmosphere}/5</p>}
        {!outcomes[row.review.id] && !row.historical && <section className="desk-recommendation"><span className={`desk-priority priority-${row.triage.sensitive ? 'sensitive' : row.triage.riskLevel}`}>{priorityLabel(row)}</span><h3>Recommended next step</h3><p>{row.triage.reasonCodes[0] === "sensitive_safety" ? "Check the reported safety hazard first, then review the service concern." : row.triage.reasonCodes[0] === "sensitive_compensation" ? "Clarify the missing items and check the order before deciding on recovery." : recommendation(row)}</p><details><summary>Why this recommendation?</summary><p>{REASON_CODE_EXPLANATIONS[row.triage.reasonCodes[0]]}</p><p>A customer’s account is not a verified finding about cause or employee conduct.</p></details></section>}
        {row.source && <details className="desk-facts"><summary>Discovery checks</summary><ul>{row.source.discoveryChecks.map(check => <li key={check}><em>{check}</em></li>)}</ul></details>}
        <details className="desk-facts"><summary>{row.source ? "Source and available evidence" : "Check approved business facts"}</summary>{row.source ? <><p>Customer review and owner reply transcribed from supplied Google Maps screenshots. Claims are attributed accounts, not verified findings.</p><p>Age shown: {row.dateLabel}. The capture date and exact review date are unavailable. Recent cases are a screenshot-based practice cohort, not a live intake.</p><p>No business-approved policies or contact channels have been supplied. The original reply is reference material only.</p></> : <><ul>{row.draft.factsUsed.map(key => <li key={key}>{facts.facts.find(fact => fact.key === key)?.value}</li>)}</ul>{row.draft.factsUsed.length === 0 && <p>No business facts are used in this draft.</p>}</>}</details>
        {row.source && <details className="desk-original-reply"><summary>Original owner reply · {row.source.ownerReply.dateLabel}</summary><blockquote>{row.source.ownerReply.text}</blockquote><p className="page-sub">Existing public reply shown for comparison. It does not establish that an investigation or improvement occurred.</p></details>}
        {row.historical ? <section className="desk-decision"><h3>Historical example</h3><p>This review stays outside the active six-month queue. No new decision is required.</p><details><summary>Alternative draft for discussion</summary><p>{row.draft.text}</p></details></section> : <Editor key={`${row.review.id}-${reset}`} row={row} outcome={outcomes[row.review.id]} onRecord={record} />}
      </section> : <section className="desk-workspace desk-empty"><h2>{view === "completed" ? "Your decisions will appear here" : "Nothing waiting on you"}</h2><p>{view === "completed" ? "Complete a review to keep its decision here for this session." : "Each reviewed item stays available in Completed."}</p></section>}
    </div>
  </main>;
}

function Editor({ row, outcome, onRecord }: { row: Row; outcome?: Outcome; onRecord: (status: Outcome['status'], text: string) => void }) {
  const [text, setText] = useState(row.draft.text);
  const [confirmed, setConfirmed] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  function decide(status: Outcome['status']) {
    if (outcome) return;
    const errors = !confirmed ? ['Complete your discovery check before deciding.'] : status === 'approved' ? validateReply(text) : [];
    setIssues(errors);
    if (!errors.length) onRecord(status, status === 'approved' ? text : 'Discovery completed. No public response is required.');
  }
  if (outcome) return <section className="desk-decision"><h3>{outcome.status === 'no_response' ? 'No response required' : 'Response approved'}</h3><p>{outcome.text}</p><p className="page-sub">Reviewed {new Date(outcome.decidedAt).toLocaleString()} · Nothing was sent.</p></section>;
  return <section className="desk-editor">
    <label htmlFor="hosted-reply">Suggested response</label><p className="page-sub">{row.source ? "Demo draft for practice. Edit only what you can support." : "Edit the wording to match what you can support."}</p>
    <textarea id="hosted-reply" rows={5} maxLength={4000} value={text} onChange={e => { setText(e.target.value); setConfirmed(false); setIssues([]); }} />
    <label className="hosted-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have completed discovery and checked the available facts. Any reply contains no unsupported promises or private staff information.</label>
    {issues.length > 0 && <div role="alert" className="desk-error"><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <div className="desk-actions"><div><button onClick={() => decide('approved')}>Approve response</button><p>Accept this reply and close the review.</p></div><div><button className="btn-secondary" onClick={() => decide('no_response')}>No response required</button><p>Close after discovery, without a reply.</p></div></div>
    <p className="desk-session-note">Demo decisions last until you refresh or start over.</p>
  </section>;
}
