import type { Review, ReviewTheme, TriageResult } from "@/lib/types";

export type Period = "week" | "month";

export interface ThemeStats {
  theme: ReviewTheme;
  count: number;
  averageStars: number | null;
  /** Reviews in this theme that needed a human decision (medium or high risk). */
  needsAttention: number;
}

export interface PeriodBucket {
  /** ISO date of the period start — Monday for weeks, the 1st for months. */
  key: string;
  label: string;
  reviewCount: number;
  averageStars: number | null;
  sensitiveCount: number;
  themes: ThemeStats[];
}

const THEME_ORDER: ReviewTheme[] = ["food", "service", "atmosphere"];

export const THEME_LABELS: Record<ReviewTheme, string> = {
  food: "Food",
  service: "Service",
  atmosphere: "Atmosphere",
};

function startOfPeriod(date: Date, period: Period): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (period === "month") {
    d.setUTCDate(1);
    return d;
  }
  // Week starts Monday: getUTCDay() is 0 for Sunday.
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday);
  return d;
}

function formatLabel(start: Date, period: Period): string {
  if (period === "month") {
    return start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/**
 * Rolls the reviews already held in the store up into weekly or monthly
 * buckets, split by the Food / Service / Atmosphere themes triage assigned.
 *
 * This aggregates what has already been ingested — it does not add any new
 * long-term storage of review content.
 */
export function aggregateByPeriod(
  rows: Array<{ review: Review; triage: TriageResult }>,
  period: Period,
): PeriodBucket[] {
  const buckets = new Map<string, Array<{ review: Review; triage: TriageResult }>>();

  for (const row of rows) {
    const start = startOfPeriod(new Date(row.review.createTime), period);
    const key = start.toISOString().slice(0, 10);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label: formatLabel(new Date(`${key}T00:00:00Z`), period),
      reviewCount: items.length,
      averageStars: mean(items.map((item) => item.review.stars)),
      sensitiveCount: items.filter((item) => item.triage.sensitive).length,
      themes: THEME_ORDER.map((theme) => {
        const themed = items.filter((item) => item.triage.themes.includes(theme));
        return {
          theme,
          count: themed.length,
          averageStars: mean(themed.map((item) => item.review.stars)),
          needsAttention: themed.filter((item) => item.triage.riskLevel !== "low").length,
        };
      }),
    }));
}
