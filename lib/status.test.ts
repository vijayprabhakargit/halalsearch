import { describe, expect, it } from "vitest";
import { markerTone } from "./status";
import type { Place } from "./types";

const basePlace: Place = {
  placeId: "node/1",
  name: "Test",
  lat: 0,
  lng: 0,
  source: "osm",
  halalTagged: false,
  vegetarianTagged: false,
  veganTagged: false,
};

describe("markerTone", () => {
  it("returns unknown when no state and no label", () => {
    expect(markerTone(basePlace, undefined)).toBe("unknown");
  });

  it("returns tagged when the source labels it halal/veg but not validated", () => {
    expect(markerTone({ ...basePlace, halalTagged: true }, undefined)).toBe("tagged");
    expect(markerTone({ ...basePlace, vegetarianTagged: true }, undefined)).toBe("tagged");
  });

  it("returns loading when validating", () => {
    expect(markerTone(basePlace, { status: "loading" })).toBe("loading");
  });

  it("maps community verdicts to tones", () => {
    expect(markerTone(basePlace, undefined, "halal")).toBe("halal");
    expect(markerTone(basePlace, undefined, "not_halal")).toBe("not");
    expect(markerTone(basePlace, undefined, "unclear")).toBe("unclear");
  });
});
