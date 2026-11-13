"use server";

import type { SendConfirmation } from "@/lib/approval/context";
import { revalidatePath } from "next/cache";
import {
  type DecisionResult,
  noResponseRequired,
  sendReply,
  reconcileReply,
} from "@/lib/decisions";
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
export async function sendReplyAction(
  reviewId: string,
  text: string,
  confirmation: SendConfirmation,
): Promise<DecisionResult> {
  const result = await sendReply(reviewId, text, confirmation);
  // Keep a stale/invalid editor mounted so its refusal remains visible.
  if (
    result.ok ||
    !["stale_context", "validation_failed", "confirmation_required"].includes(
      result.reason,
    )
  )
    revalidateAll(reviewId);
  return result;
}

export async function noResponseRequiredAction(
  reviewId: string,
  confirmation: SendConfirmation,
): Promise<DecisionResult> {
  const result = noResponseRequired(reviewId, confirmation);
  revalidateAll(reviewId);
  return result;
}

export async function reconcileReplyAction(
  reviewId: string,
): Promise<DecisionResult> {
  const result = await reconcileReply(reviewId);
  revalidateAll(reviewId);
  return result;
}
