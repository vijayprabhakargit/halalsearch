import type { VerdictValue } from "./types";

export type CommunityVerdict = "halal" | "not_halal" | "unclear";

/** Minimum independent reports before a community verdict is shown at all. */
export const MIN_REPORTS_FOR_VERDICT = 3;

export interface CommunitySummary {
  placeId: string;
  halal: number;
  notHalal: number;
  unclear: number;
  total: number;
  /** Share of decided reports that say halal, in [0,1]; null when none decided. */
  halalRatio: number | null;
  /** Derived verdict, or null when there are too few reports to decide. */
  verdict: VerdictValue | null;
  lastUpdated: string | null;
}

/** Derive a verdict from decided (halal/not-halal) report counts. */
export function deriveCommunityVerdict(
  halal: number,
  notHalal: number,
): VerdictValue | null {
  const decided = halal + notHalal;
  if (decided < MIN_REPORTS_FOR_VERDICT) return null;
  const ratio = halal / decided;
  if (ratio >= 0.66) return "halal";
  if (ratio <= 0.34) return "not_halal";
  return "unclear";
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
