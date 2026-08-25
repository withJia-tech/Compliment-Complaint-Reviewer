import type { RiskLevel } from "@/lib/types";

const LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function RiskBadge({ riskLevel, sensitive }: { riskLevel: RiskLevel; sensitive?: boolean }) {
  return (
    <span className="badge-group">
      <span className={`badge badge-risk-${riskLevel}`}>{LABELS[riskLevel]}</span>
      {sensitive && <span className="badge badge-sensitive">Sensitive</span>}
    </span>
  );
}
