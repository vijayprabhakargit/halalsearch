export type OsmTags = {
  cuisine?: string;
  "diet:halal"?: string;
  "diet:vegetarian"?: string;
  "diet:vegan"?: string;
  [key: string]: string | undefined;
};

export type PlaceSource = "osm" | "geocode" | "tile" | "google";

export interface Place {
  placeId: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  cuisine?: string;
  source: PlaceSource;
  /** Data-source label: the place is tagged halal (e.g. Google `halal_restaurant`). */
  halalTagged: boolean;
  /** Data-source label: tagged vegetarian. */
  vegetarianTagged: boolean;
  /** Data-source label: tagged vegan. */
  veganTagged: boolean;
  /** Raw OSM tags (OSM provider only). */
  osmTags?: OsmTags;
}

/** True when the data source labels the place halal or vegetarian/vegan. */
export function hasHalalSignal(place: Place): boolean {
  return place.halalTagged || place.vegetarianTagged || place.veganTagged;
}

const FOOD_TYPE_PATTERN =
  /restaurant|cafe|coffee|bakery|food|deli|bistro|diner|eatery|kitchen|grill|buffet|canteen|cafeteria|snack|juice|tea_house|ice_cream|dessert|donut|bagel|sandwich|pizza|bar|pub|brewery|wine_bar|acai|chocolate/i;

/** Heuristic: is this a food/drink venue, or just a place (city, station, shop)? */
export function isFoodPlace(place: Place): boolean {
  if (place.halalTagged || place.vegetarianTagged || place.veganTagged) return true;
  return place.cuisine != null && FOOD_TYPE_PATTERN.test(place.cuisine);
}

export type VerdictValue = "halal" | "likely_halal" | "not_halal" | "unclear";

export interface Source {
  title: string;
  url: string;
}

export interface Verdict {
  placeId: string;
  verdict: VerdictValue;
  /** 0..1 model confidence. */
  confidence: number;
  summary: string;
  evidence: string[];
  sources: Source[];
  /** True when the answer was grounded with live Google Search results. */
  grounded: boolean;
  model: string;
  checkedAt: string;
  cached: boolean;
}

export interface ValidateRequest {
  placeId: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  osmTags?: OsmTags;
}

export const VERDICT_LABELS: Record<VerdictValue, string> = {
  halal: "Halal",
  likely_halal: "Likely halal",
  not_halal: "Not halal",
  unclear: "Unclear",
};

export const COORD = {
  minLat: -90,
  maxLat: 90,
  minLng: -180,
  maxLng: 180,
};
