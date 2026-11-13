import { decisionMetrics, rowsInPeriod, type DeskRow } from "@/lib/desk/summary";
import { aggregateByPeriod, THEME_LABELS, type Period } from "@/lib/insights/aggregate";
import type { Review, ReviewTheme } from "@/lib/types";

export function DeskInsights({ rows, period, asOf }: { rows: DeskRow[]; period: Period; asOf?: string }) {
  const now = asOf ? new Date(asOf) : new Date();
  const dated = rows.filter(row => row.review.createTime && Number.isFinite(Date.parse(row.review.createTime)) && Date.parse(row.review.createTime) <= now.getTime());
  const cohort = dated.length ? rowsInPeriod(rows, period, now) : rows;
  const metrics = decisionMetrics(cohort);
  const themes = (["food", "service", "atmosphere"] as ReviewTheme[]).map(theme => ({ theme, rows: cohort.filter(row => row.triage.themes.includes(theme)) })).sort((a,b) => b.rows.length - a.rows.length);
  const top = themes[0];
  const tied = themes.filter(item => item.rows.length === top.rows.length && item.rows.length > 0);
  const buckets = aggregateByPeriod(dated.map(row => ({ review: row.review as Review, triage: row.triage })), period, "Asia/Singapore");
  return <div className="owner-insights">
    <section className="signal-card">
      <p className="desk-eyebrow">{dated.length ? period === "week" ? "THIS WEEK’S SIGNAL" : "THIS MONTH’S SIGNAL" : "CASE OVERVIEW"}</p>
      <h2>{!cohort.length ? "No reviews in this period" : !dated.length ? "Review dates are needed for trends" : !top.rows.length ? "No theme assigned yet" : tied.length > 1 ? `${tied.map(item => THEME_LABELS[item.theme]).join(" and ")} appear most often` : `${THEME_LABELS[top.theme]} appears most often`}</h2>
      {cohort.length > 0 && top.rows.length > 0 && <p><strong>{top.rows.length} of {cohort.length}</strong> reviews mention {tied.length > 1 ? `each of these themes: ${tied.map(item => THEME_LABELS[item.theme].toLowerCase()).join(", ")}` : THEME_LABELS[top.theme].toLowerCase()}. Mentions may include praise as well as concerns.</p>}
      <p className="page-sub">{dated.length ? "Review the examples before choosing an operational follow-up." : "These screenshot cases have no exact review dates. The counts below describe this practice cohort."}</p>
      {rows.length > dated.length && dated.length > 0 && <p>{rows.length - dated.length} undated reviews excluded from time-based signals.</p>}
      <div className="theme-evidence">{themes.filter(item => item.rows.length > 0).map(item => <details key={item.theme}><summary>See {item.rows.length} {THEME_LABELS[item.theme].toLowerCase()} {item.rows.length === 1 ? "review" : "reviews"}</summary><ul>{item.rows.map(row => <li key={row.review.id}><span>{row.review.stars}★</span><blockquote>{row.review.text}</blockquote></li>)}</ul></details>)}</div>
    </section>
    <div className="insight-cards">
      <section><h2>Response coverage</h2><dl><dt>Awaiting a decision</dt><dd>{metrics.awaiting}</dd><dt>Replies approved</dt><dd>{metrics.approved}</dd><dt>Skipped</dt><dd>{metrics.skipped}</dd><dt>No response required</dt><dd>{metrics.noResponse}</dd></dl></section>
      <section><h2>Risk mix</h2><dl><dt>Sensitive</dt><dd>{metrics.risk.sensitive}</dd><dt>High · other</dt><dd>{metrics.risk.high}</dd><dt>Medium</dt><dd>{metrics.risk.medium}</dd><dt>Low</dt><dd>{metrics.risk.low}</dd></dl></section>
      <section><h2>Response quality</h2><dl><dt>Edited before approval</dt><dd>{metrics.edited} / {metrics.approved}</dd><dt>Current failed sends</dt><dd>{metrics.failed}</dd><dt>Delivery unconfirmed</dt><dd>{metrics.uncertain}</dd></dl><p className="page-sub">Stale-approval counts are not recorded.</p></section>
    </div>
    {buckets.length > 0 && <section className="theme-history"><h2>Theme mentions over time</h2><p className="page-sub">A review can mention several themes. These counts do not establish a cause.</p><div className="table-scroll"><table><thead><tr><th>Period</th><th>Reviews</th><th>Food</th><th>Service</th><th>Atmosphere</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.key}><td>{bucket.label}</td><td>{bucket.reviewCount}</td>{bucket.themes.map(theme => <td key={theme.theme}>{theme.count}</td>)}</tr>)}</tbody></table></div></section>}
  </div>;
}
