"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ActionBadge } from "@/app/components/ActionBadge";
import { RiskBadge } from "@/app/components/RiskBadge";
import { sendReplyAction, rejectInlineAction } from "@/app/queue/actions";
import { THEME_LABELS } from "@/lib/insights/aggregate";
import type { DecisionResult } from "@/lib/decisions";
import type { Approval, Draft, Review, TriageResult } from "@/lib/types";

/** Plain-language account of a refused send or skip. */
function refusalMessage(result: Extract<DecisionResult, { ok: false }>): string {
  if (result.reason === "in_progress") {
    return "A send for this review is already in progress.";
  }
  const done = result.status === "rejected" ? "skipped" : "sent";
  return `This review was already ${done} — the queue has been refreshed.`;
}

function statusLabel(approval: Approval | null): string {
  switch (approval?.status) {
    case "approved":
    case "edited_approved":
      return "Sent";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

export function QueueRow({
  review,
  triage,
  draft,
  approval,
  explanation,
}: {
  review: Review;
  triage: TriageResult;
  draft: Draft | null;
  approval: Approval | null;
  explanation: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(draft?.text ?? "");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  function run(action: () => Promise<DecisionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setOpen(false);
      } else {
        setNotice(refusalMessage(result));
      }
    });
  }

  const decided = Boolean(approval && approval.status !== "pending");
  const edited = draft ? text.trim() !== draft.text.trim() : false;

  return (
    <>
      <tr className={triage.sensitive ? "row-sensitive" : undefined}>
        <td className="cell-stars">{"★".repeat(review.stars)}</td>
        <td>
          <div className="cell-review">{review.text}</div>
          <div className="cell-themes">
            {triage.themes.map((theme) => (
              <span key={theme} className="chip">
                {THEME_LABELS[theme]}
              </span>
            ))}
          </div>
        </td>
        <td>
          <RiskBadge riskLevel={triage.riskLevel} sensitive={triage.sensitive} />
        </td>
        <td>
          <ActionBadge action={triage.recommendedAction} />
        </td>
        <td className={decided ? "status-done" : "status-pending"}>{statusLabel(approval)}</td>
        <td>
          <button type="button" className="btn-link" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "View"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="row-expanded">
          <td colSpan={6}>
            <p className="why">{explanation}</p>
            {draft ? (
              <>
                <label htmlFor={`reply-${review.id}`} className="field-label">
                  Proposed reply {edited && <em>(edited)</em>}
                </label>
                <textarea
                  id={`reply-${review.id}`}
                  value={text}
                  rows={3}
                  disabled={decided || pending}
                  onChange={(event) => setText(event.target.value)}
                />
                <p className="facts-cited">
                  Facts cited: {draft.factsUsed.length > 0 ? draft.factsUsed.join(", ") : "none"}
                </p>
                {decided ? (
                  <p className="decided-note">
                    {statusLabel(approval)}
                    {approval?.reason ? ` — ${approval.reason}` : ""}
                  </p>
                ) : (
                  <div className="inline-actions">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => sendReplyAction(review.id, text))}
                    >
                      {pending ? "Sending…" : edited ? "Send edited reply" : "Send reply"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={pending}
                      onClick={() => run(() => rejectInlineAction(review.id))}
                    >
                      Skip
                    </button>
                    <Link href={`/review/${review.id}`} className="detail-link">
                      Full detail &amp; audit →
                    </Link>
                  </div>
                )}
                {notice && (
                  <p className="notice" role="status">
                    {notice}
                  </p>
                )}
              </>
            ) : (
              <p>No draft yet — run a scan.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
