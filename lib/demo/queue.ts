import type { DemoRow, DemoOutcome, DemoView } from "./datasets";

export function rowsForView(rows: DemoRow[], outcomes: Record<string, DemoOutcome>, view: DemoView): DemoRow[] {
  return rows.filter(row => view === "historical" ? row.historical : !row.historical && (view === "completed" ? !!outcomes[row.review.id] : !outcomes[row.review.id]));
}
