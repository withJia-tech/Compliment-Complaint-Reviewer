import { AppHeader } from "@/app/components/AppHeader";
import { QueueRow } from "@/app/components/QueueRow";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";

export const dynamic = "force-dynamic";

export default function QueuePage() {
  const rows = loadQueueRows();
  const header = loadHeaderData(rows);

  return (
    <>
      <AppHeader {...header} currentPath="/queue" />
      <main>
        <div className="page-head">
          <h1>Daily queue</h1>
          <p className="page-sub">
            {header.pendingCount === 0
              ? "Nothing waiting on you."
              : `${header.pendingCount} waiting on you. Sensitive claims first.`}
          </p>
        </div>

        {rows.length === 0 ? (
          <p>No reviews yet. Run a scan to populate the queue.</p>
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
              {rows.map(({ review, triage, draft, approval }) => (
                <QueueRow
                  key={review.id}
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
