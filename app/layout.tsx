import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://halalsearch.net";
const SITE_DESCRIPTION =
  "Find nearby halal food places on a map, with AI-assisted verification grounded in Google Search.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "HalalSearch",
  description: SITE_DESCRIPTION,
  applicationName: "HalalSearch",
  openGraph: {
    title: "HalalSearch",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "HalalSearch",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HalalSearch",
    description: SITE_DESCRIPTION,
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
