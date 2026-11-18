import type { Approval, Draft, Review, TriageResult } from "@/lib/types";

export interface DeskRow {
  review: Pick<Review, "id" | "text" | "stars"> & Partial<Pick<Review, "createTime" | "updateTime">>;
  triage: TriageResult;
  draft: Draft | null;
  approval?: Approval | null;
}

export const isDecided = (row: DeskRow) => ["approved", "edited_approved", "no_response_required", "rejected"].includes(row.approval?.status ?? "");
export const deliveryUncertain = (row: DeskRow) => ["publishing", "publish_unknown"].includes(row.approval?.status ?? "");
const validDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
const day = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** Show an actual source excerpt around a routing hit, never an invented headline. */
export function attentionExcerpt(row: DeskRow, limit = 180): string {
  const text = row.review.text;
  if (text.length <= limit) return text;
  const hit = row.triage.matchedKeywords.map(keyword => keyword.replace(/\*$/, "")).find(keyword => keyword && text.toLowerCase().includes(keyword.toLowerCase()));
  const index = hit ? text.toLowerCase().indexOf(hit.toLowerCase()) : 0;
  const offset = Math.max(0, index - 55);
  const start = offset ? text.lastIndexOf(" ", offset) + 1 : 0;
  const edge = Math.min(text.length, start + limit);
  const boundary = text.lastIndexOf(" ", edge);
  const end = edge < text.length && boundary > index ? boundary : edge;
  return `${start ? "…" : ""}${text.slice(start, end)}${text.length > end ? "…" : ""}`;
}

export function decisionLabel(row: DeskRow): string {
  if (isDecided(row)) return "View decision";
  if (deliveryUncertain(row)) return "Check delivery outcome";
  if (!row.draft) return "View review";
  return row.triage.riskLevel === "low" && !row.triage.sensitive ? "Review thank-you" : "Review & approve";
}

export function decisionHeading(row: DeskRow): string {
  if (isDecided(row)) return "Decision recorded";
  if (deliveryUncertain(row)) return "Delivery unconfirmed · check outcome";
  if (row.triage.sensitive) return "Sensitive · approval required";
  return row.triage.riskLevel === "low" ? "Positive · reply optional" : "Needs review";
}

export function dailyBrief(rows: DeskRow[], now = new Date(), timeZone = "Asia/Singapore") {
  const active = rows.filter(row => !isDecided(row));
  const rank = (row: DeskRow) => deliveryUncertain(row) ? 0 : row.triage.sensitive ? 1 : row.triage.riskLevel === "high" ? 2 : row.triage.riskLevel === "medium" ? 3 : 4;
  const priority = [...active].sort((a, b) => rank(a) - rank(b) || (validDate(b.review.createTime)?.getTime() ?? 0) - (validDate(a.review.createTime)?.getTime() ?? 0))[0];
  let newToday = 0, updatedToday = 0, unknownDates = 0;
  for (const { review } of rows) {
    const created = validDate(review.createTime), updated = validDate(review.updateTime);
    if (!created) { unknownDates++; continue; }
    if (created > now) continue;
    if (day(created, timeZone) === day(now, timeZone)) newToday++;
    else if (updated && updated <= now && updated > created && day(updated, timeZone) === day(now, timeZone)) updatedToday++;
  }
  const nowCount = active.filter(row => deliveryUncertain(row) || row.triage.sensitive || row.triage.riskLevel === "high").length;
  const positives = active.filter(row => !deliveryUncertain(row) && !row.triage.sensitive && row.triage.riskLevel === "low").length;
  return { active: active.length, now: nowCount, review: active.length - nowCount - positives, positive: positives, priority,
    newToday, updatedToday, unknownDates, datedCount: rows.length - unknownDates };
}

export function rowsInPeriod(rows: DeskRow[], period: "week" | "month", now: Date, timeZone = "Asia/Singapore"): DeskRow[] {
  const today = day(now, timeZone);
  const start = new Date(`${today}T00:00:00Z`);
  if (period === "month") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const startDay = start.toISOString().slice(0, 10);
  return rows.filter(row => {
    const date = validDate(row.review.createTime);
    return date && date <= now && day(date, timeZone) >= startDay && day(date, timeZone) <= today;
  });
}

export function decisionMetrics(rows: DeskRow[]) {
  const status = (value: string) => rows.filter(row => row.approval?.status === value).length;
  return {
    total: rows.length, awaiting: rows.filter(row => !isDecided(row)).length,
    approved: status("approved") + status("edited_approved"), skipped: status("rejected"), noResponse: status("no_response_required"),
    edited: status("edited_approved"), failed: status("publish_failed"), uncertain: rows.filter(deliveryUncertain).length,
    risk: {
      sensitive: rows.filter(row => row.triage.sensitive).length,
      high: rows.filter(row => !row.triage.sensitive && row.triage.riskLevel === "high").length,
      medium: rows.filter(row => !row.triage.sensitive && row.triage.riskLevel === "medium").length,
      low: rows.filter(row => !row.triage.sensitive && row.triage.riskLevel === "low").length,
    },
  };
}
