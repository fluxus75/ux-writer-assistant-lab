import "../styles/globals.css";
import type { Metadata } from "next";
import { AppShell } from "../components/AppShell";

export const metadata: Metadata = {
  title: "UX Writer Assistant",
  description: "Day 3 workflow shell for UX writer collaboration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
