import { communityTone } from "./community";
import {
  hasHalalSignal,
  type Place,
  type Verdict,
  type VerdictValue,
} from "./types";

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
  | "tagged"
  | "loading"
  | "unknown";

export const TONE_COLORS: Record<MarkerTone, string> = {
  halal: "#15803d",
  likely: "#22c55e",
  not: "#dc2626",
  unclear: "#d97706",
  tagged: "#0d9488",
  loading: "#64748b",
  unknown: "#94a3b8",
};

export const TONE_LABELS: Record<MarkerTone, string> = {
  halal: "Halal",
  likely: "Likely halal",
  not: "Not halal",
  unclear: "Unclear",
  tagged: "Halal/veg labelled",
  loading: "Loading…",
  unknown: "Not validated",
};

export function markerTone(
  place: Place,
  state: VerdictState | undefined,
  community?: VerdictValue | null,
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
  const fromCommunity = communityTone(community ?? null);
  if (fromCommunity) return fromCommunity;
  if (hasHalalSignal(place)) return "tagged";
  return "unknown";
}
