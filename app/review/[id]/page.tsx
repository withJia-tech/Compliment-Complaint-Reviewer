import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBadge } from "@/app/components/ActionBadge";
import { AppHeader } from "@/app/components/AppHeader";
import { RiskBadge } from "@/app/components/RiskBadge";
import {
  recordRemedyAction,
  rejectAction,
  sendReplyFromDetailAction,
} from "@/app/review/[id]/actions";
import { THEME_LABELS } from "@/lib/insights/aggregate";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";
import { auditRepo } from "@/lib/store/auditRepo";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";

export const dynamic = "force-dynamic";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  phone: "Phone",
  in_person: "In person",
};

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = loadQueueRows();
  const row = rows.find((candidate) => candidate.review.id === id);
  if (!row) {
    notFound();
  }
  const { review, triage, draft, approval } = row;
  const header = loadHeaderData(rows);
  const auditTrail = auditRepo.listByReviewId(id);
  const decided = Boolean(approval && approval.status !== "pending");

  const boundSend = sendReplyFromDetailAction.bind(null, id);
  const boundReject = rejectAction.bind(null, id);
  const boundRemedy = recordRemedyAction.bind(null, id);

  return (
    <>
      <AppHeader {...header} currentPath="/queue" />
      <main>
        <p>
          <Link href="/queue">&larr; Back to queue</Link>
        </p>
        <div className="page-head">
          <h1>Review from {review.author}</h1>
        </div>

        <section>
          <h2>Evidence</h2>
          <p>
            {"★".repeat(review.stars)} ({review.stars}/5) &middot; posted{" "}
            {new Date(review.createTime).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <blockquote>{review.text}</blockquote>
        </section>

        <section>
          <h2>Triage</h2>
          <p>
            <RiskBadge riskLevel={triage.riskLevel} sensitive={triage.sensitive} />{" "}
            <ActionBadge action={triage.recommendedAction} />
          </p>
          <p>{REASON_CODE_EXPLANATIONS[triage.reasonCodes[0]]}</p>
          {triage.themes.length > 0 && (
            <p>
              Themes:{" "}
              {triage.themes.map((theme) => (
                <span key={theme} className="chip">
                  {THEME_LABELS[theme]}
                </span>
              ))}
            </p>
          )}
          {triage.matchedKeywords.length > 0 && (
            <p>Matched keywords: {triage.matchedKeywords.join(", ")}</p>
          )}
          <p>
            Confidence: {Math.round(triage.confidence * 100)}% &middot; Policy version:{" "}
            {triage.policyVersion}
          </p>
        </section>

        {draft && (
          <section>
            <h2>Reply</h2>
            {decided ? (
              <>
                <p>{approval?.finalText ?? draft.text}</p>
                <p className="decided-note">
                  {approval?.status === "rejected" ? "Skipped" : "Sent"}
                  {approval?.reason ? ` — ${approval.reason}` : ""}
                </p>
              </>
            ) : (
              <form action={boundSend}>
                <textarea name="replyText" defaultValue={draft.text} rows={4} />
                <button type="submit">Send reply</button>
              </form>
            )}
            <p className="facts-cited">
              Facts cited: {draft.factsUsed.length > 0 ? draft.factsUsed.join(", ") : "none"}
            </p>
            {!decided && (
              <form action={boundReject} className="reject-form">
                <input name="reason" type="text" placeholder="Reason for skipping (optional)" />
                <button type="submit" className="btn-secondary">
                  Skip
                </button>
              </form>
            )}
          </section>
        )}

        <section>
          <h2>Goodwill remedy</h2>
          <p className="page-sub">
            Vouchers and other goodwill are settled outside this app. Recording one here only notes
            it in the audit trail — nothing is sent, and it never appears in the public reply.
          </p>
          {approval?.remedy ? (
            <p className="remedy-note">
              <strong>{approval.remedy.note}</strong> &middot; settled via{" "}
              {CHANNEL_LABELS[approval.remedy.channel] ?? approval.remedy.channel} &middot; recorded{" "}
              {new Date(approval.remedy.recordedAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : (
            <form action={boundRemedy} className="remedy-form">
              <input name="note" type="text" placeholder="e.g. offered a £10 voucher" />
              <select name="channel" defaultValue="email">
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="in_person">In person</option>
              </select>
              <button type="submit" className="btn-secondary">
                Record remedy
              </button>
            </form>
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
                  <strong>{record.action}</strong> at{" "}
                  {new Date(record.recordedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  by {record.actor} (policy {record.policyVersion})
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
