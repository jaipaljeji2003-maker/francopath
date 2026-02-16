import type { Metadata, Viewport } from "next";
import "./globals.css";
import FeedbackWidget from "@/components/shared/FeedbackWidget";

export const metadata: Metadata = {
  title: "FrancoPath — AI-Powered French for TCF & TEF",
  description:
    "Master French with spaced repetition, AI coaching, and TCF/TEF exam prep. Designed for English, Punjabi, and Hindi speakers.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FrancoPath",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
