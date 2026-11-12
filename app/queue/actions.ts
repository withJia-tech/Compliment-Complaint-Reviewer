"use server";

import { revalidatePath } from "next/cache";
import { type DecisionResult, rejectReply, sendReply } from "@/lib/decisions";
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

/**
 * Send the reply straight from the queue, with any inline edits applied.
 * Returns the outcome rather than throwing: a refusal (already decided, or a
 * send in progress) is an expected result the row needs to show.
 */
export async function sendReplyAction(reviewId: string, text: string): Promise<DecisionResult> {
  const result = await sendReply(reviewId, text);
  revalidateAll(reviewId);
  return result;
}

export async function rejectInlineAction(reviewId: string): Promise<DecisionResult> {
  const result = rejectReply(reviewId);
  revalidateAll(reviewId);
  return result;
}
