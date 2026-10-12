"use client";

/**
 * Optional donation link, shown next to Settings. Configure with
 * NEXT_PUBLIC_DONATE_URL (e.g. GitHub Sponsors, Ko-fi, Buy Me a Coffee).
 * Hidden when unset.
 */
export default function DonateButton() {
  const url = process.env.NEXT_PUBLIC_DONATE_URL;
  if (!url) return null;
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
