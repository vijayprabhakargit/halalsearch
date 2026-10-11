import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.has("a")).toBe(true);
  });

  it("expires entries after the TTL", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1);
    vi.advanceTimersByTime(1001);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.has("a")).toBe(false);
  });

  it("deletes and clears entries", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "x");
    cache.set("b", "y");
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
