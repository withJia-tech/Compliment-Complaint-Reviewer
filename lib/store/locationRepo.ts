import { readJson, writeJson } from "@/lib/store/jsonStore";
import { locationCheck } from "@/lib/store/schema";
import type { LocationSettings } from "@/lib/types";

const FILE = "location.json";

function defaultSettings(locationId: string): LocationSettings {
  return {
    locationId,
    connected: true,
    lastSuccessfulScanAt: null,
  };
}

export const locationRepo = {
  get(locationId: string): LocationSettings {
    const current = readJson<LocationSettings | null>(FILE, null, locationCheck);
    return current ?? defaultSettings(locationId);
  },
  update(locationId: string, patch: Partial<LocationSettings>): LocationSettings {
    const next = { ...locationRepo.get(locationId), ...patch };
    writeJson(FILE, next);
    return next;
  },
};
