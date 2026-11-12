"use server";

import { revalidatePath } from "next/cache";
import { recordRemedy, rejectReply, sendReply } from "@/lib/decisions";
import type { RemedyChannel } from "@/lib/types";

const CHANNELS: RemedyChannel[] = ["email", "whatsapp", "phone", "in_person"];

function revalidate(reviewId: string) {
  revalidatePath(`/review/${reviewId}`);
  revalidatePath("/queue");
  revalidatePath("/insights");
}

export async function sendReplyFromDetailAction(reviewId: string, formData: FormData) {
  await sendReply(reviewId, String(formData.get("replyText") ?? ""));
  revalidate(reviewId);
}

export async function rejectAction(reviewId: string, formData: FormData) {
  rejectReply(reviewId, String(formData.get("reason") ?? ""));
  revalidate(reviewId);
}

/**
 * Records a goodwill remedy that was settled outside this app. Nothing is
 * sent from here — this only writes the internal note into the audit trail.
 */
export async function recordRemedyAction(reviewId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  if (note.length === 0) return;

  const rawChannel = String(formData.get("channel") ?? "email");
  const channel = (CHANNELS as string[]).includes(rawChannel)
    ? (rawChannel as RemedyChannel)
    : "email";

  recordRemedy(reviewId, { note, channel });
  revalidate(reviewId);
}
