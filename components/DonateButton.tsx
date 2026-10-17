"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DONATE_ENABLED, SUPPORT_URL, UPI_ID, UPI_LINK } from "@/lib/support";

/**
 * Support menu, shown next to Settings: Buy Me a Coffee (international) and
 * UPI (India). `upi://` links only work on devices with a UPI app, so touch
 * devices get a deep link while desktops get a scannable QR instead.
 * SUPPORT_URL is overridable with NEXT_PUBLIC_DONATE_URL.
 */
export default function DonateButton() {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!DONATE_ENABLED) return null;

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => {
          setIsTouch(window.matchMedia("(pointer: coarse)").matches);
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50"
      >
        Donate
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <a
            role="menuitem"
            href={SUPPORT_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Buy me a coffee
          </a>

          <div className="my-1 border-t border-slate-100" />

          <p className="px-3 pb-1 pt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            UPI (India)
          </p>

          {isTouch ? (
            <a
              role="menuitem"
              href={UPI_LINK}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Open UPI app
            </a>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2">
              <Image
                src="/upi-qr.png"
                alt="UPI QR code to support HalalSearch"
                width={96}
                height={96}
                className="h-24 w-24 shrink-0 rounded border border-slate-200 bg-white p-1"
              />
              <div className="text-xs text-slate-500">
                <p className="font-medium text-slate-700">Scan to pay</p>
                <p className="mt-0.5 font-mono text-slate-600">{UPI_ID}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
