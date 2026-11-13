import Link from "next/link";
import { withinReviewWindow } from "@/lib/triage/reviewWindow";
import { AppHeader } from "@/app/components/AppHeader";
import { QueueRow } from "@/app/components/QueueRow";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";

export const dynamic = "force-dynamic";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const showCompleted = (await searchParams).view === "completed";
  const all = loadQueueRows();
  const header = loadHeaderData(all);
  const rows = all.filter(row => {
    const completed = row.approval && ["approved", "edited_approved", "rejected", "no_response_required"].includes(row.approval.status);
    return showCompleted ? completed : !completed && (withinReviewWindow(row.review) || ["publishing", "publish_unknown"].includes(row.approval?.status ?? ""));
  });

  return (
    <>
      <AppHeader {...header} currentPath="/queue" />
      <main>
        <div className="page-head">
          <h1>{showCompleted ? "Completed reviews" : "Daily queue"}</h1>
          <p><Link href="/queue">Active</Link> · <Link href="/queue?view=completed">Completed decisions</Link></p>
          <p className="page-sub">
            {header.pendingCount === 0
              ? "Nothing waiting on you."
              : `${header.pendingCount} waiting on you. Sensitive claims first.`}
          </p>
        </div>

        {rows.length === 0 ? (
          <p>No reviews in this view. Completed decisions remain available separately.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Stars</th>
                <th>Review</th>
                <th>Risk</th>
                <th>Action</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ review, triage, draft, approval, version }) => (
                <QueueRow
                  key={review.id}
                  version={version ?? ""}
                  review={review}
                  triage={triage}
                  draft={draft}
                  approval={approval}
                  explanation={REASON_CODE_EXPLANATIONS[triage.reasonCodes[0]]}
                />
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
