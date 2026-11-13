"use client";
import { useState, useTransition } from "react";
import { recordRemedyAction } from "@/app/review/[id]/actions";
import { refusalMessage } from "@/lib/approval/presentation";

export function RemedyForm({ reviewId }: { reviewId: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="remedy-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            const result = await recordRemedyAction(reviewId, data);
            setNotice(
              result.ok
                ? "Internal note recorded. Nothing was sent."
                : refusalMessage(result),
            );
          } catch {
            setNotice(
              "The note could not be confirmed. Refresh to check before trying again.",
            );
          }
        });
      }}
    >
      <input
        name="note"
        type="text"
        placeholder="e.g. offered a £10 voucher"
        required
        disabled={pending}
      />
      <select name="channel" defaultValue="email" disabled={pending}>
        <option value="email">Email</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="phone">Phone</option>
        <option value="in_person">In person</option>
      </select>
      <button type="submit" className="btn-secondary" disabled={pending}>
        Record remedy
      </button>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
