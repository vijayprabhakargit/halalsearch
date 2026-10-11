"use client";

import { TONE_COLORS, type MarkerTone } from "@/lib/status";

export type PlaceCategory = "restaurant" | "cafe" | "fastfood" | "dessert";

/** Map an OSM cuisine value to a coarse icon category. */
export function cuisineCategory(cuisine?: string): PlaceCategory {
  const c = (cuisine ?? "").toLowerCase();
  if (/coffee|cafe|tea|juice|drink/.test(c)) return "cafe";
  if (/burger|pizza|fast|chicken|kebab|sandwich|hot_dog|fries|fish_and_chips/.test(c))
    return "fastfood";
  if (/ice_cream|dessert|bakery|cake|donut|chocolate|sweet|pastry/.test(c))
    return "dessert";
  return "restaurant";
}

// Simple 24x24 line icons (fork & knife, cup, burger, ice cream).
const ICONS: Record<PlaceCategory, string[]> = {
  restaurant: [
    "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
    "M7 2v20",
    "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
  ],
  cafe: [
    "M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z",
    "M16 9h2a2 2 0 0 1 0 4h-2",
    "M7 3v2M11 3v2M15 3v2",
  ],
  fastfood: [
    "M4 10a8 8 0 0 1 16 0z",
    "M4 12.6h16",
    "M4 15h16v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z",
  ],
  dessert: ["M8 12l4 9 4-9z", "M12 4a4 4 0 0 1 4 4H8a4 4 0 0 1 4-4z"],
};

const BADGE_GLYPH: Partial<Record<MarkerTone, string>> = {
  halal: "✓",
  likely: "✓",
  not: "✕",
  unclear: "?",
};

interface PlacePinProps {
  tone: MarkerTone;
  category: PlaceCategory;
  selected: boolean;
}

/**
 * A teardrop map pin: the icon shows the kind of place, the colour (and badge)
 * show the halal status.
 */
export default function PlacePin({ tone, category, selected }: PlacePinProps) {
  const color = TONE_COLORS[tone];
  const width = selected ? 34 : 28;
  const height = selected ? 44 : 36;
  const badge = BADGE_GLYPH[tone];

  return (
    <span className="relative inline-block" style={{ width, height }}>
      <svg
        viewBox="0 0 28 36"
        width={width}
        height={height}
        className="drop-shadow-md transition-transform group-hover:scale-110"
      >
        <path
          d="M14 1C7.4 1 2 6.4 2 13c0 8 12 22 12 22s12-14 12-22C26 6.4 20.6 1 14 1z"
          fill={color}
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="13" r="7.6" fill="white" />
        <g
          transform="translate(14 13) scale(0.5) translate(-12 -12)"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONS[category].map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>

      {tone === "loading" && (
        <span className="absolute right-0 top-0 h-4 w-4 animate-ping rounded-full bg-slate-400/70" />
      )}

      {badge && (
        <span
          className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-white text-[10px] font-bold leading-none shadow"
          style={{ color }}
        >
          {badge}
        </span>
      )}
    </span>
  );
}
