import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HalalSearch",
  description:
    "Find nearby halal food places on a map, with AI-assisted verification grounded in Google Search.",
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
