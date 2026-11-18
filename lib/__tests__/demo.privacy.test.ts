import { expect, it } from "vitest";
import source from "@/data/demo/dataset2.json";
import { buildDemoDatasets } from "@/lib/demo/datasets";

const aliases = ["Da**** F**", "N** E** S*** (O***)", "** *", "Li** V**", "Dw**** L****"];

it("uses the approved reviewer aliases in source data and rendered demo rows", () => {
  expect(source.cases.map(item => item.author)).toEqual(aliases);
  const rows = buildDemoDatasets().find(item => item.id === "dataset2")!.rows;
  for (const item of source.cases) {
    expect(rows.find(row => row.review.id === item.id)?.review.author).toBe(item.author);
  }
});

it("masks names inside quoted replies and personalised drafts as well as author labels", () => {
  const cases = source.cases;
  expect(cases[0].ownerReply.text).toMatch(/^Dear Da\*{4} F\*{2},/);
  expect(cases[1].ownerReply.text).toMatch(/^Hi N\*{2} E\*{2} S\*{3} \(O\*{3}\),/);
  expect(cases[3].ownerReply.text).toMatch(/^Dear V\*{4},/);
  expect(cases[4].ownerReply.text).toMatch(/^Hi Dw\*{4} L\*{4},/);
  expect(cases[0].proposedReply).toContain(", Da****.");
  expect(cases[4].proposedReply).toContain(", Dw****.");
  expect(cases[3].discoveryChecks[2]).toBe("The source reply uses a different name from the displayed reviewer; do not infer their identity.");
});

it("versions the derivative dataset and uses opaque case ids without changing source provenance", () => {
  expect(source.version).toBe("dataset2-v2-name-masked");
  expect(source.cases.map(item => item.id)).toEqual(
    [1, 2, 3, 4, 5].map(n => `dataset2_case_${String(n).padStart(3, "0")}`),
  );
  expect(new Set(source.cases.map(item => item.author)).size).toBe(5);
  for (const item of source.cases) {
    expect(item.sourceFiles).toHaveLength(2);
    expect(item.sourceFiles.every(file => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  }
});
