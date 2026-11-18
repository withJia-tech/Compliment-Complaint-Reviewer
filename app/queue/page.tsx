import Link from "next/link";
import businessFacts from "@/data/fixtures/businessFacts.json";
import { withinReviewWindow } from "@/lib/triage/reviewWindow";
import { AppHeader } from "@/app/components/AppHeader";
import { QueueRow } from "@/app/components/QueueRow";
import { DailyBrief } from "@/app/components/DailyBrief";
import { isDecided, deliveryUncertain } from "@/lib/desk/summary";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";
import { REASON_CODE_EXPLANATIONS } from "@/lib/triage/explain";
import type { ApprovedBusinessFacts } from "@/lib/types";

export const dynamic = "force-dynamic";
export default async function QueuePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const showCompleted = (await searchParams).view === "completed";
  const all = loadQueueRows();
  const header = loadHeaderData(all);
  const current = all.filter(row => withinReviewWindow(row.review) || deliveryUncertain(row));
  const rows = showCompleted ? all.filter(isDecided) : current.filter(row => !isDecided(row));
  return <><AppHeader {...header} currentPath="/queue" /><main>
    <DailyBrief rows={current} />
    <section id="review-queue" className="queue-section" tabIndex={-1}>
      <div className="page-head"><h1>{showCompleted ? "Completed decisions" : "Your review queue"}</h1><p className="page-sub">{showCompleted ? "Review the decision and the wording that was saved." : "Past six months · sensitive concerns first. Every send needs your approval."}</p><nav className="period-toggle" aria-label="Queue view"><Link className={`toggle-option ${!showCompleted ? "toggle-active" : ""}`} href="/queue">Active</Link><Link className={`toggle-option ${showCompleted ? "toggle-active" : ""}`} href="/queue?view=completed">Completed</Link></nav></div>
      {rows.length === 0 ? <p className="desk-empty">{showCompleted ? "No completed decisions yet." : "Nothing waiting on you. Completed decisions remain available."}</p> : rows.map(row => <QueueRow key={row.review.id} {...row} version={row.version ?? ""} facts={businessFacts as ApprovedBusinessFacts} explanation={REASON_CODE_EXPLANATIONS[row.triage.reasonCodes[0]]} />)}
    </section>
  </main></>;
}
