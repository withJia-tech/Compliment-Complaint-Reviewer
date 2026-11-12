import type { RecommendedAction } from "@/lib/types";

const LABELS: Record<RecommendedAction, string> = {
  auto_publish_eligible: "Auto",
  approval_required: "Needs approval",
};

export function ActionBadge({ action }: { action: RecommendedAction }) {
  return <span className={`badge badge-action-${action}`}>{LABELS[action]}</span>;
}
