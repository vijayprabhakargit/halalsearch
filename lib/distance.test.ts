import { describe, expect, it } from "vitest";
import { haversineMeters, formatDistance } from "./distance";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(51.5, -0.12, 51.5, -0.12)).toBe(0);
  });

  it("computes a known distance (London to Paris ~344 km)", () => {
    const d = haversineMeters(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(348_000);
  });

  it("is symmetric", () => {
    const a = haversineMeters(40.0, -74.0, 34.0, -118.0);
    const b = haversineMeters(34.0, -118.0, 40.0, -74.0);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });
});

describe("formatDistance", () => {
  it("formats meters below 1km", () => {
    expect(formatDistance(450)).toBe("450 m");
  });

  it("formats kilometers above 1km", () => {
    expect(formatDistance(1250)).toBe("1.3 km");
  });

  it("returns empty string for non-finite input", () => {
    expect(formatDistance(Number.NaN)).toBe("");
  });
});
