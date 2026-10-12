import type { VerdictValue } from "./types";

export type CommunityVerdict = "halal" | "not_halal" | "unclear";

export interface CommunitySummary {
  placeId: string;
  halal: number;
  notHalal: number;
  unclear: number;
  total: number;
  /** Share of decided reports that say halal, in [0,1]; null when none decided. */
  halalRatio: number | null;
  /** Derived verdict, or null when there are no decided reports. */
  verdict: VerdictValue | null;
  lastUpdated: string | null;
}

/**
 * When COMMUNITY_STRICT_HALAL=1, a `halal` verdict needs corroboration: at least
 * two decided reports and a >=0.66 majority. Off by default (the app is new and
 * accumulating data), where a simple majority — even one `halal` vote — shows
 * halal. Downgrades are always fast (a clear negative majority wins at once).
 */
function strictHalal(): boolean {
  return process.env.COMMUNITY_STRICT_HALAL === "1";
}

export function deriveCommunityVerdict(
  halal: number,
  notHalal: number,
): VerdictValue | null {
  const decided = halal + notHalal;
  if (decided === 0) return null;
  const ratio = halal / decided;
  if (ratio < 0.5) return "not_halal";
  if (strictHalal()) {
    if (decided >= 2 && ratio >= 0.66) return "halal";
  } else if (ratio > 0.5) {
    return "halal";
  }
  return "unclear";
}

export type CommunityConfidence = "low" | "medium" | "high";

/** Confidence from the number of decided reports (independent of verdict). */
export function communityConfidence(summary: {
  halal: number;
  notHalal: number;
}): CommunityConfidence {
  const decided = summary.halal + summary.notHalal;
  if (decided >= 5) return "high";
  if (decided >= 2) return "medium";
  return "low";
}

export function buildSummary(
  placeId: string,
  counts: { halal: number; notHalal: number; unclear: number },
  lastUpdated: string | null,
): CommunitySummary {
  const { halal, notHalal, unclear } = counts;
  const total = halal + notHalal + unclear;
  const decided = halal + notHalal;
  return {
    placeId,
    halal,
    notHalal,
    unclear,
    total,
    halalRatio: decided > 0 ? halal / decided : null,
    verdict: deriveCommunityVerdict(halal, notHalal),
    lastUpdated,
  };
}

export function emptySummary(placeId: string): CommunitySummary {
  return buildSummary(placeId, { halal: 0, notHalal: 0, unclear: 0 }, null);
}

/** Map a community verdict onto a marker tone family. */
export function communityTone(
  verdict: VerdictValue | null,
): "halal" | "not" | "unclear" | null {
  if (!verdict) return null;
  if (verdict === "halal" || verdict === "likely_halal") return "halal";
  if (verdict === "not_halal") return "not";
  return "unclear";
}
