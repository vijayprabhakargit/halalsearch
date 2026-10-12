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

/**
 * Broad food/drink primary types. We deliberately include cafes, bars, pubs and
 * breweries so halal ones surface; we do NOT filter by halal — we badge from
 * `types`.
 */
const FOOD_TYPES = [
  "restaurant",
  "cafe",
  "coffee_shop",
  "fast_food_restaurant",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "sandwich_shop",
  "deli",
  "dessert_restaurant",
  "dessert_shop",
  "ice_cream_shop",
  "cafeteria",
  "bar",
  "bar_and_grill",
  "pub",
  "brewery",
  "brewpub",
  "snack_bar",
  "food_court",
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

/** Nearby food places via Places API (New) Nearby Search. */
export async function getNearbyPlaces(
  lat: number,
  lng: number,
  radius: number,
  limit: number,
): Promise<Place[]> {
  const data = await post<{ places?: GooglePlace[] }>("searchNearby", {
    includedPrimaryTypes: FOOD_TYPES,
    maxResultCount: Math.min(Math.max(limit, 1), NEARBY_MAX),
    rankPreference: "POPULARITY",
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
  });
  const places = (data.places ?? [])
    .map(toPlace)
    .filter((p): p is Place => p !== null);
  return places.slice(0, limit);
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
