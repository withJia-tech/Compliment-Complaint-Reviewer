import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildDemoDatasets } from "../lib/demo/datasets";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BehindTheHood } from "../app/components/BehindTheHood";

async function main() {
  // Frozen comparison cohort: the same build and cases on all three hosts.
  const asOf = new Date("2026-11-13T00:00:00.000Z");
  const datasets = buildDemoDatasets(asOf);
  const out = path.resolve('comparison/dist');
  fs.mkdirSync(out, { recursive: true });
  await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {HostedDemo} from './app/hosted-demo/sandbox'; createRoot(document.getElementById('root')!).render(<HostedDemo engineeringHref="./demo-behindthehood/" datasets={${JSON.stringify(datasets)}} />);`, resolveDir:process.cwd(), loader:'tsx' }, outfile:path.join(out,'app.js'), bundle:true, minify:true, jsx:'automatic', platform:'browser', define:{'process.env.NODE_ENV':'"production"'}, tsconfig:'tsconfig.json', logLevel:'warning' });
  fs.copyFileSync('app/globals.css',path.join(out,'app.css'));
  const companion = renderToStaticMarkup(createElement(BehindTheHood, { demoHref: "../", buildManifestHref: "../build.json" }));
  fs.mkdirSync(path.join(out, 'demo-behindthehood'), { recursive: true });
  fs.writeFileSync(path.join(out, 'demo-behindthehood/index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Behind the hood · Review Desk</title><meta name="description" content="Engineering evidence, decision rubrics and controlled execution boundaries for the Review Desk demo."><link rel="stylesheet" href="../app.css"></head><body><div class="app-shell">${companion}</div></body></html>`);
  const digest = createHash('sha256').update(fs.readFileSync(path.join(out,'app.js'))).update(fs.readFileSync(path.join(out,'app.css'))).update(fs.readFileSync(path.join(out,'demo-behindthehood/index.html'))).digest('hex');
  fs.writeFileSync(path.join(out,'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Review Desk</title><meta name="description" content="Review examples with human decisions. Demonstration only; no publishing."><link rel="stylesheet" href="./app.css"></head><body><div class="app-shell"><div id="root"></div></div><script src="./app.js" defer></script></body></html>`);
  fs.writeFileSync(path.join(out,'build.json'),JSON.stringify({sha256:digest,asOf:asOf.toISOString(),cases:datasets.reduce((count, dataset) => count + dataset.rows.length, 0),datasets:datasets.map(dataset => ({id:dataset.id,cases:dataset.rows.length,active:dataset.rows.filter(row => !row.historical).length,historical:dataset.rows.filter(row => row.historical).length}))},null,2));
  fs.writeFileSync(path.join(out,'.nojekyll'),'');
  console.log(`Comparison build ${digest}; ${datasets.length} datasets; ${out}`);
}
main().catch(error => { console.error(error); process.exitCode=1; });
