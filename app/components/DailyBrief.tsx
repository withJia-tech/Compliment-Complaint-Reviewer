import { attentionExcerpt, dailyBrief, deliveryUncertain, type DeskRow } from "@/lib/desk/summary";

export function DailyBrief({ rows, asOf, onOpen }: { rows: DeskRow[]; asOf?: string; onOpen?: () => void }) {
  const brief = dailyBrief(rows, asOf ? new Date(asOf) : new Date());
  const priority = brief.priority;
  return <section className="daily-brief" aria-labelledby="daily-brief-title">
    <div className="brief-top"><h2 id="daily-brief-title">Today’s review desk</h2><span>{brief.datedCount ? `${brief.newToday} new today · ${brief.updatedToday} updated today` : `${brief.active} active · review dates unavailable`}{brief.datedCount > 0 && brief.unknownDates > 0 ? ` · ${brief.unknownDates} undated` : ""}</span></div>
    <p className="brief-counts"><strong>{brief.now}</strong> {brief.now === 1 ? "needs" : "need"} attention now <span>·</span> <strong>{brief.review}</strong> {brief.review === 1 ? "needs" : "need"} review <span>·</span> <strong>{brief.positive}</strong> positive</p>
    {priority ? <><p className="brief-priority"><strong>Highest priority:</strong> {priority.review.stars}-star review — “{attentionExcerpt(priority)}”</p><p className="brief-context">{deliveryUncertain(priority) ? "Delivery is unconfirmed. Check the outcome before any retry." : priority.triage.sensitive ? "Sensitive customer account — check the facts. Approval required." : "Check the review and draft before deciding. Every send needs your approval."}</p></> : <p className="brief-priority">All caught up. Completed decisions remain available below.</p>}
    {onOpen ? <button className="btn-secondary" onClick={onOpen}>Open queue</button> : <a className="button-link btn-secondary" href="/queue#review-queue">Open queue</a>}
  </section>;
}
