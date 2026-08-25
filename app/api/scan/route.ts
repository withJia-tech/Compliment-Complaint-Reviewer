import { NextResponse } from "next/server";
import { buildDefaultScanDeps } from "@/lib/scan/defaultDeps";
import { runDailyScan } from "@/lib/scan/runDailyScan";

export async function POST() {
  const result = await runDailyScan(buildDefaultScanDeps());
  return NextResponse.json(result);
}
