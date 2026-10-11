import type { OsmTags, Place } from "./types";

const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const OVERPASS_USER_AGENT =
  process.env.OVERPASS_USER_AGENT ?? "HalalSearch/0.1";

/** Mirrors tried in order; the public main instance is often overloaded. */
const OVERPASS_ENDPOINTS = Array.from(
  new Set([
    OVERPASS_URL,
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ]),
);

const AMENITY_REGEX = "^(restaurant|cafe|fast_food|food_court|canteen|pub|bar)$";

/**
 * Cuisines that frequently (but not always) indicate halal-friendly food.
 * Used only as a weak positive signal; the AI check is authoritative.
 */
const HALAL_ASSOCIATED_CUISINES = [
  "kebab",
  "doner",
  "shawarma",
  "falafel",
  "turkish",
  "lebanese",
  "persian",
  "iranian",
  "arab",
  "yemeni",
  "syrian",
  "iraqi",
  "egyptian",
  "moroccan",
  "tunisian",
  "algerian",
  "middle_eastern",
  "mediterranean",
  "pakistani",
  "bangladeshi",
  "indian",
  "afghan",
  "indonesian",
  "malaysian",
  "somali",
  "sudanese",
  "uzbek",
  "halal",
];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function isAffirmative(value?: string): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "yes" || v === "only";
}

function cuisineMatchesHalal(cuisine?: string): boolean {
  if (!cuisine) return false;
  const normalized = cuisine.toLowerCase();
  return HALAL_ASSOCIATED_CUISINES.some((c) => normalized.includes(c));
}

/** Derive whether OSM tags already signal halal/vegetarian/vegan-friendly food. */
export function deriveHalalSignal(tags: OsmTags): boolean {
  if (isAffirmative(tags["diet:halal"])) return true;
  if (isAffirmative(tags["diet:vegetarian"])) return true;
  if (isAffirmative(tags["diet:vegan"])) return true;
  return cuisineMatchesHalal(tags.cuisine);
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean)
    .join(" ")
    .trim();
  const parts = [
    street,
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
    tags["addr:postcode"],
  ].filter((p): p is string => Boolean(p && p.length));
  return parts.length ? parts.join(", ") : undefined;
}

/** Convert an Overpass response into normalized places (named food venues only). */
export function normalizeOverpass(json: OverpassResponse): Place[] {
  const places: Place[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const osmTags: OsmTags = {
      cuisine: tags.cuisine,
      "diet:halal": tags["diet:halal"],
      "diet:vegetarian": tags["diet:vegetarian"],
      "diet:vegan": tags["diet:vegan"],
    };

    places.push({
      placeId: `${el.type}/${el.id}`,
      name,
      address: buildAddress(tags),
      lat,
      lng,
      cuisine: tags.cuisine,
      osmTags,
      osmHalalSignal: deriveHalalSignal(osmTags),
      source: "osm",
    });
  }
  return places;
}

function buildQuery(lat: number, lng: number, radius: number): string {
  return `[out:json][timeout:25];
(
  nwr["amenity"~"${AMENITY_REGEX}"](around:${radius},${lat},${lng});
);
out center tags;`;
}

/** Fetch nearby food places from Overpass and normalize them. */
export async function getNearbyPlaces(
  lat: number,
  lng: number,
  radius: number,
  limit: number,
): Promise<Place[]> {
  const query = buildQuery(lat, lng, radius);
  const body = `data=${encodeURIComponent(query)}`;
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": OVERPASS_USER_AGENT,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        lastError = new Error(`Overpass request failed: ${response.status}`);
        continue;
      }
      const json = (await response.json()) as OverpassResponse;
      const places = normalizeOverpass(json);
      places.sort(
        (a, b) =>
          distanceSquared(a.lat, a.lng, lat, lng) -
          distanceSquared(b.lat, b.lng, lat, lng),
      );
      return places.slice(0, limit);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error("Overpass request failed");
}

function distanceSquared(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = aLat - bLat;
  const dLng = (aLng - bLng) * Math.cos((bLat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}
