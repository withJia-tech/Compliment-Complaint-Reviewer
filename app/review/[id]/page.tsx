import { RemedyForm } from "@/app/components/RemedyForm";
import { ReplyEditor } from "@/app/components/ReplyEditor";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBadge } from "@/app/components/ActionBadge";
import { AppHeader } from "@/app/components/AppHeader";
import { RiskBadge } from "@/app/components/RiskBadge";
import { THEME_LABELS } from "@/lib/insights/aggregate";
import { confidenceBand } from "@/lib/triage/confidence";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";
import { auditRepo } from "@/lib/store/auditRepo";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";
import businessFacts from "@/data/fixtures/businessFacts.json";
import type { ApprovedBusinessFacts } from "@/lib/types";

export const dynamic = "force-dynamic";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  phone: "Phone",
  in_person: "In person",
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = loadQueueRows();
  const row = rows.find((candidate) => candidate.review.id === id);
  if (!row) {
    notFound();
  }
  const { review, triage, draft, approval, version } = row;
  const header = loadHeaderData(rows);
  const auditTrail = auditRepo.listByReviewId(id);

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
            <RiskBadge
              riskLevel={triage.riskLevel}
              sensitive={triage.sensitive}
            />{" "}
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
            Rule strength: {confidenceBand(triage.confidence)} &middot; Policy
            version: {triage.policyVersion}
          </p>
        </section>

        {draft && (
          <section>
            <h2>Reply</h2>
            <ReplyEditor
              key={version}
              reviewId={id}
              draft={draft}
              approval={approval}
              version={version ?? ""}
              reviewText={review.text}
              facts={businessFacts as ApprovedBusinessFacts}
            />
          </section>
        )}

        <section>
          <h2>Goodwill remedy</h2>
          <p className="page-sub">
            Vouchers and other goodwill are settled outside this app. Recording
            one here only notes it in the audit trail — nothing is sent, and it
            never appears in the public reply.
          </p>
          {approval?.remedy ? (
            <p className="remedy-note">
              <strong>{approval.remedy.note}</strong> &middot; settled via{" "}
              {CHANNEL_LABELS[approval.remedy.channel] ??
                approval.remedy.channel}{" "}
              &middot; recorded{" "}
              {new Date(approval.remedy.recordedAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : (
            <RemedyForm reviewId={id} />
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
