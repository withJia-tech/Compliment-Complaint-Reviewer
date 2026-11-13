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
        <footer className="app-credit">
          Created by{" "}
          <a href="https://github.com/withJia-tech" rel="noopener noreferrer">
            withJia-tech
          </a>{" "}
          · MIT licensed
        </footer>
      </body>
    </html>
  );
}
