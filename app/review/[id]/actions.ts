"use server";

import { revalidatePath } from "next/cache";
import { recordRemedy, type DecisionResult } from "@/lib/decisions";
import type { RemedyChannel } from "@/lib/types";

const CHANNELS: RemedyChannel[] = ["email", "whatsapp", "phone", "in_person"];

function revalidate(reviewId: string) {
  revalidatePath(`/review/${reviewId}`);
  revalidatePath("/queue");
  revalidatePath("/insights");
}

/**
 * Records a goodwill remedy that was settled outside this app. Nothing is
 * sent from here — this only writes the internal note into the audit trail.
 */
export async function recordRemedyAction(
  reviewId: string,
  formData: FormData,
): Promise<DecisionResult> {
  const note = String(formData.get("note") ?? "").trim();
  if (note.length === 0)
    return {
      ok: false,
      reason: "validation_failed",
      issues: ["Enter an internal note."],
    };

  const rawChannel = String(formData.get("channel") ?? "email");
  const channel = (CHANNELS as string[]).includes(rawChannel)
    ? (rawChannel as RemedyChannel)
    : "email";

  const result = recordRemedy(reviewId, { note, channel });
  revalidate(reviewId);
  return result;
}
