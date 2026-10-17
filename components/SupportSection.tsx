"use client";

import Image from "next/image";
import { SUPPORT_URL, UPI_ID, UPI_LINK } from "@/lib/support";

/**
 * Donate/support block for the info panel. Rendered only when the donate
 * feature flag is on (see DONATE_ENABLED in lib/support).
 */
export default function SupportSection() {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Support &amp; contribute
      </h3>
      <p className="mb-3">
        HalalSearch is a free, community-driven, self-funded project. You can help
        in two ways: <strong>contribute</strong> by adding assessments for places
        you know (it&apos;s what makes the map useful), or{" "}
        <strong>support</strong> the hosting and API costs.
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
          <p className="font-medium text-slate-800">Scan to pay via UPI</p>
          <p className="mt-0.5">
            UPI ID: <span className="font-mono text-slate-700">{UPI_ID}</span>
          </p>
          <p className="mt-1 text-slate-400">
            UPI works in India — overseas, use “Buy me a coffee”.
          </p>
        </div>
      </div>
    </section>
  );
}
