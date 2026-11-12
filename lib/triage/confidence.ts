export type ConfidenceBand = "Strong" | "Moderate" | "Weak";

/**
 * Confidence is one of a handful of fixed values attached to each rule
 * branch, not a measurement — showing it as "90%" implied a precision the
 * keyword rules don't have. This collapses it to the three bands the value
 * actually distinguishes.
 */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.85) return "Strong";
  if (confidence >= 0.7) return "Moderate";
  return "Weak";
}
