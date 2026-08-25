import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBadge } from "@/app/components/ActionBadge";
import { RiskBadge } from "@/app/components/RiskBadge";
import { approveAction, editAndApproveAction, rejectAction } from "@/app/review/[id]/actions";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { draftRepo } from "@/lib/store/draftRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = reviewRepo.getById(id);
  const triage = triageRepo.getByReviewId(id);
  if (!review || !triage) {
    notFound();
  }
  const draft = draftRepo.getByReviewId(id);
  const approval = approvalRepo.getByReviewId(id);
  const auditTrail = auditRepo.listByReviewId(id);

  const boundApprove = approveAction.bind(null, id);
  const boundEditApprove = editAndApproveAction.bind(null, id);
  const boundReject = rejectAction.bind(null, id);

  return (
    <main>
      <p>
        <Link href="/queue">&larr; Back to queue</Link>
      </p>
      <h1>Review from {review.author}</h1>

      <section>
        <h2>Evidence</h2>
        <p>
          {"★".repeat(review.stars)} ({review.stars}/5) &middot; posted{" "}
          {new Date(review.createTime).toLocaleString()}
        </p>
        <blockquote>{review.text}</blockquote>
      </section>

      <section>
        <h2>Triage</h2>
        <p>
          <RiskBadge riskLevel={triage.riskLevel} /> <ActionBadge action={triage.recommendedAction} />
        </p>
        <p>{REASON_CODE_EXPLANATIONS[triage.reasonCodes[0]]}</p>
        {triage.matchedKeywords.length > 0 && <p>Matched keywords: {triage.matchedKeywords.join(", ")}</p>}
        <p>
          Confidence: {Math.round(triage.confidence * 100)}% &middot; Policy version:{" "}
          {triage.policyVersion}
        </p>
      </section>

      {draft && (
        <section>
          <h2>Draft reply</h2>
          <p>{draft.text}</p>
          <p>Facts cited: {draft.factsUsed.length > 0 ? draft.factsUsed.join(", ") : "none"}</p>
        </section>
      )}

      <section>
        <h2>Decision</h2>
        <p>
          Current status: <strong>{approval?.status ?? "pending"}</strong>
          {approval?.reason ? ` — ${approval.reason}` : ""}
        </p>
        {(!approval || approval.status === "pending") && draft && (
          <div className="decision-actions">
            <form action={boundApprove}>
              <button type="submit">Approve &amp; publish as-is</button>
            </form>
            <form action={boundEditApprove}>
              <label htmlFor="editedText">Edit before approving</label>
              <textarea id="editedText" name="editedText" defaultValue={draft.text} rows={4} />
              <button type="submit">Save edit &amp; approve</button>
            </form>
            <form action={boundReject}>
              <label htmlFor="reason">Rejection reason (optional)</label>
              <input id="reason" name="reason" type="text" placeholder="Why reject this draft?" />
              <button type="submit">Reject</button>
            </form>
          </div>
        )}
      </section>

      <section>
        <h2>Audit trail</h2>
        {auditTrail.length === 0 ? (
          <p>No audit records yet.</p>
        ) : (
          <ul>
            {auditTrail.map((record) => (
              <li key={record.id}>
                <strong>{record.action}</strong> at {new Date(record.recordedAt).toLocaleString()} by{" "}
                {record.actor} (policy {record.policyVersion})
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
