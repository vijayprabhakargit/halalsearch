import { afterAll, describe, expect, it } from "vitest";
import { buildSummary, communityConfidence, communityTone, deriveCommunityVerdict } from "./community";

describe("deriveCommunityVerdict (default: simple majority)", () => {
  it("returns null with no decided reports", () => {
    expect(deriveCommunityVerdict(0, 0)).toBeNull();
  });

  it("confirms halal from a single vote", () => {
    expect(deriveCommunityVerdict(1, 0)).toBe("halal");
  });

  it("downgrades fast on a clear negative majority", () => {
    expect(deriveCommunityVerdict(0, 1)).toBe("not_halal");
    expect(deriveCommunityVerdict(1, 2)).toBe("not_halal");
  });

  it("confirms halal on a simple majority", () => {
    expect(deriveCommunityVerdict(2, 0)).toBe("halal");
    expect(deriveCommunityVerdict(2, 1)).toBe("halal");
    expect(deriveCommunityVerdict(3, 2)).toBe("halal");
  });

  it("returns unclear on a tie", () => {
    expect(deriveCommunityVerdict(1, 1)).toBe("unclear");
    expect(deriveCommunityVerdict(2, 2)).toBe("unclear");
  });
});

describe("deriveCommunityVerdict (COMMUNITY_STRICT_HALAL=1)", () => {
  const prev = process.env.COMMUNITY_STRICT_HALAL;
  afterAll(() => {
    if (prev === undefined) delete process.env.COMMUNITY_STRICT_HALAL;
    else process.env.COMMUNITY_STRICT_HALAL = prev;
  });

  it("needs >=2 contributors and >=0.66", () => {
    process.env.COMMUNITY_STRICT_HALAL = "1";
    expect(deriveCommunityVerdict(1, 0)).toBe("unclear");
    expect(deriveCommunityVerdict(2, 0)).toBe("halal");
    expect(deriveCommunityVerdict(2, 1)).toBe("halal");
    expect(deriveCommunityVerdict(3, 2)).toBe("unclear");
  });
});

describe("communityConfidence", () => {
  it("scales with the number of decided reports", () => {
    expect(communityConfidence({ halal: 1, notHalal: 0 })).toBe("low");
    expect(communityConfidence({ halal: 2, notHalal: 0 })).toBe("medium");
    expect(communityConfidence({ halal: 5, notHalal: 0 })).toBe("high");
  });
});

describe("deriveCommunityVerdict (unclear votes)", () => {
  it("shows unclear for a single unclear vote", () => {
    expect(deriveCommunityVerdict(0, 0, 1)).toBe("unclear");
  });

  it("shows unclear when unclear outnumbers decided reports", () => {
    expect(deriveCommunityVerdict(1, 0, 2)).toBe("unclear");
    expect(deriveCommunityVerdict(1, 1, 3)).toBe("unclear");
  });

  it("still decides when halal/not-halal outnumber unclear", () => {
    expect(deriveCommunityVerdict(2, 0, 1)).toBe("halal");
    expect(deriveCommunityVerdict(0, 2, 1)).toBe("not_halal");
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
