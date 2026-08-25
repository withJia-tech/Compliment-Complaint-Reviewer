import Link from "next/link";
import { AppHeader } from "@/app/components/AppHeader";
import { THEME_LABELS, aggregateByPeriod, type Period } from "@/lib/insights/aggregate";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";

export const dynamic = "force-dynamic";

function formatStars(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: raw } = await searchParams;
  const period: Period = raw === "month" ? "month" : "week";

  const rows = loadQueueRows();
  const header = loadHeaderData(rows);
  const buckets = aggregateByPeriod(rows, period);

  return (
    <>
      <AppHeader {...header} currentPath="/insights" />
      <main>
        <div className="page-head">
          <h1>Insights</h1>
          <p className="page-sub">
            Feedback grouped by Food, Service, and Atmosphere — the same split Google Business
            Profile reports, so these read alongside your Google metrics.
          </p>
        </div>

        <div className="period-toggle">
          <Link
            href="/insights?period=week"
            className={period === "week" ? "toggle-option toggle-active" : "toggle-option"}
          >
            Weekly
          </Link>
          <Link
            href="/insights?period=month"
            className={period === "month" ? "toggle-option toggle-active" : "toggle-option"}
          >
            Monthly
          </Link>
        </div>

        {buckets.length === 0 ? (
          <p>No reviews yet. Run a scan to populate insights.</p>
        ) : (
          buckets.map((bucket) => (
            <section key={bucket.key}>
              <div className="bucket-head">
                <h2>{bucket.label}</h2>
                <div className="bucket-stats">
                  <span>
                    <strong>{bucket.reviewCount}</strong> review
                    {bucket.reviewCount === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    avg <strong>{formatStars(bucket.averageStars)}</strong>★
                  </span>
                  {bucket.sensitiveCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="stat-warn">
                        <strong>{bucket.sensitiveCount}</strong> sensitive
                      </span>
                    </>
                  )}
                </div>
              </div>
              <table className="theme-table">
                <thead>
                  <tr>
                    <th>Theme</th>
                    <th>Mentions</th>
                    <th>Avg rating</th>
                    <th>Needed a reply decision</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.themes.map((stat) => (
                    <tr key={stat.theme}>
                      <td>{THEME_LABELS[stat.theme]}</td>
                      <td>{stat.count}</td>
                      <td>{formatStars(stat.averageStars)}</td>
                      <td>{stat.needsAttention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </main>
    </>
  );
}
