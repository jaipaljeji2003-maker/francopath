import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrancoPath — AI-Powered French for TCF & TEF",
  description:
    "Master French with spaced repetition, AI coaching, and TCF/TEF exam prep. Designed for English, Punjabi, and Hindi speakers.",
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
