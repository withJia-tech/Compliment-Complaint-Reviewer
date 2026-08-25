import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compliment Complaint Reviewer",
  description: "Fixture-backed prototype for a governed daily review desk",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <nav className="top-nav">
            <Link href="/queue">Queue</Link>
            <Link href="/settings">Settings</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
