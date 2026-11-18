import Link from "next/link";
import { AppHeader } from "@/app/components/AppHeader";
import { DeskInsights } from "@/app/components/DeskInsights";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";
import { withinReviewWindow } from "@/lib/triage/reviewWindow";

export const dynamic = "force-dynamic";
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = (await searchParams).period === "month" ? "month" : "week";
  const all = loadQueueRows();
  const rows = all.filter(row => withinReviewWindow(row.review));
  return <><AppHeader {...loadHeaderData(all)} currentPath="/insights" /><main>
    <div className="page-head"><h1>Weekly &amp; monthly signals</h1><p className="page-sub">Review the evidence, then choose where to focus.</p></div>
    <nav className="period-toggle" aria-label="Signal period">{(["week", "month"] as const).map(value => <Link key={value} href={`/insights?period=${value}`} className={`toggle-option ${period === value ? "toggle-active" : ""}`}>{value === "week" ? "Weekly" : "Monthly"}</Link>)}</nav>
    <DeskInsights rows={rows} period={period} />
  </main></>;
}
