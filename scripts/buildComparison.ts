import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import reviews from "../data/fixtures/reviews.json";
import facts from "../data/fixtures/businessFacts.json";
import { DefaultTriagePolicy } from "../lib/triage/policy";
import { TemplateReplyDrafter } from "../lib/drafter/replyDrafter";
import { withinReviewWindow } from "../lib/triage/reviewWindow";
import type { Review, ApprovedBusinessFacts } from "../lib/types";

async function main() {
  // Frozen comparison cohort: the same build and cases on all three hosts.
  const asOf = new Date("2026-11-13T00:00:00.000Z");
  const policy = new DefaultTriagePolicy();
  const drafter = new TemplateReplyDrafter();
  const rows = (reviews as Review[]).filter(review => withinReviewWindow(review, asOf)).map(review => {
    const triage = {...policy.classify(review), computedAt: asOf.toISOString()};
    return {review, triage, draft: {...drafter.draft(review, triage, facts as ApprovedBusinessFacts), generatedAt: asOf.toISOString()}};
  }).sort((a,b) => Number(b.triage.sensitive)-Number(a.triage.sensitive) || ({high:0,medium:1,low:2}[a.triage.riskLevel]-{high:0,medium:1,low:2}[b.triage.riskLevel]) || Date.parse(b.review.createTime)-Date.parse(a.review.createTime));
  const out = path.resolve('comparison/dist');
  fs.mkdirSync(out, { recursive: true });
  await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {HostedDemo} from './app/hosted-demo/sandbox'; createRoot(document.getElementById('root')!).render(<HostedDemo rows={${JSON.stringify(rows)}} facts={${JSON.stringify(facts)}} />);`, resolveDir:process.cwd(), loader:'tsx' }, outfile:path.join(out,'app.js'), bundle:true, minify:true, jsx:'automatic', platform:'browser', define:{'process.env.NODE_ENV':'"production"'}, tsconfig:'tsconfig.json', logLevel:'warning' });
  fs.copyFileSync('app/globals.css',path.join(out,'app.css'));
  const digest = createHash('sha256').update(fs.readFileSync(path.join(out,'app.js'))).update(fs.readFileSync(path.join(out,'app.css'))).digest('hex');
  fs.writeFileSync(path.join(out,'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Review Desk</title><meta name="description" content="Synthetic six-month review queue. Explicit human decisions; no real publishing."><link rel="stylesheet" href="./app.css"></head><body><div class="app-shell"><div id="root"></div></div><script src="./app.js" defer></script></body></html>`);
  fs.writeFileSync(path.join(out,'build.json'),JSON.stringify({sha256:digest,asOf:asOf.toISOString(),cases:rows.length},null,2));
  fs.writeFileSync(path.join(out,'.nojekyll'),'');
  console.log(`Comparison build ${digest}; ${rows.length} synthetic reviews; ${out}`);
}
main().catch(error => { console.error(error); process.exitCode=1; });
