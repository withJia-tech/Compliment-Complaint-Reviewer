"use server";

import { revalidatePath } from "next/cache";
import { locationRepo } from "@/lib/store/locationRepo";
import { DEFAULT_LOCATION_ID } from "@/lib/types";

export async function toggleConsentAction(formData: FormData) {
  const next = formData.get("next") === "true";
  locationRepo.update(DEFAULT_LOCATION_ID, { autoPublishConsent: next });
  revalidatePath("/settings");
  revalidatePath("/queue");
  revalidatePath("/insights");
}
