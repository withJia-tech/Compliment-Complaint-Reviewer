import { AppHeader } from "@/app/components/AppHeader";
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
          <h2>Sending</h2>
          <p>
            Replies are never sent automatically. Every reply — including a clean five-star
            thank-you — waits in the queue until you send it. Low-risk reviews are marked{" "}
            <strong>Quick approve</strong>, so clearing them takes one click.
          </p>
          <p className="page-sub">
            Your reviews and replies live in your Google Business Profile. This app keeps only its
            working notes: how each review was triaged, the draft, and what you decided.
          </p>
        </section>
      </main>
    </>
  );
}
