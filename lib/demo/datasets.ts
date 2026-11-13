import reviews from "@/data/fixtures/reviews.json";
import facts from "@/data/fixtures/businessFacts.json";
import screenshotData from "@/data/demo/dataset2.json";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { findHits } from "@/lib/triage/match";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import { withinReviewWindow } from "@/lib/triage/reviewWindow";
import type { ApprovedBusinessFacts, Draft, Review, TriageResult } from "@/lib/types";
import type { ClassificationInput } from "@/lib/interfaces/triagePolicy";

export const DATASET2_POLICY = "demo-candidate-v1.1.0";
export interface ScreenshotCase {
  id: string;
  businessName: string;
  author: string;
  stars: Review['stars'];
  text: string;
  sourceDate: { label: string; ageMonthsAtCapture: number; kind: string; exactDate: null };
  subratings: { food: number; service: number; atmosphere: number } | null;
  ownerReply: { author: string; text: string; dateLabel: string };
  sourceFiles: { file: string; role: string; sha256: string }[];
  discoveryChecks: string[];
  proposedReply: string;
}
export interface DemoRow {
  review: ClassificationInput & { author: string };
  dateLabel: string;
  historical: boolean;
  /** Ascending within each risk band. Never converted into an exact review timestamp. */
  recencyOrder: number;
  triage: TriageResult;
  draft: Draft;
  source?: ScreenshotCase;
}
export interface DemoDataset {
  id: string;
  label: string;
  title: string;
  kind: "synthetic" | "screenshots";
  rows: DemoRow[];
  facts: ApprovedBusinessFacts;
}
export type DemoView = "active" | "completed" | "historical";
export type DemoOutcome = { status: "approved" | "no_response"; text: string; decidedAt: string };

/** Candidate only: the production DefaultTriagePolicy and threshold are unchanged. */
export function classifyDataset2(review: ClassificationInput): TriageResult {
  const baseline = new DefaultTriagePolicy().classify(review);
  const hits = findHits(review.text, ["broken glass"]);
  return hits.length ? { ...baseline, policyVersion: DATASET2_POLICY, sensitive: true,
    riskLevel: "high", recommendedAction: "needs_review", reasonCodes: ["sensitive_safety"],
    matchedKeywords: hits, confidence: 0.9 } : { ...baseline, policyVersion: DATASET2_POLICY };
}

export function canPractiseRecentCase(source: ScreenshotCase): boolean {
  // An edited date alone cannot establish the original publication date.
  return source.sourceDate.kind === "posted" && source.sourceDate.ageMonthsAtCapture >= 0 && source.sourceDate.ageMonthsAtCapture < 6;
}
function sortRows(rows: DemoRow[]) {
  return rows.sort((a,b) => Number(b.triage.sensitive)-Number(a.triage.sensitive) ||
    ({ high:0, medium:1, low:2 }[a.triage.riskLevel]-{ high:0, medium:1, low:2 }[b.triage.riskLevel]) || a.recencyOrder-b.recencyOrder);
}

export function buildDemoDatasets(asOf = new Date("2026-11-13T00:00:00.000Z")): DemoDataset[] {
  const policy = new DefaultTriagePolicy();
  const drafter = new TemplateReplyDrafter();
  const syntheticFacts = facts as ApprovedBusinessFacts;
  const syntheticRows: DemoRow[] = (reviews as Review[]).filter(review => withinReviewWindow(review, asOf)).map(review => {
    const triage = { ...policy.classify(review), computedAt: asOf.toISOString() };
    return { review: { id:review.id, author:review.author, stars:review.stars, text:review.text }, triage,
      dateLabel:new Date(review.createTime).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}),
      historical:false, recencyOrder:-Date.parse(review.createTime),
      draft:{...drafter.draft(review, triage, syntheticFacts),generatedAt:asOf.toISOString()} };
  });
  const screenshotRows: DemoRow[] = (screenshotData.cases as ScreenshotCase[]).map(source => {
    const review = { id:source.id, author:source.author, stars:source.stars, text:source.text };
    return { review, source, dateLabel:source.sourceDate.label, historical:!canPractiseRecentCase(source), recencyOrder:source.sourceDate.ageMonthsAtCapture,
      triage: { ...classifyDataset2(review), computedAt:asOf.toISOString() },
      draft:{reviewId:source.id,text:source.proposedReply,factsUsed:[],templateId:"dataset2-editorial-v1",generatedAt:asOf.toISOString()} };
  });
  return [
    { id:"dataset1", label:"Dataset 1 · sample reviews", title:syntheticFacts.businessName, kind:"synthetic", facts:syntheticFacts, rows:sortRows(syntheticRows) },
    { id:"dataset2", label:"Dataset 2 · real review examples", title:screenshotData.businessName, kind:"screenshots", facts:{locationId:"case-study-tiong-bahru",businessName:screenshotData.businessName,facts:[]}, rows:sortRows(screenshotRows) },
  ];
}
