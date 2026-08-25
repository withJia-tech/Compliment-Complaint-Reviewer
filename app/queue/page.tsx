import Link from "next/link";
import { ActionBadge } from "@/app/components/ActionBadge";
import { ConfidenceMeter } from "@/app/components/ConfidenceMeter";
import { RiskBadge } from "@/app/components/RiskBadge";
import { runScanAction } from "@/app/queue/actions";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { locationRepo } from "@/lib/store/locationRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import { triageRepo } from "@/lib/store/triageRepo";
import { DEFAULT_LOCATION_ID, type RiskLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const RISK_ORDER: Record<RiskLevel, number> = { escalate: 0, high: 1, medium: 2, low: 3 };

export default function QueuePage() {
  const location = locationRepo.get(DEFAULT_LOCATION_ID);

  const rows = reviewRepo
    .list()
    .map((review) => ({
      review,
      triage: triageRepo.getByReviewId(review.id),
      approval: approvalRepo.getByReviewId(review.id),
    }))
    .filter((row): row is typeof row & { triage: NonNullable<(typeof row)["triage"]> } => row.triage !== null)
    .sort((a, b) => {
      const riskDiff = RISK_ORDER[a.triage.riskLevel] - RISK_ORDER[b.triage.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return new Date(b.review.updateTime).getTime() - new Date(a.review.updateTime).getTime();
    });

  return (
    <main>
      <h1>Daily Review Queue</h1>
      <div className="consent-banner">
        Auto-publish consent is currently <strong>{location.autoPublishConsent ? "ON" : "OFF"}</strong>.{" "}
        <Link href="/settings">Manage in Settings</Link>
      </div>
      <form action={runScanAction} style={{ marginBottom: "1rem" }}>
        <button type="submit">Run scan now</button>
      </form>
      {rows.length === 0 ? (
        <p>No reviews yet. Run a scan to populate the queue.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Stars</th>
              <th>Review</th>
              <th>Risk</th>
              <th>Recommended action</th>
              <th>Confidence</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ review, triage, approval }) => (
              <tr key={review.id}>
                <td>{"★".repeat(review.stars)}</td>
                <td>
                  {review.text.slice(0, 80)}
                  {review.text.length > 80 ? "…" : ""}
                </td>
                <td>
                  <RiskBadge riskLevel={triage.riskLevel} />
                </td>
                <td>
                  <ActionBadge action={triage.recommendedAction} />
                </td>
                <td>
                  <ConfidenceMeter confidence={triage.confidence} />
                </td>
                <td>{approval?.status ?? "pending"}</td>
                <td>
                  <Link href={`/review/${review.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
