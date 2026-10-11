import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("allows up to the limit then blocks", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("k", 3, 60_000).ok).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    expect(checkRateLimit("a", 1, 60_000).ok).toBe(true);
    expect(checkRateLimit("a", 1, 60_000).ok).toBe(false);
    expect(checkRateLimit("b", 1, 60_000).ok).toBe(true);
  });

  it("reports remaining count", () => {
    expect(checkRateLimit("r", 5, 60_000).remaining).toBe(4);
    expect(checkRateLimit("r", 5, 60_000).remaining).toBe(3);
  });
});
