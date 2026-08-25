export function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <span className="confidence-meter" title={`${pct}% confidence`}>
      <span className="confidence-fill" style={{ width: `${pct}%` }} />
      <span className="confidence-label">{pct}%</span>
    </span>
  );
}
