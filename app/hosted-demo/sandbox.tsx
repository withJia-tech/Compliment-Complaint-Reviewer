"use client";

import { useState } from "react";
import type { ApprovedBusinessFacts, Draft, Review, TriageResult } from "@/lib/types";
import { validateReply } from "@/lib/validation/reply";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";

type Row = { review: Review; triage: TriageResult; draft: Draft };
type Outcome = { status: "approved" | "no_response"; text: string; decidedAt: string };
const dateLabel = (date: string) => new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const priorityLabel = (row: Row) => row.triage.sensitive ? "Sensitive concern" : row.triage.riskLevel === "high" ? "Needs attention" : row.triage.riskLevel === "medium" ? "Check the concern" : "Ready to review";
const recommendation = (row: Row) => row.triage.sensitive
  ? "Check the facts and review personally before deciding on a response."
  : row.triage.riskLevel === "high" ? "Review the concern and check the proposed response."
  : row.triage.riskLevel === "medium" ? "Acknowledge the concern while preserving the positive feedback."
  : "Check the thank-you draft, or close the review if no response is needed.";

export function HostedDemo({ rows, facts }: { rows: Row[]; facts: ApprovedBusinessFacts }) {
  const [selected, setSelected] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [reset, setReset] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);
  const [notice, setNotice] = useState("");
  const active = rows.filter(item => !outcomes[item.review.id]);
  const completed = rows.filter(item => outcomes[item.review.id]);
  const visible = showCompleted ? completed : active;
  const row = visible.find(item => item.review.id === selected) ?? visible[0];
  function record(status: Outcome["status"], text: string) {
    if (!row) return;
    const id = row.review.id;
    setOutcomes(current => ({ ...current, [id]: { status, text, decidedAt: new Date().toISOString() } }));
    setNotice(`${row.review.author}: ${status === "approved" ? "response approved" : "no response required"}. Moved to Completed.`);
    setSelected(active.find(item => item.review.id !== id)?.review.id ?? "");
  }
  return <main className="review-desk">
    <header className="desk-header">
      <div><p className="desk-eyebrow">REVIEW DESK</p><h1>{facts.businessName}</h1><p className="desk-intro">The reviews that need your judgment. Check the facts, then decide.</p></div>
      <div className="desk-demo"><span>Demo · sample reviews · nothing is sent</span><button className="btn-link" onClick={() => { setOutcomes({}); setShowCompleted(false); setNotice(""); setSelected(""); setReset(n => n + 1); }}>Start over</button></div>
    </header>
    {notice && <p role="status" className="desk-notice">{notice}</p>}
    <div className="hosted-grid">
      <section className="desk-queue" aria-label="Review queue">
        <div className="desk-queue-head"><h2>{showCompleted ? "Completed reviews" : "Needs your review"}</h2><p className="page-sub">Past 6 months · priority first, newest next</p>
          <div className="desk-tabs"><button aria-pressed={!showCompleted} onClick={() => setShowCompleted(false)}>Active <span>{active.length}</span></button><button aria-pressed={showCompleted} onClick={() => setShowCompleted(true)}>Completed <span>{completed.length}</span></button></div>
        </div>
        <div className="desk-review-list">
          {visible.length === 0 && <p className="desk-empty">{showCompleted ? "No completed decisions yet." : "All caught up. Your decisions are in Completed."}</p>}
          {visible.map(item => <button className={`hosted-review ${row?.review.id === item.review.id ? 'selected' : ''}`} key={item.review.id} onClick={() => setSelected(item.review.id)} aria-pressed={row?.review.id === item.review.id}>
            <span className="desk-card-top"><strong>{item.review.author}</strong><span>{item.review.stars}/5 ★</span></span>
            <span className={`desk-priority priority-${item.triage.sensitive ? 'sensitive' : item.triage.riskLevel}`}>{outcomes[item.review.id] ? outcomes[item.review.id].status === 'approved' ? 'Response approved' : 'No response required' : priorityLabel(item)}</span>
            <span className="desk-excerpt">{item.review.text}</span><time dateTime={item.review.createTime}>{dateLabel(item.review.createTime)}</time>
          </button>)}
        </div>
      </section>
      {row ? <section className="desk-workspace" aria-label="Review workspace">
        <div className="desk-workspace-head"><div><p className="desk-eyebrow">{outcomes[row.review.id] ? "COMPLETED DECISION" : "YOUR NEXT REVIEW"}</p><h2>{row.review.author}’s review</h2></div><span className="page-sub">{row.review.stars}/5 ★ · {dateLabel(row.review.createTime)}</span></div>
        <blockquote>{row.review.text}</blockquote>
        {!outcomes[row.review.id] && <section className="desk-recommendation"><span className={`desk-priority priority-${row.triage.sensitive ? 'sensitive' : row.triage.riskLevel}`}>{priorityLabel(row)}</span><h3>Recommended next step</h3><p>{recommendation(row)}</p><details><summary>Why this recommendation?</summary><p>{REASON_CODE_EXPLANATIONS[row.triage.reasonCodes[0]]}</p><p>A customer’s account is not a verified finding about cause or employee conduct.</p></details></section>}
        <details className="desk-facts"><summary>Check approved business facts</summary><ul>{row.draft.factsUsed.map(key => <li key={key}>{facts.facts.find(fact => fact.key === key)?.value}</li>)}</ul>{row.draft.factsUsed.length === 0 && <p>No business facts are used in this draft.</p>}</details>
        <Editor key={`${row.review.id}-${reset}`} row={row} outcome={outcomes[row.review.id]} onRecord={record} />
      </section> : <section className="desk-workspace desk-empty"><h2>{showCompleted ? "Your decisions will appear here" : "Nothing waiting on you"}</h2><p>{showCompleted ? "Complete a review to keep its decision here for this session." : "Each reviewed item stays available in Completed."}</p></section>}
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
    <label htmlFor="hosted-reply">Suggested response</label><p className="page-sub">Edit the wording to match what you can support.</p>
    <textarea id="hosted-reply" rows={5} maxLength={4000} value={text} onChange={e => { setText(e.target.value); setConfirmed(false); setIssues([]); }} />
    <label className="hosted-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have completed discovery and checked the available facts. Any reply contains no unsupported promises or private staff information.</label>
    {issues.length > 0 && <div role="alert" className="desk-error"><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <div className="desk-actions"><div><button onClick={() => decide('approved')}>Approve response</button><p>Accept this reply and close the review.</p></div><div><button className="btn-secondary" onClick={() => decide('no_response')}>No response required</button><p>Close after discovery, without a reply.</p></div></div>
    <p className="desk-session-note">Demo decisions last until you refresh or start over.</p>
  </section>;
}
