import type { ApprovedBusinessFacts, Draft } from "@/lib/types";

export function ReplyEvidence({ reviewText, draft, facts }: { reviewText: string; draft: Draft; facts: ApprovedBusinessFacts }) {
  return <aside className="reply-evidence" aria-label="Evidence for this reply">
    <h3>Approved business facts</h3>
    {draft.factsUsed.length ? <ul>{draft.factsUsed.map(key => {
      const fact = facts.facts.find(item => item.key === key);
      const label = fact ? fact.key.replace(/[._]/g, " ").replace(/^./, char => char.toUpperCase()) : "Unavailable fact";
      return <li key={key}><strong>{label}:</strong> {fact?.value ?? `Reference ${key} needs checking`}</li>;
    })}</ul> : <p>No approved business facts cited.</p>}
    <p className="evidence-caption">References from the original draft. Check any changes you make.</p>
    <h3>Review evidence</h3><blockquote className="evidence-quote" tabIndex={0}>{reviewText}</blockquote>
    <p className="evidence-caption">Customer’s account · not a verified finding about cause or staff conduct.</p>
  </aside>;
}
