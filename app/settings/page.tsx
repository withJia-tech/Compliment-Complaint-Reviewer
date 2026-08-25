import { toggleConsentAction } from "@/app/settings/actions";
import { locationRepo } from "@/lib/store/locationRepo";
import { DEFAULT_LOCATION_ID } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const location = locationRepo.get(DEFAULT_LOCATION_ID);

  return (
    <main>
      <h1>Settings</h1>

      <section>
        <h2>Connected location</h2>
        <p>Status: {location.connected ? "Connected (simulated Google OAuth)" : "Not connected"}</p>
        <p>Location ID: {location.locationId}</p>
        <p>
          Last successful scan:{" "}
          {location.lastSuccessfulScanAt ? new Date(location.lastSuccessfulScanAt).toLocaleString() : "never"}
        </p>
      </section>

      <section>
        <h2>Auto-publish consent</h2>
        <p>
          When on, 4-5 star reviews with no complaints detected are published automatically. Every
          mixed, negative, or sensitive review always requires your approval regardless of this
          setting.
        </p>
        <form action={toggleConsentAction}>
          <input type="hidden" name="next" value={(!location.autoPublishConsent).toString()} />
          <button type="submit">Turn auto-publish {location.autoPublishConsent ? "OFF" : "ON"}</button>
        </form>
        <p>Current state: <strong>{location.autoPublishConsent ? "ON" : "OFF"}</strong></p>
      </section>
    </main>
  );
}
