"use client";

import { useEffect, useRef, useState } from "react";
import { fetchSummaries, searchPlaces } from "@/lib/api";
import type { CommunitySummary } from "@/lib/community";
import { formatDistance, haversineMeters } from "@/lib/distance";
import { hasHalalSignal, isFoodPlace, type Place, type VerdictValue } from "@/lib/types";

interface SearchBoxProps {
  bias: { lat: number; lng: number } | null;
  nearby: Place[];
  communitySummaries: Record<string, CommunitySummary>;
  onSummaries: (summaries: Record<string, CommunitySummary>) => void;
  onSelect: (place: Place) => void;
}

const COMMUNITY_CHIP: Record<VerdictValue, { label: string; className: string }> = {
  halal: { label: "Halal", className: "bg-green-100 text-green-700" },
  likely_halal: { label: "Likely halal", className: "bg-green-50 text-green-700" },
  not_halal: { label: "Not halal", className: "bg-red-100 text-red-700" },
  unclear: { label: "Unclear", className: "bg-amber-100 text-amber-700" },
};

function distanceTo(
  place: Place,
  bias: { lat: number; lng: number } | null,
): number | null {
  if (!bias) return null;
  return haversineMeters(place.lat, place.lng, bias.lat, bias.lng);
}

export default function SearchBox({
  bias,
  nearby,
  communitySummaries,
  onSummaries,
  onSelect,
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    if (timer.current) clearTimeout(timer.current);
    const current = ++seq.current;
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await searchPlaces(trimmed, bias?.lat, bias?.lng);
        if (current !== seq.current) return;
        setResults(list);
        // Pull community verdicts for the results so they can be shown too.
        if (list.length > 0) {
          const ids = list.map((p) => p.placeId);
          void fetchSummaries(ids)
            .then((summaries) => {
              if (current === seq.current) onSummaries(summaries);
            })
            .catch(() => {
              // community data is best-effort
            });
        }
      } catch (e) {
        if (current !== seq.current) return;
        setError((e as Error).message);
      } finally {
        if (current === seq.current) setLoading(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, bias?.lat, bias?.lng, onSummaries]);

  const trimmed = query.trim();
  const showingNearby = trimmed.length < 2;
  const list = showingNearby
    ? [...nearby].sort(
        (a, b) => (distanceTo(a, bias) ?? Infinity) - (distanceTo(b, bias) ?? Infinity),
      )
    : results;
  const open = focused && (list.length > 0 || Boolean(error));

  const pick = (place: Place) => {
    onSelect(place);
    setQuery("");
    setResults([]);
    setFocused(false);
  };

  return (
    <div className="relative w-full">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="text"
        value={query}
        placeholder="Search a place, or pick from nearby…"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onClick={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        className="w-full rounded-full border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm shadow-lg focus:border-slate-400 focus:outline-none sm:py-3.5"
      />
      {loading && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          …
        </span>
      )}

      {open && (
        <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
          {error && <li className="px-4 py-2 text-xs text-red-600">{error}</li>}
          {!error && showingNearby && (
            <li className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Nearby
            </li>
          )}
          {list.map((place) => {
            const d = distanceTo(place, bias);
            const communityVerdict = communitySummaries[place.placeId]?.verdict ?? null;
            const googleTag = hasHalalSignal(place);
            return (
              <li key={place.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(place)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {place.name}
                      </span>
                      {googleTag ? (
                        <span className="shrink-0 rounded bg-teal-100 px-1 py-0.5 text-[10px] text-teal-700">
                          Halal/veg
                        </span>
                      ) : communityVerdict ? (
                        <span
                          className={`shrink-0 rounded px-1 py-0.5 text-[10px] ${
                            COMMUNITY_CHIP[communityVerdict].className
                          }`}
                        >
                          {COMMUNITY_CHIP[communityVerdict].label}
                        </span>
                      ) : null}
                      {!showingNearby && !isFoodPlace(place) && (
                        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500">
                          Location
                        </span>
                      )}
                    </span>
                    {place.address && (
                      <span className="block truncate text-xs text-slate-500">
                        {place.address}
                      </span>
                    )}
                  </span>
                  {d != null && (
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDistance(d)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
