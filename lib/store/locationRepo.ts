import { readJson, writeJson } from "@/lib/store/jsonStore";
import type { LocationSettings } from "@/lib/types";

const FILE = "location.json";

function defaultSettings(locationId: string): LocationSettings {
  return {
    locationId,
    connected: true,
    autoPublishConsent: false,
    lastSuccessfulScanAt: null,
  };
}

export const locationRepo = {
  get(locationId: string): LocationSettings {
    const current = readJson<LocationSettings | null>(FILE, null);
    return current ?? defaultSettings(locationId);
  },
  update(locationId: string, patch: Partial<LocationSettings>): LocationSettings {
    const next = { ...locationRepo.get(locationId), ...patch };
    writeJson(FILE, next);
    return next;
  },
};
