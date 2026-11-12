import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Review Desk",
  description: "Fixture-backed prototype for a governed daily review desk",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
