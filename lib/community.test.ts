import { describe, expect, it } from "vitest";
import { buildSummary, communityConfidence, communityTone, deriveCommunityVerdict } from "./community";

describe("deriveCommunityVerdict", () => {
  it("returns null with no decided reports", () => {
    expect(deriveCommunityVerdict(0, 0)).toBeNull();
  });

  it("does not confirm halal from a single vote", () => {
    expect(deriveCommunityVerdict(1, 0)).toBe("unclear");
  });

  it("downgrades fast on a clear negative majority", () => {
    expect(deriveCommunityVerdict(0, 1)).toBe("not_halal");
    expect(deriveCommunityVerdict(1, 2)).toBe("not_halal");
  });

  it("confirms halal with >=2 contributors and a strong majority", () => {
    expect(deriveCommunityVerdict(2, 0)).toBe("halal");
    expect(deriveCommunityVerdict(2, 1)).toBe("halal");
    expect(deriveCommunityVerdict(5, 1)).toBe("halal");
  });

  it("returns unclear on a tie", () => {
    expect(deriveCommunityVerdict(1, 1)).toBe("unclear");
    expect(deriveCommunityVerdict(2, 2)).toBe("unclear");
  });
});

describe("communityConfidence", () => {
  it("scales with the number of decided reports", () => {
    expect(communityConfidence({ halal: 1, notHalal: 0 })).toBe("low");
    expect(communityConfidence({ halal: 2, notHalal: 0 })).toBe("medium");
    expect(communityConfidence({ halal: 5, notHalal: 0 })).toBe("high");
  });
});

describe("buildSummary", () => {
  it("counts and computes halalRatio over decided reports only", () => {
    const s = buildSummary("node/1", { halal: 2, notHalal: 1, unclear: 1 }, "2026-01-01");
    expect(s.total).toBe(4);
    expect(s.halalRatio).toBeCloseTo(2 / 3);
    expect(s.verdict).toBe("halal");
    expect(s.lastUpdated).toBe("2026-01-01");
  });

  it("has null ratio and verdict with no reports", () => {
    const s = buildSummary("node/2", { halal: 0, notHalal: 0, unclear: 0 }, null);
    expect(s.total).toBe(0);
    expect(s.halalRatio).toBeNull();
    expect(s.verdict).toBeNull();
  });
});

describe("communityTone", () => {
  it("maps verdicts to tone families", () => {
    expect(communityTone("halal")).toBe("halal");
    expect(communityTone("likely_halal")).toBe("halal");
    expect(communityTone("not_halal")).toBe("not");
    expect(communityTone("unclear")).toBe("unclear");
    expect(communityTone(null)).toBeNull();
  });
});
