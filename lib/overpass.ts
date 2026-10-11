import { TtlCache } from "./cache";
import type { OsmTags, Place } from "./types";

const OVERPASS_USER_AGENT =
  process.env.OVERPASS_USER_AGENT ?? "HalalSearch/0.1";

/**
 * Public Overpass mirrors. The main instance (and several others) are
 * frequently overloaded or down, so nearby lookups race these concurrently and
 * take the first non-empty success. `OVERPASS_URL`, if set, is included too.
 *
 * Only full-planet mirrors belong here: some public instances are regional
 * extracts (e.g. overpass.osm.ch covers Switzerland only) and return an empty
 * result for other areas, which would look like "no places nearby".
 */
const OVERPASS_ENDPOINTS = Array.from(
  new Set(
    [
      process.env.OVERPASS_URL,
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://overpass.osm.jp/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ].filter((endpoint): endpoint is string => Boolean(endpoint)),
  ),
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

/** Short-lived cache of successful nearby results (reduces Overpass load). */
const nearbyCache = new TtlCache<Place[]>(5 * 60 * 1000);

function nearbyCacheKey(lat: number, lng: number, radius: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)},${radius}`;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch nearby food places from Overpass and normalize them. */
export async function getNearbyPlaces(
  lat: number,
  lng: number,
  radius: number,
  limit: number,
): Promise<Place[]> {
  const cacheKey = nearbyCacheKey(lat, lng, radius);
  const cached = nearbyCache.get(cacheKey);
  if (cached) return cached.slice(0, limit);

  const body = `data=${encodeURIComponent(buildQuery(lat, lng, radius))}`;
  const rounds = 2;
  let lastDetails = "";

  for (let round = 0; round < rounds; round++) {
    const controller = new AbortController();
    let emptyResult: Place[] | null = null;

    const attempt = async (endpoint: string): Promise<Place[]> => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": OVERPASS_USER_AGENT,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
      });
      const host = safeHost(endpoint);
      if (!response.ok) {
        throw new Error(`${host} returned ${response.status}`);
      }
      const json = (await response.json()) as OverpassResponse;
      const places = normalizeOverpass(json);
      if (places.length === 0) {
        // Could be a genuinely empty area or a mirror with no data for this
        // location — remember it, but keep waiting for a mirror with results.
        emptyResult = [];
        throw new Error(`${host} returned no places`);
      }
      return places;
    };

    try {
      const places = await Promise.any(OVERPASS_ENDPOINTS.map(attempt));
      controller.abort();
      places.sort(
        (a, b) =>
          distanceSquared(a.lat, a.lng, lat, lng) -
          distanceSquared(b.lat, b.lng, lat, lng),
      );
      nearbyCache.set(cacheKey, places);
      return places.slice(0, limit);
    } catch (error) {
      controller.abort();
      if (emptyResult) return emptyResult;
      lastDetails =
        error instanceof AggregateError
          ? error.errors.map((e) => (e as Error).message).join("; ")
          : (error as Error).message;
      if (round < rounds - 1) await delay(1500);
    }
  }

  throw new Error(
    `OpenStreetMap (Overpass) is temporarily overloaded. Please try again shortly. [${lastDetails}]`,
  );
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
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
