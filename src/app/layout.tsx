import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrancoPath — AI-Powered French for TCF & TEF",
  description:
    "Master French with spaced repetition, AI coaching, and TCF/TEF exam prep. Designed for English, Punjabi, and Hindi speakers.",
  manifest: "/manifest.json",
  themeColor: "#6366f1",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FrancoPath",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
