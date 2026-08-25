import { AppHeader } from "@/app/components/AppHeader";
import { toggleConsentAction } from "@/app/settings/actions";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const rows = loadQueueRows();
  const header = loadHeaderData(rows);
  const { location } = header;

  return (
    <>
      <AppHeader {...header} currentPath="/settings" />
      <main>
        <div className="page-head">
          <h1>Settings</h1>
        </div>

        <section>
          <h2>Connected location</h2>
          <p>Status: {location.connected ? "Connected (simulated Google OAuth)" : "Not connected"}</p>
          <p>Location ID: {location.locationId}</p>
          <p>
            Last successful scan:{" "}
            {location.lastSuccessfulScanAt
              ? new Date(location.lastSuccessfulScanAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "never"}
          </p>
        </section>

        <section>
          <h2>Auto-publish consent</h2>
          <p>
            When on, 4-5 star reviews with no complaints detected are published automatically. Every
            mixed, negative, or sensitive review always waits for you, regardless of this setting.
          </p>
          <form action={toggleConsentAction}>
            <input type="hidden" name="next" value={(!location.autoPublishConsent).toString()} />
            <button type="submit">
              Turn auto-publish {location.autoPublishConsent ? "OFF" : "ON"}
            </button>
          </form>
          <p>
            Current state:{" "}
            <strong className={location.autoPublishConsent ? "state-on" : "state-off"}>
              {location.autoPublishConsent ? "ON" : "OFF"}
            </strong>
          </p>
        </section>
      </main>
    </>
  );
}
