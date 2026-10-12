"use client";

import { useState, type ReactNode } from "react";

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}

/** A collapsible card section with a chevron header. */
export default function Section({
  title,
  defaultOpen = false,
  right,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-4 border-t border-slate-100 pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {right}
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
        </span>
      </button>

      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}
