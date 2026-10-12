import { haversineMeters } from "../distance";
import type { Place } from "../types";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/** Only the fields we render — keeps the response small (and the SKU tier down). */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
].join(",");

// Nearby Search returns at most 20 results per request, so we split the food
// types into two buckets and merge them — otherwise popular restaurants crowd
// out cafes/bars/bakeries in the single 20-slot response. (Two calls = 2 Nearby
// SKU units per load; still well inside the free tier for modest usage.)
const RESTAURANT_TYPES = ["restaurant"];
const OTHER_FOOD_TYPES = [
  "cafe",
  "coffee_shop",
  "bakery",
  "fast_food_restaurant",
  "meal_takeaway",
  "meal_delivery",
  "food_court",
  "buffet_restaurant",
  "cafeteria",
  "diner",
  "snack_bar",
  "sandwich_shop",
  "deli",
  "juice_shop",
  "tea_house",
  "acai_shop",
  "ice_cream_shop",
  "dessert_shop",
  "dessert_restaurant",
  "donut_shop",
  "bagel_shop",
  "chocolate_shop",
  "bar",
  "bar_and_grill",
  "pub",
  "brewery",
  "wine_bar",
];

const NEARBY_MAX = 20;

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set.");
  return key;
}

async function post<T>(method: string, body: unknown): Promise<T> {
  const response = await fetch(`${PLACES_ENDPOINT}:${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Google Places ${method} failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  return (await response.json()) as T;
}

function toPlace(g: GooglePlace): Place | null {
  const lat = g.location?.latitude;
  const lng = g.location?.longitude;
  const name = g.displayName?.text?.trim();
  if (!g.id || !name || lat == null || lng == null) return null;
  const types = g.types ?? [];
  return {
    placeId: g.id,
    name,
    address: g.formattedAddress,
    lat,
    lng,
    cuisine: g.primaryType,
    source: "google",
    halalTagged: types.includes("halal_restaurant"),
    vegetarianTagged: types.includes("vegetarian_restaurant"),
    veganTagged: types.includes("vegan_restaurant"),
  };
}

async function searchNearbyTypes(
  types: string[],
  lat: number,
  lng: number,
  radius: number,
  max: number,
): Promise<Place[]> {
  const data = await post<{ places?: GooglePlace[] }>("searchNearby", {
    includedPrimaryTypes: types,
    maxResultCount: max,
    rankPreference: "POPULARITY",
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
  });
  return (data.places ?? [])
    .map(toPlace)
    .filter((p): p is Place => p !== null);
}

/** Nearby food places via Places API (New) Nearby Search, across two buckets. */
export async function getNearbyPlaces(
  lat: number,
  lng: number,
  radius: number,
  limit: number,
): Promise<Place[]> {
  const per = Math.min(Math.max(limit, 1), NEARBY_MAX);
  const settled = await Promise.allSettled([
    searchNearbyTypes(RESTAURANT_TYPES, lat, lng, radius, per),
    searchNearbyTypes(OTHER_FOOD_TYPES, lat, lng, radius, per),
  ]);

  const results: Place[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") results.push(...outcome.value);
  }
  if (results.length === 0) {
    const failed = settled.find((o) => o.status === "rejected");
    const reason = failed && failed.status === "rejected" ? failed.reason : null;
    throw reason instanceof Error ? reason : new Error("Places Nearby Search failed");
  }

  const seen = new Set<string>();
  const merged = results.filter((p) =>
    seen.has(p.placeId) ? false : (seen.add(p.placeId), true),
  );
  return merged.slice(0, Math.max(limit, NEARBY_MAX));
}

/** Place search via Places API (New) Text Search, biased toward the user. */
export async function searchPlaces(
  query: string,
  lat?: number,
  lng?: number,
): Promise<Place[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: NEARBY_MAX,
  };
  if (lat != null && lng != null) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 30_000 },
    };
  }
  const data = await post<{ places?: GooglePlace[] }>("searchText", body);
  const places = (data.places ?? [])
    .map(toPlace)
    .filter((p): p is Place => p !== null);
  if (lat != null && lng != null) {
    places.sort(
      (a, b) =>
        haversineMeters(a.lat, a.lng, lat, lng) -
        haversineMeters(b.lat, b.lng, lat, lng),
    );
  }
  return places;
}
