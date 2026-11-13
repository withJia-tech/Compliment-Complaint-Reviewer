import React from "react";
import { POLICY_VERSION } from "@/lib/triage/policyVersion";
import { VALIDATION_VERSION } from "@/lib/validation/reply";

const repository = "https://github.com/withJia-tech/Compliment-Complaint-Reviewer";
const evidenceCommit = "6c251be9a167c093fa57514d98d853b6f3102a33";
const source = (path: string) => `${repository}/blob/${evidenceCommit}/${path}`;

export function BehindTheHood({ demoHref = "/hosted-demo", buildManifestHref }: { demoHref?: string; buildManifestHref?: string }) {
  return <main className="hood-page">
    <header className="hood-header"><a className="hood-brand" href={demoHref}>◑ Review Desk</a><a className="hood-back" href={demoHref}>Open client demo <span aria-hidden="true">↗</span></a></header>
    <section className="hood-hero" aria-labelledby="hood-title">
      <p className="desk-eyebrow">ENGINEERING COMPANION</p><h1 id="hood-title">Behind the hood.</h1>
      <p className="hood-lead">Understand the decisions.<br />Inspect the evidence. Know the limits.</p>
      <p>The client demo is for reviewing guests’ feedback. This page explains the rules, safeguards and engineering work behind it.</p>
      <div className="hood-legend" aria-label="Capability status legend"><span>Available in demo</span><span>Local fixture only</span><span>Proposed</span></div>
    </section>
    <nav className="hood-nav" aria-label="Engineering sections"><a href="#workflow">Workflow</a><a href="#rubrics">Rubrics</a><a href="#traceability">Traceability</a><a href="#reliability">Reliability</a><a href="#evidence">Test evidence</a></nav>

    <section id="workflow" className="hood-section">
      <div className="hood-section-title"><span>01</span><div><p className="desk-eyebrow">CONTROLLED EXECUTION</p><h2>Who can decide what?</h2></div></div>
      <p className="hood-principle">Respond to the guest with care, establish facts with discipline, support the team fairly, and improve the operation with evidence.</p>
      <div className="hood-split"><div><h3>Current hosted demo</h3><p className="hood-status">Available in demo</p><ol className="hood-flow"><li><strong>Supplied examples</strong><span>Synthetic reviews and screenshot transcriptions. No live intake.</span></li><li><strong>Rules and prepared drafts</strong><span>Deterministic triage; template or editorial replies. No model inference.</span></li><li><strong>Human decision</strong><span>Check evidence, edit and confirm. Editing clears the confirmation.</span></li><li><strong>Session outcome</strong><span>Approve or choose no response. Move to Completed; nothing is sent.</span></li></ol></div>
      <div className="hood-future"><h3>Proposed assisted workflow</h3><p className="hood-status">Proposed · not connected</p><ol className="hood-flow"><li><strong>Model interprets and proposes</strong><span>Aspect findings, assurance flags and an optional rewrite.</span></li><li><strong>Application validates</strong><span>Schema, evidence spans, source versions, policy and permissions.</span></li><li><strong>Human approves</strong><span>Approval applies to the exact reply and current evidence.</span></li><li><strong>Application executes</strong><span>A separately authorised adapter would publish and reconcile the result.</span></li></ol></div></div>
      <p className="hood-callout">The model cannot approve its own work, grant refunds, change policy or publish. Initial-release external replies require human approval. ADR-001 remains open.</p>
      <details className="hood-detail"><summary>Shadow mode and controlled learning</summary><p>Proposed: run a candidate alongside the active version without changing its decisions. Capture reviewer acceptance, rejection and corrections under an approved retention policy. Independently adjudicate high-risk or ambiguous cases before adding them to a versioned evaluation set.</p><p>Classifier prompts, retrieval indexes and policy thresholds would change only after frozen evaluation gates and explicit promotion. There is no connected agent, MCP workflow, retrieval index, feedback pipeline or automatic promotion in this demo.</p></details>
    </section>

    <section id="rubrics" className="hood-section">
      <div className="hood-section-title"><span>02</span><div><p className="desk-eyebrow">DECISION RUBRICS</p><h2>What the rules mean.</h2></div></div>
      <p>The current classifier uses star bands and keyword rules. Its labels prioritise human attention; they do not establish that an allegation is true.</p>
      <details className="hood-detail" open><summary>Routing · implemented deterministic rules</summary><p>Baseline: <code>{POLICY_VERSION}</code>. Rules are evaluated in this order.</p><div className="hood-table-wrap"><table><thead><tr><th>Signal</th><th>Route</th><th>Owner’s next step</th></tr></thead><tbody>
        <tr><td>Strong sensitive term</td><td>High · sensitive</td><td>Review personally</td></tr><tr><td>Weak sensitive term</td><td>Sensitive · at least medium</td><td>Resolve the ambiguity</td></tr><tr><td>1–2 stars</td><td>High</td><td>Review the concern</td></tr><tr><td>3 stars, or 4–5 with complaint language</td><td>Medium</td><td>Review mixed feedback</td></tr><tr><td>4–5 stars without detected complaint language</td><td>Low</td><td>Check the thank-you or choose no response</td></tr>
      </tbody></table></div><p>Dataset 2 uses the separate <code>demo-candidate-v1.1.0</code> rule to recognise “broken glass”. That candidate has not been promoted into the baseline policy. Keyword strength is not a calibrated probability.</p><a href={source("SPEC.md")}>Read the routing specification</a></details>
      <details className="hood-detail"><summary>Grounding and response checks · partial enforcement</summary><p>Templates record the approved fact keys they use. Screenshot-case replies are editorial examples with no approved business facts supplied. Review-derived wording remains an attributed account.</p><p><code>{VALIDATION_VERSION}</code> checks blank or overlong replies and conservative English patterns for remedies, deadlines, blame and completed-action claims. Passing these checks does not prove truth, full grievance coverage or absence of private information.</p><a href={source("lib/validation/reply.ts")}>Inspect the current validator</a></details>
      <details className="hood-detail"><summary>CARE · FACTS · FAIRNESS · IMPROVEMENT · proposed assurance rubric</summary><dl className="hood-rubric"><dt>CARE</dt><dd>Preserve the primary grievance, supported praise and an effective human reply. At most three contextual, italic, internal-only coaching notes.</dd><dt>FACTS</dt><dd>Attribute each account, validate source versions and evidence spans, and flag unsupported satisfaction, causes or promises.</dd><dt>FAIRNESS</dt><dd>Keep guest reports, staff accounts and system evidence distinct. No inferred misconduct or personality. Staff-identifiable evidence belongs in a manager-only workflow.</dd><dt>IMPROVEMENT</dt><dd>For each investigation, specify an accountable owner, signal, source, denominator, comparison period, verification method and status. Claim improvement only after verification.</dd></dl><p>This is the acceptance contract for future assurance work, not an implemented scoring engine or a validated model result.</p></details>
      <details className="hood-detail"><summary>Food, Service and Atmosphere · supporting signals</summary><p>Themes are additive keyword tags. A mention may be praise or criticism; an empty theme list is valid. Counts show denominators and source reviews. Undated screenshot cases are excluded from date-based trends. No automatic root-cause or operational-improvement claim is made.</p></details>
    </section>

    <section id="traceability" className="hood-section">
      <div className="hood-section-title"><span>03</span><div><p className="desk-eyebrow">TRACEABILITY</p><h2>Follow the decision, not hidden reasoning.</h2></div></div>
      <div className="hood-table-wrap"><table><thead><tr><th>Surface</th><th>Recorded or visible</th><th>Boundary</th></tr></thead><tbody>
        <tr><td><strong>Hosted demo</strong></td><td>Source text, explanation, fact references and final session decision with time.</td><td>Browser memory only. Refresh clears decisions. No authenticated reviewer identity or persistent audit.</td></tr>
        <tr><td><strong>Server-backed fixture</strong></td><td>Policy version, source timestamps, matched terms, draft and fact keys, context fingerprints, exact approved text, attempt ID, validation version and simulated provider outcome.</td><td>Local JSON records with a stub actor. Not a production audit store. Rejected validation attempts are not all recorded.</td></tr>
        <tr><td><strong>Future live service</strong></td><td>Model/prompt provenance, evidence spans, tool schema and permission results, human identity, retention controls and deployment-linked traces.</td><td>Proposed. No live trace viewer or operational log feed on this page.</td></tr>
      </tbody></table></div>
      <p><a href={source("lib/types.ts")}>Audit record contract</a><span className="hood-link-separator"> · </span><a href={source("lib/decisions.ts")}>Decision implementation</a></p>
      <details className="hood-detail"><summary>Privacy and access boundaries</summary><p>This companion contains explanations and public source links only. It is not an administrative console or an access-control boundary. No raw operational logs, credentials or private staff records are exposed here.</p><p>The local fixture audit includes review text and uses a stub owner identity. Live use needs authenticated owner/manager roles, location-scoped access, minimised evidence references and a defined retention/deletion policy. Store observable outputs and decisions, never hidden model reasoning.</p></details>
    </section>

    <section id="reliability" className="hood-section">
      <div className="hood-section-title"><span>04</span><div><p className="desk-eyebrow">NON-FUNCTIONAL REQUIREMENTS</p><h2>Safeguards, with their limits.</h2></div></div>
      <div className="hood-table-wrap"><table><thead><tr><th>Concern</th><th>Current evidence</th><th>Still needed for live use</th></tr></thead><tbody>
        <tr><td>Approval and freshness</td><td>Hosted edits clear confirmation. Server fixture checks pinned source, draft, facts and triage before a simulated send.</td><td>Authenticated approval and live source revalidation.</td></tr>
        <tr><td>Duplicate or uncertain sends</td><td>Fixture tests cover intent recording, uncertain delivery and reconciliation before retry.</td><td>Real provider receipts and recovery drills.</td></tr>
        <tr><td>Persistence and concurrency</td><td>Local atomic file replacement and a shared single-writer lock; no server storage in the hosted demo.</td><td>Approved durable storage, transactions, backup and recovery design.</td></tr>
        <tr><td>Privacy and permissions</td><td>Hosted server mutations are blocked in the Next.js path. Static hosts have no publishing backend.</td><td>Owner/manager identity, location isolation, retention and private evidence controls.</td></tr>
        <tr><td>Observability</td><td>CI/build logs and local fixture audit records. Owner signals summarise current states.</td><td>Correlated application logs, alerts, stage timing and counters for rejected or stale approvals.</td></tr>
        <tr><td>Latency and inference cost</td><td>No live model calls. No measured p50/p95 or actual inference-cost report.</td><td>Instrumentation and an agreed workload before setting performance targets.</td></tr>
        <tr><td>Usability and accessibility</td><td>Responsive layouts, labelled controls and semantic navigation. Desktop demo interactions were checked at the evidence checkpoint below.</td><td>Mobile-device verification and a dedicated accessibility audit.</td></tr>
      </tbody></table></div>
    </section>

    <section id="evidence" className="hood-section hood-evidence">
      <div className="hood-section-title"><span>05</span><div><p className="desk-eyebrow">VERIFICATION CHECKPOINT</p><h2>Evidence you can inspect.</h2></div></div>
      <p><strong>13 November 2026 · 163 tests passed</strong> at commit <a href={`${repository}/commit/${evidenceCommit}`}><code>{evidenceCommit.slice(0,8)}</code></a>. This is a pinned baseline checkpoint, not a live health badge for every subsequent build.</p>
      <p>That CI run passed type checks, tests, the production build and the repeated-scan idempotency check. Desktop checks covered confirmation refusal, invalidation after editing, no-response completion and signal counts. Mobile and the server-backed queue were not browser-verified.</p>
      <div className="hood-evidence-links"><a href={`${repository}/actions/runs/43394069962`}>Open checkpoint CI run ↗</a><a href={source("docs/VERIFIED_SEND.md")}>Read send-boundary evidence ↗</a><a href={`${repository}/pull/7`}>Review implementation changes ↗</a>{buildManifestHref && <a href={buildManifestHref}>Current static bundle manifest ↗</a>}</div>
      <details className="hood-detail"><summary>What this checkpoint does not establish</summary><p>There is no standalone lint job or evaluation-artifact upload step in the checkpoint workflow. Expanded adversarial evaluation and dependency/secret scanning belong to a separate, unmerged classifier branch. Semantic grounding coverage, critical-category recall and broader policy-compliance gates remain open.</p><p>Proposed formal evaluation compares A: human reply alone; B: human reply plus assurance flags; C: flags plus an optional rewrite. Freeze definitions, thresholds and case selection before testing. Report counts, denominators and uncertainty for grievance coverage, aspect correctness, unsupported assertions, critical-allegation recall, policy compliance, unnecessary intervention, human correction time, acceptance/rejection, latency and actual inference cost. High-risk and ambiguous cases need independent human adjudication.</p></details>
      <p className="hood-callout">This page explains the current prototype and its release gates. It does not certify production readiness or close ADR-001.</p>
    </section>
    <footer className="hood-footer"><a href={demoHref}>← Open client demo</a><span>ComplimentOrComplaint · Review Desk</span></footer>
  </main>;
}
