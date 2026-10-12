import { describe, expect, it } from "vitest";
import { isFoodPlace, type Place } from "./types";

const base: Place = {
  placeId: "google/1",
  name: "X",
  lat: 0,
  lng: 0,
  source: "google",
  halalTagged: false,
  vegetarianTagged: false,
  veganTagged: false,
};

describe("isFoodPlace", () => {
  it("recognizes a pastry_shop via its full type list", () => {
    expect(
      isFoodPlace({
        ...base,
        cuisine: "pastry_shop",
        types: ["cafe", "pastry_shop", "bakery", "dessert_shop", "food"],
      }),
    ).toBe(true);
  });

  it("recognizes halal/veg tags with no cuisine", () => {
    expect(isFoodPlace({ ...base, halalTagged: true })).toBe(true);
    expect(isFoodPlace({ ...base, vegetarianTagged: true })).toBe(true);
  });

  it("rejects a non-food place (transit station)", () => {
    expect(
      isFoodPlace({
        ...base,
        cuisine: "transit_station",
        types: ["transit_station", "point_of_interest"],
      }),
    ).toBe(false);
  });

  it("rejects a plain locality", () => {
    expect(
      isFoodPlace({ ...base, types: ["locality", "political"] }),
    ).toBe(false);
  });
});
