import { describe, expect, it } from "vitest";
import { normalizeOverpass } from "./overpass";

describe("normalizeOverpass", () => {
  it("normalizes named nodes, drops unnamed ones, and maps tags", () => {
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
      source: "osm",
      halalTagged: true,
      vegetarianTagged: false,
      veganTagged: false,
    });
  });

  it("maps vegetarian and vegan tags", () => {
    const places = normalizeOverpass({
      elements: [
        {
          type: "node",
          id: 3,
          lat: 1,
          lon: 1,
          tags: { name: "Veg Place", "diet:vegetarian": "yes", "diet:vegan": "only" },
        },
      ],
    });
    expect(places[0].vegetarianTagged).toBe(true);
    expect(places[0].veganTagged).toBe(true);
    expect(places[0].halalTagged).toBe(false);
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
