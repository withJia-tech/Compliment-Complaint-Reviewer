"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  sendReplyAction,
  reconcileReplyAction,
  noResponseRequiredAction,
} from "@/app/queue/actions";
import { refusalMessage, statusLabel } from "@/lib/approval/presentation";
import type { DecisionResult } from "@/lib/decisions";
import type { Approval, Draft } from "@/lib/types";

/** Shared by queue and detail. Parent keys this component by the rendered context version. */
export function ReplyEditor({
  reviewId,
  draft,
  approval,
  version,
}: {
  reviewId: string;
  draft: Draft;
  approval: Approval | null;
  version: string;
}) {
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const [text, setText] = useState(approval?.finalText ?? draft.text);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const uncertain =
    approval?.status === "publishing" || approval?.status === "publish_unknown";
  const settled = ["approved", "edited_approved", "rejected", "no_response_required"].includes(
    approval?.status ?? "",
  );
  function run(action: () => Promise<DecisionResult>) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action();
        setStale(!result.ok && result.reason === "stale_context");
        setNotice(
          result.ok
            ? "Decision saved. Publishing in this prototype is simulated."
            : refusalMessage(result),
        );
      } catch {
        setNotice(
          "The action could not be confirmed. Refresh to inspect its saved status before trying again.",
        );
      } finally {
        setConfirmed(false);
      }
    });
  }
  return (
    <>
      <p className="page-sub">
        Demo data only. Replies are simulated; no external message is sent.
      </p>
      {settled ? (
        <p>{approval?.finalText ?? draft.text}</p>
      ) : (
        <>
          <label htmlFor={`reply-${reviewId}`} className="field-label">
            Proposed reply
          </label>
          <textarea
            id={`reply-${reviewId}`}
            value={text}
            rows={4}
            disabled={pending || uncertain}
            onChange={(event) => {
              setText(event.target.value);
              setConfirmed(false);
            }}
          />
        </>
      )}
      <p className="facts-cited">
        Draft facts cited: {draft.factsUsed.join(", ") || "none"}. Edits require
        your factual review.
      </p>
      {approval && (
        <p className="decided-note">
          {statusLabel(approval)}
          {approval.reason ? ` — ${approval.reason}` : ""}
        </p>
      )}
      {!settled && !uncertain && (
        <>
          <label className="confirmation-label">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={pending}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I have completed discovery: checked the review and available facts,
            and removed unsupported promises, blame and private staff information
            from any reply.
          </label>
          <div className="inline-actions">
            <button
              type="button"
              disabled={pending || !confirmed}
              onClick={() =>
                run(() =>
                  sendReplyAction(reviewId, text, {
                    contextVersion: version,
                    reviewed: confirmed,
                  }),
                )
              }
            >
              {pending ? "Saving…" : "Approve and simulate send"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending || !confirmed}
              onClick={() => run(() => noResponseRequiredAction(reviewId, { contextVersion: version, reviewed: confirmed }))}
            >
              No response required
            </button>
          </div>
        </>
      )}
      {uncertain && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reconcileReplyAction(reviewId))}
        >
          Check delivery outcome
        </button>
      )}
      {stale && (
        <button type="button" onClick={() => router.refresh()}>
          Refresh current review
        </button>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
