"use client";

import { useState } from "react";
import Image from "next/image";
import BrandIcon from "./BrandIcon";
import { TONE_COLORS } from "@/lib/status";

/** Support/contribute link. Overridable with NEXT_PUBLIC_DONATE_URL. */
const SUPPORT_URL =
  process.env.NEXT_PUBLIC_DONATE_URL ?? "https://buymeacoffee.com/odvprabhakk";

/** UPI (India) — deep link + QR (public/upi-qr.png encodes this same payload). */
const UPI_ID = "8500306433@ybl";
const UPI_LINK = `upi://pay?pa=${UPI_ID}&pn=HalalSearch&cu=INR`;

const LEGEND: { color: string; label: string; hint: string }[] = [
  { color: TONE_COLORS.halal, label: "Halal", hint: "Confirmed by Google's label or the community" },
  { color: TONE_COLORS.likely, label: "Likely halal", hint: "Leaning halal" },
  { color: TONE_COLORS.not, label: "Not halal", hint: "Reported as not halal" },
  { color: TONE_COLORS.unclear, label: "Unclear", hint: "Mixed or unclear reports" },
  { color: TONE_COLORS.tagged, label: "Halal/veg labelled", hint: "The place is labelled halal or vegetarian on the map" },
  { color: TONE_COLORS.unknown, label: "Not validated", hint: "No info yet — be the first to report" },
];

export default function HelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How to use HalalSearch"
        title="How to use"
        className="absolute bottom-24 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-lg hover:bg-slate-50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <BrandIcon className="h-7 w-7" />
                <h2 className="text-base font-semibold text-slate-900">
                  How to use HalalSearch
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm text-slate-700">
              <p>
                HalalSearch helps you find <strong>halal food near you</strong>. It
                shows nearby food places on the map and marks the ones labelled
                halal / vegetarian / vegan, plus what the community has reported.
              </p>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Getting around
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Nearby places load automatically. Each <strong>pin</strong> is a
                    food place.
                  </li>
                  <li>
                    <strong>Tap a pin</strong> to see details and the community’s
                    reports.
                  </li>
                  <li>
                    <strong>Tap anywhere on the map</strong> (even a place without a
                    pin) to look it up and check it.
                  </li>
                  <li>
                    Use the <strong>search box</strong> to find a restaurant or an
                    area, then pick a result.
                  </li>
                  <li>
                    After moving the map, tap <strong>“Search this area”</strong> to
                    load places there.
                  </li>
                  <li>
                    Use the <strong>filters</strong> (bottom-left) to show only
                    Halal / Veg / Community-confirmed / not-yet-checked places.
                  </li>
                  <li>
                    <strong>My location</strong> recenters on you (blue dot). Zoom and
                    compass are bottom-right; the red pin marks where a search is
                    centred.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What the pin colours mean
                </h3>
                <ul className="space-y-1.5">
                  {LEGEND.map((item) => (
                    <li key={item.label} className="flex items-start gap-2">
                      <span
                        className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full border border-white shadow"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>
                        <span className="font-medium text-slate-800">
                          {item.label}
                        </span>
                        <span className="text-slate-500"> — {item.hint}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Add your own assessment
                </h3>
                <p>
                  Open a place and choose <strong>Halal</strong> /{" "}
                  <strong>Not halal</strong> / <strong>Unclear</strong>. You get{" "}
                  <strong>one report per person</strong>; the result gets more
                  confident as others agree, and a lone vote reads as{" "}
                  <strong>low confidence</strong>. “Halal” is confirmed once at least
                  two people agree. Please be accurate — others rely on it.
                </p>
              </section>

              <section className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                Halal status is an <strong>estimate</strong> from public data and
                community reports — <strong>not a religious certification</strong>.
                Always verify with the establishment.
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Support &amp; contribute
                </h3>
                <p className="mb-3">
                  HalalSearch is a free, community-driven, self-funded project. You
                  can help in two ways: <strong>contribute</strong> by adding
                  assessments for places you know (it&apos;s what makes the map
                  useful), or <strong>support</strong> the hosting and API costs.
                </p>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <a
                    href={SUPPORT_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 shadow hover:bg-amber-300"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 8h1a3 3 0 0 1 0 6h-1" />
                      <path d="M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" />
                      <path d="M6 2v2M10 2v2M14 2v2" />
                    </svg>
                    Buy me a coffee
                  </a>
                  <a
                    href={UPI_LINK}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-slate-50"
                  >
                    Pay via UPI
                  </a>
                </div>

                <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <Image
                    src="/upi-qr.png"
                    alt="UPI QR code to support HalalSearch"
                    width={120}
                    height={120}
                    className="h-[120px] w-[120px] shrink-0 rounded bg-white p-1"
                  />
                  <div className="text-xs text-slate-600">
                    <p className="font-medium text-slate-800">
                      Scan to pay via UPI
                    </p>
                    <p className="mt-0.5">
                      UPI ID:{" "}
                      <span className="font-mono text-slate-700">{UPI_ID}</span>
                    </p>
                    <p className="mt-1 text-slate-400">
                      UPI works in India — overseas, use “Buy me a coffee”.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
