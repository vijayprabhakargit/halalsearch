export type OsmTags = {
  cuisine?: string;
  "diet:halal"?: string;
  "diet:vegetarian"?: string;
  "diet:vegan"?: string;
  [key: string]: string | undefined;
};

export type PlaceSource = "osm" | "geocode";

export interface Place {
  placeId: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  cuisine?: string;
  osmTags: OsmTags;
  /** True when OSM tags already indicate halal/vegetarian/vegan-friendly. */
  osmHalalSignal: boolean;
  source: PlaceSource;
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
