import { describe, expect, it } from "vitest";
import { markerTone } from "./status";
import type { Place } from "./types";

const basePlace: Place = {
  placeId: "node/1",
  name: "Test",
  lat: 0,
  lng: 0,
  osmTags: {},
  osmHalalSignal: false,
  source: "osm",
};

describe("markerTone", () => {
  it("returns unknown when no state and no OSM signal", () => {
    expect(markerTone(basePlace, undefined)).toBe("unknown");
  });

  it("returns osm when OSM signals halal but not yet validated", () => {
    expect(markerTone({ ...basePlace, osmHalalSignal: true }, undefined)).toBe("osm");
  });

  it("returns loading when validating", () => {
    expect(markerTone(basePlace, { status: "loading" })).toBe("loading");
  });

  it("maps verdicts to tones", () => {
    const make = (verdict: "halal" | "likely_halal" | "not_halal" | "unclear") =>
      markerTone(basePlace, {
        status: "ready",
        verdict: {
          placeId: basePlace.placeId,
          verdict,
          confidence: 0.5,
          summary: "",
          evidence: [],
          sources: [],
          grounded: true,
          model: "test",
          checkedAt: new Date().toISOString(),
          cached: false,
        },
      });
    expect(make("halal")).toBe("halal");
    expect(make("likely_halal")).toBe("likely");
    expect(make("not_halal")).toBe("not");
    expect(make("unclear")).toBe("unclear");
  });
});
