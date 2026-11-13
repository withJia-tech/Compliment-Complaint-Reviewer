"use client";
import Link from "next/link";
import { useState } from "react";
import { ActionBadge } from "@/app/components/ActionBadge";
import { RiskBadge } from "@/app/components/RiskBadge";
import { ReplyEditor } from "@/app/components/ReplyEditor";
import { statusLabel } from "@/lib/approval/presentation";
import { THEME_LABELS } from "@/lib/insights/aggregate";
import type { Approval, Draft, Review, TriageResult } from "@/lib/types";

export function QueueRow({
  review,
  triage,
  draft,
  approval,
  explanation,
  version,
}: {
  review: Review;
  triage: TriageResult;
  draft: Draft | null;
  approval: Approval | null;
  explanation: string;
  version: string;
}) {
  const [open, setOpen] = useState(false);
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
          <RiskBadge
            riskLevel={triage.riskLevel}
            sensitive={triage.sensitive}
          />
        </td>
        <td>
          <ActionBadge action={triage.recommendedAction} />
        </td>
        <td>{statusLabel(approval)}</td>
        <td>
          <button
            type="button"
            className="btn-link"
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide" : "View"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="row-expanded">
          <td colSpan={6}>
            <p className="why">{explanation}</p>
            {draft ? (
              <ReplyEditor
                key={version}
                reviewId={review.id}
                draft={draft}
                approval={approval}
                version={version}
              />
            ) : (
              <p>No draft yet — run a scan.</p>
            )}
            <Link href={`/review/${review.id}`} className="detail-link">
              Full detail &amp; audit →
            </Link>
          </td>
        </tr>
      )}
    </>
  );
}
