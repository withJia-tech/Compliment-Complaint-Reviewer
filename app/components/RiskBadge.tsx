import type { RiskLevel } from "@/lib/types";

const LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  escalate: "Escalated",
};

export function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  return <span className={`badge badge-risk-${riskLevel}`}>{LABELS[riskLevel]}</span>;
}
