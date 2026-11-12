import Link from "next/link";
import { runScanAction } from "@/app/queue/actions";
import type { LocationSettings } from "@/lib/types";

const NAV = [
  { href: "/queue", label: "Queue" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader({
  location,
  businessName,
  pendingCount,
  currentPath,
}: {
  location: LocationSettings;
  businessName: string;
  pendingCount: number;
  currentPath: string;
}) {
  return (
    <header className="app-header">
      <div className="app-header-row">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◑
          </span>
          <span className="brand-name">Review Desk</span>
        </div>
        <nav className="app-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={currentPath === item.href ? "nav-link nav-link-active" : "nav-link"}
            >
              {item.label}
              {item.href === "/queue" && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </Link>
          ))}
        </nav>
        <form action={runScanAction}>
          <button type="submit" className="btn-secondary">
            Run scan
          </button>
        </form>
      </div>
      <div className="app-header-meta">
        <span>{businessName}</span>
        <span aria-hidden="true">·</span>
        <span>
          Auto-publish{" "}
          <strong className={location.autoPublishConsent ? "state-on" : "state-off"}>
            {location.autoPublishConsent ? "ON" : "OFF"}
          </strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Last scan{" "}
          {location.lastSuccessfulScanAt
            ? new Date(location.lastSuccessfulScanAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "never"}
        </span>
      </div>
    </header>
  );
}
