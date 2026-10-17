"use client";

/**
 * Support/donation link, shown next to Settings. Configure with
 * NEXT_PUBLIC_DONATE_URL (e.g. GitHub Sponsors, Ko-fi, Buy Me a Coffee);
 * defaults to the project's Buy Me a Coffee page.
 */
const SUPPORT_URL =
  process.env.NEXT_PUBLIC_DONATE_URL ?? "https://buymeacoffee.com/odvprabhakk";

export default function DonateButton() {
  const url = SUPPORT_URL;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="hidden rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50 sm:inline-flex"
    >
      Donate
    </a>
  );
}
