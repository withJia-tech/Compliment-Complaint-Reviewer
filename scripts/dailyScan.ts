import { buildDefaultScanDeps } from "@/lib/scan/defaultDeps";
import { runDailyScan } from "@/lib/scan/runDailyScan";

async function main() {
  const result = await runDailyScan(buildDefaultScanDeps());
  console.log(`Scan complete: ${result.scanned} review(s) processed since ${result.since}`);
}

main().catch((error) => {
  console.error("Daily scan failed:", error);
  process.exitCode = 1;
});
