"use client";
import Link from "next/link";
import { useState } from "react";
import { ReplyEditor } from "@/app/components/ReplyEditor";
import { statusLabel } from "@/lib/approval/presentation";
import { attentionExcerpt, decisionHeading, decisionLabel } from "@/lib/desk/summary";
import { THEME_LABELS } from "@/lib/insights/aggregate";
import type { Approval, ApprovedBusinessFacts, Draft, Review, TriageResult } from "@/lib/types";

export function QueueRow({ review, triage, draft, approval, explanation, version, facts }: {
  review: Review; triage: TriageResult; draft: Draft | null; approval: Approval | null;
  explanation: string; version: string; facts: ApprovedBusinessFacts;
}) {
  const [open, setOpen] = useState(false);
  const row = { review, triage, draft, approval };
  const cited = draft?.factsUsed.filter(key => facts.facts.some(fact => fact.key === key)).length ?? 0;
  return <article className={`decision-row ${triage.sensitive ? "sensitive-rail" : ""}`}>
    <div className="decision-row-top"><strong className={triage.sensitive ? "sensitive-text" : ""}>{decisionHeading(row)}</strong><span>{review.stars}★ · {new Date(review.createTime).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })}</span></div>
    <p className="decision-excerpt">“{attentionExcerpt(row)}”</p>
    <p className="decision-meta">{triage.themes.map(theme => THEME_LABELS[theme]).join(" · ")}{triage.themes.length ? " · " : ""}{triage.riskLevel[0].toUpperCase() + triage.riskLevel.slice(1)} risk · {statusLabel(approval)}</p>
    <div className="decision-row-bottom"><span>{draft ? `Draft ready · ${cited} approved ${cited === 1 ? "fact" : "facts"} cited` : "Draft not available"}</span><button type="button" aria-expanded={open} aria-controls={`editor-${review.id}`} onClick={() => setOpen(!open)}>{open ? "Close review" : decisionLabel(row)}</button></div>
    {open && <div id={`editor-${review.id}`} className="inline-review"><p className="why">{explanation}</p>{draft ? <ReplyEditor key={version} reviewId={review.id} draft={draft} approval={approval} version={version} reviewText={review.text} facts={facts} /> : <blockquote>{review.text}</blockquote>}<Link href={`/review/${review.id}`} className="detail-link">View audit &amp; record a private remedy</Link></div>}
  </article>;
}
