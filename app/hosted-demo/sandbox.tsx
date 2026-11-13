"use client";

import { useState } from "react";
import type { ApprovedBusinessFacts, Draft, Review, TriageResult } from "@/lib/types";
import { validateReply } from "@/lib/validation/reply";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";

type Row = { review: Review; triage: TriageResult; draft: Draft };
type Outcome = { status: "approved" | "unknown"; text: string };

export function HostedDemo({ rows, facts }: { rows: Row[]; facts: ApprovedBusinessFacts }) {
  const [selected, setSelected] = useState("rev_007");
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [events, setEvents] = useState<string[]>([]);
  const [reset, setReset] = useState(0);
  const row = rows.find(item => item.review.id === selected)!;
  function record(status: Outcome["status"], text: string) {
    setOutcomes(current => ({ ...current, [selected]: { status, text } }));
    setEvents(current => [`${row.review.author}: ${status === "approved" ? "simulated approval recorded" : "simulated delivery unknown; retry blocked"}`, ...current]);
  }
  return <main>
    <header className="demo-notice">
      <p className="page-sub">REVIEW DESK · CLIENT DEMONSTRATION</p>
      <h1>{facts.businessName}</h1>
      <p><strong>Fictional business. Sample reviews. Nothing is published.</strong></p>
      <p>Changes stay in this browser tab’s memory and disappear on refresh. Use sample text only.
        No Google connection, live AI model or production audit store is involved.</p>
      <button className="btn-secondary" onClick={() => { setOutcomes({}); setEvents([]); setReset(n => n + 1); }}>Reset demonstration</button>
    </header>
    <section className="demo-notice" aria-label="Walkthrough">
      <strong>Try three moments</strong>
      <p>Inspect Grace’s concern → approve Priya’s reply → try a refund promise on Elena’s review.</p>
      <div className="demo-shortcuts">
        {[['rev_007', '1. Safety concern'], ['rev_001', '2. Positive review'], ['rev_003', '3. Promise safeguard']].map(([id, label]) =>
          <button className="btn-secondary" key={id} onClick={() => setSelected(id)}>{label}</button>)}
      </div>
    </section>
    <div className="hosted-grid">
      <section aria-label="Review queue">
        <h2>Needs your attention</h2>
        <p>{rows.length - Object.keys(outcomes).length} awaiting review · {Object.values(outcomes).filter(o => o.status === 'unknown').length} uncertain outcomes</p>
        {rows.map(item => <button className={`hosted-review ${selected === item.review.id ? 'selected' : ''}`} key={item.review.id}
          onClick={() => setSelected(item.review.id)} aria-pressed={selected === item.review.id}>
          <strong>{item.review.author} · {item.review.stars} stars</strong>
          <span>{item.triage.sensitive ? 'Sensitive concern' : `${item.triage.riskLevel} risk`} · {outcomes[item.review.id]?.status === 'approved' ? 'Approved (simulated)' : outcomes[item.review.id]?.status === 'unknown' ? 'Delivery unknown (simulated)' : 'Awaiting owner'}</span>
          <span>{item.review.text}</span>
        </button>)}
      </section>
      <section className="demo-step" aria-label="Review workspace">
        <h2>{row.review.author}’s review</h2>
        <blockquote>{row.review.text}</blockquote>
        <p><strong>Why it needs this attention:</strong> {REASON_CODE_EXPLANATIONS[row.triage.reasonCodes[0]]}</p>
        <p>Matched words: {row.triage.matchedKeywords.join(', ') || 'None; rating rule applies'}.</p>
        <p className="page-sub">A guest account is not a verified finding about cause or employee conduct.</p>
        <details><summary>Approved facts used in the draft</summary>
          <ul>{row.draft.factsUsed.map(key => <li key={key}>{facts.facts.find(fact => fact.key === key)?.value}</li>)}</ul>
          <p>Policy version: {row.triage.policyVersion} · Template: {row.draft.templateId}</p>
        </details>
        <Editor key={`${selected}-${reset}`} row={row} outcome={outcomes[selected]} onRecord={record} />
      </section>
    </div>
    <section className="demo-notice"><h2>Session activity</h2>
      {events.length ? <ol>{events.map((event, i) => <li key={i}>{event}</li>)}</ol> : <p>No simulated decisions yet.</p>}
      <p className="page-sub">This activity is temporary demonstration state, not a durable audit record.</p>
    </section>
    <section className="demo-notice"><h2>From demo to one-business service</h2>
      <p>Live use requires authenticated owner access, authorised review intake, durable storage and tested
        publication recovery. Every external reply will still need owner approval.</p>
    </section>
  </main>;
}

function Editor({ row, outcome, onRecord }: { row: Row; outcome?: Outcome; onRecord: (status: Outcome['status'], text: string) => void }) {
  const [text, setText] = useState(row.draft.text);
  const [confirmed, setConfirmed] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [simulateUnknown, setSimulateUnknown] = useState(false);
  const [stale, setStale] = useState(false);
  function submit() {
    if (outcome) return;
    const errors = !confirmed ? ['Confirm your factual review before approving.'] : stale ?
      ['The simulated source changed. Reload the sample draft and review it again.'] : validateReply(text);
    setIssues(errors);
    if (!errors.length) onRecord(simulateUnknown ? 'unknown' : 'approved', text);
  }
  if (outcome) return <section aria-live="polite">
    <h3>{outcome.status === 'unknown' ? 'Simulated outcome: delivery unknown' : 'Approved in this demonstration'}</h3>
    <p>{outcome.text}</p>
    <p>{outcome.status === 'unknown' ? 'Retry is blocked. In the live workflow, an operator must reconcile delivery before retrying. Reset the demonstration to practise again.' : 'Nothing was sent to Google. Reset the demonstration to practise again.'}</p>
  </section>;
  return <section>
    <h3>Your reply</h3>
    <label htmlFor="hosted-reply">Review and edit the sample draft</label>
    <textarea id="hosted-reply" rows={7} maxLength={4000} value={text} onChange={e => { setText(e.target.value); setConfirmed(false); setIssues([]); }} />
    <label className="hosted-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
      I have checked the facts and removed unsupported promises and private staff information.</label>
    {issues.length > 0 && <div role="alert"><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <button className="btn-primary" onClick={submit}>Approve reply — simulation</button>
    <details className="demo-notice"><summary>Practise a failure</summary>
      <p>These controls deliberately simulate failures; they are not evidence of live-provider behaviour.</p>
      <button className="btn-secondary" onClick={() => { setText('We will refund you $50.'); setConfirmed(false); setIssues([]); }}>Insert an unsupported promise</button>
      <label className="hosted-check"><input type="checkbox" checked={simulateUnknown} onChange={e => { setSimulateUnknown(e.target.checked); setConfirmed(false); }} />Simulate an uncertain delivery result</label>
      <button className="btn-secondary" onClick={() => { setStale(true); setConfirmed(false); setIssues(['Simulated source changed. The old approval is no longer valid.']); }}>Simulate source change</button>{' '}
      <button className="btn-secondary" onClick={() => { setStale(false); setText(row.draft.text); setConfirmed(false); setIssues([]); }}>Reload sample draft</button>
    </details>
  </section>;
}
