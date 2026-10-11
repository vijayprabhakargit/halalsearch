import { describe, expect, it } from "vitest";
import { deriveHalalSignal, normalizeOverpass } from "./overpass";

describe("deriveHalalSignal", () => {
  it("is true for diet:halal=yes", () => {
    expect(deriveHalalSignal({ "diet:halal": "yes" })).toBe(true);
  });

  it("is true for diet:halal=only", () => {
    expect(deriveHalalSignal({ "diet:halal": "only" })).toBe(true);
  });

  it("is true for vegetarian and vegan", () => {
    expect(deriveHalalSignal({ "diet:vegetarian": "yes" })).toBe(true);
    expect(deriveHalalSignal({ "diet:vegan": "yes" })).toBe(true);
  });

  it("is true for halal-associated cuisines", () => {
    expect(deriveHalalSignal({ cuisine: "kebab" })).toBe(true);
    expect(deriveHalalSignal({ cuisine: "turkish" })).toBe(true);
  });

  it("is false for unrelated tags", () => {
    expect(deriveHalalSignal({ cuisine: "italian" })).toBe(false);
    expect(deriveHalalSignal({})).toBe(false);
  });
});

describe("normalizeOverpass", () => {
  it("normalizes named nodes and drops unnamed ones", () => {
    const places = normalizeOverpass({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 10,
          lon: 20,
          tags: { name: "Kebab House", cuisine: "kebab", "diet:halal": "yes" },
        },
        { type: "node", id: 2, lat: 11, lon: 21, tags: {} },
      ],
    });
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      placeId: "node/1",
      name: "Kebab House",
      lat: 10,
      lng: 20,
      osmHalalSignal: true,
      source: "osm",
    });
  });

  it("uses the center coordinates for ways", () => {
    const places = normalizeOverpass({
      elements: [
        {
          type: "way",
          id: 5,
          center: { lat: 1.5, lon: 2.5 },
          tags: { name: "Veg Place", "diet:vegetarian": "yes" },
        },
      ],
    });
    expect(places[0].lat).toBe(1.5);
    expect(places[0].lng).toBe(2.5);
    expect(places[0].placeId).toBe("way/5");
  });

  it("builds a readable address", () => {
    const places = normalizeOverpass({
      elements: [
        {
          type: "node",
          id: 9,
          lat: 1,
          lon: 1,
          tags: {
            name: "Cafe",
            "addr:housenumber": "12",
            "addr:street": "High St",
            "addr:city": "Townsville",
          },
        },
      ],
    });
    expect(places[0].address).toBe("12 High St, Townsville");
  });
});
