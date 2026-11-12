"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ActionBadge } from "@/app/components/ActionBadge";
import { RiskBadge } from "@/app/components/RiskBadge";
import { sendReplyAction, rejectInlineAction } from "@/app/queue/actions";
import { THEME_LABELS } from "@/lib/insights/aggregate";
import type { Approval, Draft, Review, TriageResult } from "@/lib/types";

function statusLabel(approval: Approval | null): string {
  switch (approval?.status) {
    case "approved":
    case "edited_approved":
      return "Sent";
    case "auto_published":
      return "Auto-published";
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
                      onClick={() =>
                        startTransition(async () => {
                          await sendReplyAction(review.id, text);
                          setOpen(false);
                        })
                      }
                    >
                      {pending ? "Sending…" : edited ? "Send edited reply" : "Send reply"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await rejectInlineAction(review.id);
                          setOpen(false);
                        })
                      }
                    >
                      Skip
                    </button>
                    <Link href={`/review/${review.id}`} className="detail-link">
                      Full detail &amp; audit →
                    </Link>
                  </div>
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
