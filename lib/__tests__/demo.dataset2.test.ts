import { describe, expect, it } from "vitest";
import { buildDemoDatasets, canPractiseRecentCase, classifyDataset2, DATASET2_POLICY } from "@/lib/demo/datasets";
import { rowsForView } from "@/lib/demo/queue";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { validateReply } from "@/lib/validation/reply";

const datasets = buildDemoDatasets();
const dataset = datasets.find(item => item.id === "dataset2")!;
const byId = (id: string) => dataset.rows.find(row => row.review.id === `dataset2_${id}`)!;

describe("screenshot dataset boundaries", () => {
  it("keeps five paired cases, two recent practice cases and three historical cases", () => {
    expect(dataset.rows).toHaveLength(5);
    expect(rowsForView(dataset.rows, {}, "active").map(row => row.review.id)).toEqual(["dataset2_daniel", "dataset2_neo"]);
    expect(rowsForView(dataset.rows, {}, "historical")).toHaveLength(3);
    for (const row of dataset.rows) {
      expect(row.source?.sourceDate.exactDate).toBeNull();
      expect(row.source?.sourceFiles.map(file => file.role)).toEqual(["customer_review", "owner_reply"]);
      expect(row.source?.sourceFiles.every(file => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
      expect(row.review).not.toHaveProperty("createTime");
      expect(row.source?.ownerReply.text).toBeTruthy();
    }
  });
  it("does not use recent edits or ambiguous six-month ages as proof of recent publication", () => {
    const source = byId("daniel").source!;
    expect(canPractiseRecentCase({...source, sourceDate:{...source.sourceDate,kind:"edited",ageMonthsAtCapture:1}})).toBe(false);
    expect(canPractiseRecentCase({...source, sourceDate:{...source.sourceDate,ageMonthsAtCapture:6}})).toBe(false);
    expect(canPractiseRecentCase({...source, sourceDate:{...source.sourceDate,ageMonthsAtCapture:-1}})).toBe(false);
  });
  it("keeps a no-response decision in Completed and isolates datasets", () => {
    const outcomes = {dataset2_daniel:{status:"no_response" as const,text:"Reviewed",decidedAt:"2026-11-13T00:00:00Z"}};
    expect(rowsForView(dataset.rows,outcomes,"active").map(row => row.review.id)).toEqual(["dataset2_neo"]);
    expect(rowsForView(dataset.rows,outcomes,"completed").map(row => row.review.id)).toEqual(["dataset2_daniel"]);
    expect(rowsForView(datasets[0].rows,outcomes,"active")).toHaveLength(11);
    expect(rowsForView(dataset.rows,outcomes,"historical")).toHaveLength(3);
  });
  it("keeps historical replies and claims out of the approved facts and proposed drafts", () => {
    expect(dataset.facts.facts).toEqual([]);
    for (const row of dataset.rows) {
      expect(row.draft.factsUsed).toEqual([]);
      expect(row.draft.text).not.toBe(row.source?.ownerReply.text);
      expect(row.draft.text).not.toMatch(/enquiries@|go\.momos|within 3 working days|555/);
      expect(validateReply(row.draft.text)).toEqual([]);
      expect(row.source!.discoveryChecks.length).toBeLessThanOrEqual(3);
    }
    expect(byId("dwayne").draft.text).toMatch(/sausage and potatoes/);
    expect(byId("neo").draft.text).toMatch(/cream shio pan/);
    expect(byId("lind").draft.text).toMatch(/rather than price alone/);
    expect(byId("neo").source?.subratings).toBeNull();
  });
});

describe("unpromoted dataset-two classifier candidate", () => {
  it("prioritises the broken-glass account as safety even with a high star rating", () => {
    const review = {id:"probe",stars:5 as const,text:"I spotted a piece of broken glass near the water dispenser."};
    expect(classifyDataset2(review)).toMatchObject({policyVersion:DATASET2_POLICY,riskLevel:"high",sensitive:true,reasonCodes:["sensitive_safety"]});
    // Adding a demonstration candidate does not silently promote the production policy.
    expect(new DefaultTriagePolicy().classify(review)).toMatchObject({policyVersion:"policy-v1.0.0",sensitive:false});
  });
  it("routes the missing-items refund request without inferring compensation rights", () => {
    expect(byId("neo").triage).toMatchObject({sensitive:true,reasonCodes:["sensitive_compensation"]});
    expect(byId("neo").draft.text).not.toMatch(/refund|reimburse|compensat|discount/);
  });
  it("does not classify owner promises or reviewer metadata as customer evidence", () => {
    const review = byId("psm").review;
    expect(classifyDataset2({...review,author:"Someone else",ownerReply:"broken glass compensation lawsuit"} as typeof review & {ownerReply:string})).toMatchObject({sensitive:false,reasonCodes:["negative_issue"]});
    expect(byId("lind").triage.reasonCodes).not.toContain("sensitive_fraud");
    expect(byId("daniel").triage.matchedKeywords).toContain("broken glass");
  });
});
