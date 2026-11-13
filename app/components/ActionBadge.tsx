import type { RecommendedAction } from "@/lib/types";

const LABELS: Record<RecommendedAction, string> = {
  quick_approve: "Quick approve",
  needs_review: "Needs review",
};

export function ActionBadge({ action }: { action: RecommendedAction }) {
  return <span className={`badge badge-action-${action}`}>{LABELS[action]}</span>;
}
