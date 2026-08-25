"use server";

import { revalidatePath } from "next/cache";
import { buildDefaultScanDeps } from "@/lib/scan/defaultDeps";
import { runDailyScan } from "@/lib/scan/runDailyScan";

export async function runScanAction() {
  await runDailyScan(buildDefaultScanDeps());
  revalidatePath("/queue");
}
