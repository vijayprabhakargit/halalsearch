"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "@/lib/api";
import type { Place } from "@/lib/types";

interface SearchBoxProps {
  bias: { lat: number; lng: number } | null;
  onSelect: (place: Place) => void;
}

export default function SearchBox({ bias, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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
        setOpen(true);
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
  }, [query, bias?.lat, bias?.lng]);

  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        placeholder="Search a restaurant or address…"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow focus:border-slate-400 focus:outline-none"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-xs text-slate-400">…</span>
      )}

      {query.trim().length >= 2 && open && (results.length > 0 || error) && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {error && <li className="px-3 py-2 text-xs text-red-600">{error}</li>}
          {results.map((place) => (
            <li key={place.placeId}>
              <button
                type="button"
                onClick={() => {
                  onSelect(place);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block text-sm font-medium text-slate-800">
                  {place.name}
                </span>
                {place.address && (
                  <span className="block truncate text-xs text-slate-500">
                    {place.address}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
