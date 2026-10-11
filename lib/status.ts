import type { Place, Verdict } from "./types";

export type VerdictState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; verdict: Verdict };

export type MarkerTone =
  | "halal"
  | "likely"
  | "not"
  | "unclear"
  | "osm"
  | "loading"
  | "unknown";

export const TONE_COLORS: Record<MarkerTone, string> = {
  halal: "#15803d",
  likely: "#22c55e",
  not: "#dc2626",
  unclear: "#d97706",
  osm: "#0d9488",
  loading: "#64748b",
  unknown: "#94a3b8",
};

export const TONE_LABELS: Record<MarkerTone, string> = {
  halal: "Halal (AI)",
  likely: "Likely halal (AI)",
  not: "Not halal (AI)",
  unclear: "Unclear (AI)",
  osm: "Halal/veg tagged (OSM)",
  loading: "Validating…",
  unknown: "Not validated",
};

export function markerTone(
  place: Place,
  state: VerdictState | undefined,
): MarkerTone {
  if (state?.status === "loading") return "loading";
  if (state?.status === "ready") {
    switch (state.verdict.verdict) {
      case "halal":
        return "halal";
      case "likely_halal":
        return "likely";
      case "not_halal":
        return "not";
      default:
        return "unclear";
    }
  }
  if (state?.status === "error") return "unknown";
  if (place.osmHalalSignal) return "osm";
  return "unknown";
}
