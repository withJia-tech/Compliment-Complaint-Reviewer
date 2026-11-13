import { withinReviewWindow } from "@/lib/triage/reviewWindow";
import reviews from "@/data/fixtures/reviews.json";
import facts from "@/data/fixtures/businessFacts.json";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import type { Review, ApprovedBusinessFacts } from "@/lib/types";
import { HostedDemo } from "./sandbox";

export default function HostedDemoPage() {
  const policy = new DefaultTriagePolicy();
  const drafter = new TemplateReplyDrafter();
  const rows = (reviews as Review[]).filter(review => withinReviewWindow(review)).map(review => {
    const triage = policy.classify(review);
    return { review, triage, draft: drafter.draft(review, triage, facts as ApprovedBusinessFacts) };
  }).sort((a, b) => Number(b.triage.sensitive) - Number(a.triage.sensitive) ||
    ({high: 0, medium: 1, low: 2}[a.triage.riskLevel] - {high: 0, medium: 1, low: 2}[b.triage.riskLevel]) || Date.parse(b.review.createTime) - Date.parse(a.review.createTime));
  return <HostedDemo rows={rows} facts={facts as ApprovedBusinessFacts} />;
}
