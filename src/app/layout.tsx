import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MIND SPARK — 3D Glassmorphic Ecosystem & Admin Command Center",
  description:
    "MIND SPARK — Education Must Be Free For Everyone. Explore 3D glassmorphic platform folders, live admin broadcasts, and Google-authenticated student messaging.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/syne-latin-variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
