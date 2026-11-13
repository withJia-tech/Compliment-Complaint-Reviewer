import { describe, expect, it } from "vitest";
import { attentionExcerpt, dailyBrief, decisionHeading, decisionLabel, decisionMetrics, rowsInPeriod, type DeskRow } from "@/lib/desk/summary";
import { buildDemoDatasets } from "@/lib/demo/datasets";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import { aggregateByPeriod } from "@/lib/insights/aggregate";
import type { Review } from "@/lib/types";

const now = new Date("2026-11-13T08:00:00Z");
function row(id: string, text = "Wonderful coffee", stars: 1 | 2 | 3 | 4 | 5 = 5): DeskRow {
  const review = { id, text, stars, createTime:"2026-11-12T17:00:00Z", updateTime:"2026-11-12T17:00:00Z" };
  return { review, triage:new DefaultTriagePolicy().classify(review), draft:{ reviewId:id, text:"Thank you", factsUsed:[], templateId:"fixture", generatedAt:now.toISOString() } };
}
describe("owner daily brief and periodic signals", () => {
  it("shows the routed concern in a long review without fabricating a headline", () => {
    const daniel=buildDemoDatasets()[1].rows.find(item=>item.review.id==="dataset2_daniel")!;
    const excerpt=attentionExcerpt(daniel);
    expect(excerpt).toContain("broken glass");
    expect(daniel.review.text).toContain(excerpt.replace(/^…|…$/g,""));
  });
  it("keeps completed decisions out of workload while retaining new-today intake", () => {
    const done = { ...row("done"), approval:{reviewId:"done",actor:"test",status:"approved" as const} };
    expect(dailyBrief([done,row("open")],now)).toMatchObject({active:1,positive:1,newToday:2});
  });
  it("does not count a new review again as an update, and uses Singapore calendar days", () => {
    const updated=row("edited"); updated.review.createTime="2026-11-11T10:00:00Z";
    const created=row("new"); created.review.updateTime="2026-11-13T04:00:00Z";
    expect(dailyBrief([updated,created],now)).toMatchObject({newToday:1,updatedToday:1});
  });
  it("does not manufacture today's counts from screenshot ages", () => {
    const rows=buildDemoDatasets().find(dataset=>dataset.id==="dataset2")!.rows.filter(item=>!item.historical);
    expect(dailyBrief(rows,now)).toMatchObject({datedCount:0,unknownDates:2,newToday:0,updatedToday:0});
    expect(rowsInPeriod(rows,"month",now)).toEqual([]);
  });
  it("keeps sensitive, other high, medium and low groups disjoint", () => {
    const rows=[row("s","Food poisoning",2),row("h","Terrible food",1),row("m","Food was slow",3),row("l")];
    const brief=dailyBrief(rows,now), risk=decisionMetrics(rows).risk;
    expect(brief.now+brief.review+brief.positive).toBe(4);
    expect(Object.values(risk).reduce((a,b)=>a+b,0)).toBe(4);
    expect(risk.sensitive).toBe(1);
  });
  it("asks for delivery reconciliation ahead of another approval", () => {
    const uncertain={...row("uncertain"),approval:{reviewId:"uncertain",actor:"test",status:"publish_unknown" as const}};
    expect(decisionLabel(uncertain)).toBe("Check delivery outcome");
    expect(dailyBrief([row("safety","Food poisoning",2),uncertain],now).priority?.review.id).toBe("uncertain");
    expect(dailyBrief([uncertain],now)).toMatchObject({now:1,positive:0});
  });
  it("counts each recorded decision once and distinguishes edited approvals", () => {
    const statuses=["approved","edited_approved","no_response_required","rejected","publish_failed"] as const;
    const rows=statuses.map((status,i)=>({...row(String(i)),approval:{reviewId:String(i),actor:"test",status}}));
    expect(decisionMetrics(rows)).toMatchObject({total:5,awaiting:1,approved:2,edited:1,skipped:1,noResponse:1,failed:1});
    expect(decisionLabel(rows[0])).toBe("View decision");
    expect(decisionHeading(rows[1])).toBe("Decision recorded");
  });
  it("uses the local Monday and month boundaries for period membership", () => {
    const sunday=row("sunday"),monday=row("monday"),month=row("month");
    sunday.review.createTime="2026-11-08T15:59:59Z";
    monday.review.createTime="2026-11-08T16:00:00Z";
    month.review.createTime="2026-10-31T16:00:00Z";
    expect(rowsInPeriod([sunday,monday,month],"week",now).map(item=>item.review.id)).toEqual(["monday"]);
    expect(rowsInPeriod([sunday,monday,month],"month",now)).toHaveLength(3);
  });
  it("excludes invalid and future timestamps from time-based counts", () => {
    const future=row("future"),invalid=row("invalid"); future.review.createTime="2026-11-13T10:00:00Z";invalid.review.createTime="not-a-date";
    expect(dailyBrief([future,invalid],now)).toMatchObject({newToday:0,updatedToday:0,unknownDates:1});
    expect(rowsInPeriod([future,invalid],"month",now)).toEqual([]);
  });
  it("keeps an empty queue empty without selecting a synthetic priority", () => {
    expect(dailyBrief([],now)).toMatchObject({active:0,now:0,review:0,positive:0,priority:undefined});
  });
  it("keeps the history buckets consistent with the Singapore period filters", () => {
    const item=row("boundary"); item.review.createTime="2026-10-31T16:00:00Z";
    expect(aggregateByPeriod([{review:item.review as Review,triage:item.triage}],"month","Asia/Singapore")[0].key).toBe("2026-11-01");
  });
});
