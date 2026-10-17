/**
 * Shared support/contribution links and feature flag.
 *
 * The whole donate/support UI (header Donate menu + the info panel's
 * "Support & contribute" section) is OFF by default; enable it by setting
 * NEXT_PUBLIC_ENABLE_DONATE=1.
 *
 * SUPPORT_URL is overridable with NEXT_PUBLIC_DONATE_URL (e.g. GitHub Sponsors,
 * Ko-fi, Buy Me a Coffee); it defaults to the project's Buy Me a Coffee page.
 * UPI (India) uses a fixed VPA; public/upi-qr.png encodes the same UPI_LINK.
 */
export const DONATE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DONATE === "1";

export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_DONATE_URL ?? "https://buymeacoffee.com/odvprabhakk";

export const UPI_ID = "8500306433@ybl";

export const UPI_LINK = `upi://pay?pa=${UPI_ID}&pn=HalalSearch&cu=INR`;
