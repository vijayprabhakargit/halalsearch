"use client";

import { useEffect, useId, useRef, useState } from "react";

interface CseElement {
  execute: (query: string) => void;
}
interface CseElementApi {
  render: (options: {
    div: HTMLElement;
    tag: string;
    gname: string;
    attributes?: Record<string, unknown>;
  }) => CseElement;
}

declare global {
  interface Window {
    google?: { search?: { cse?: { element?: CseElementApi } } };
    __gcse?: { parsetags?: string; callback?: () => void };
  }
}

let csePromise: Promise<void> | null = null;

function loadCse(cx: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.search?.cse?.element) return Promise.resolve();
  if (csePromise) return csePromise;
  csePromise = new Promise<void>((resolve, reject) => {
    window.__gcse = { parsetags: "explicit", callback: () => resolve() };
    const script = document.createElement("script");
    script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(cx)}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Programmable Search"));
    document.head.appendChild(script);
  });
  return csePromise;
}

interface GoogleSearchPaneProps {
  query: string;
  cx: string;
}

/**
 * Renders Google Programmable Search Engine results inline (results-only).
 * Legal, ad-supported embed; requires a `cx` engine id.
 */
export default function GoogleSearchPane({ query, cx }: GoogleSearchPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gname = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCse(cx)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const api = window.google?.search?.cse?.element;
        if (!api) {
          setError("Google Programmable Search did not initialise.");
          return;
        }
        const element = api.render({
          div: containerRef.current,
          tag: "searchresults-only",
          gname,
          attributes: { enableHistory: false, disableWebSearch: false, query },
        });
        try {
          element.execute(query);
        } catch {
          // some versions take the query via attributes instead
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [query, cx, gname]);

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-white">
      {error ? (
        <p className="p-3 text-xs text-red-600">{error}</p>
      ) : (
        <div ref={containerRef} className="max-h-72 overflow-auto p-2" />
      )}
    </div>
  );
}
