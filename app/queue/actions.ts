"use server";

import { revalidatePath } from "next/cache";
import { rejectReply, sendReply } from "@/lib/decisions";
import { buildDefaultScanDeps } from "@/lib/scan/defaultDeps";
import { runDailyScan } from "@/lib/scan/runDailyScan";

function revalidateAll(reviewId?: string) {
  revalidatePath("/queue");
  revalidatePath("/insights");
  if (reviewId) revalidatePath(`/review/${reviewId}`);
}

export async function runScanAction() {
  await runDailyScan(buildDefaultScanDeps());
  revalidateAll();
}

/** Send the reply straight from the queue, with any inline edits applied. */
export async function sendReplyAction(reviewId: string, text: string) {
  await sendReply(reviewId, text);
  revalidateAll(reviewId);
}

export async function rejectInlineAction(reviewId: string) {
  rejectReply(reviewId);
  revalidateAll(reviewId);
}
