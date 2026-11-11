import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MIND SPARK · Admin Command Center",
  description:
    "Private Mind Spark admin console: announcement broadcasts, Google-verified student inbox, platform architect and appearance studio.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
