import { haversineMeters } from "./distance";
import type { Place } from "./types";

const USER_AGENT = process.env.OVERPASS_USER_AGENT ?? "HalalSearch/0.1";

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    postcode?: string;
    country?: string;
    osm_value?: string;
    type?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  osm_type?: string;
  osm_id?: number;
  type?: string;
}

function osmTypeToLabel(t?: string): string {
  switch ((t ?? "").toUpperCase()) {
    case "N":
      return "node";
    case "W":
      return "way";
    case "R":
      return "relation";
    default:
      return (t ?? "node").toLowerCase();
  }
}

function placeIdFrom(osmType?: string, osmId?: number, lat?: number, lng?: number): string {
  if (osmType && osmId != null) return `${osmType}/${osmId}`;
  return `geo/${lat ?? 0},${lng ?? 0}`;
}

async function searchPhoton(
  query: string,
  lat?: number,
  lng?: number,
): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: "15" });
  if (lat != null && lng != null) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photon request failed: ${res.status}`);
  const json = (await res.json()) as PhotonResponse;
  const places: Place[] = [];
  for (const feature of json.features ?? []) {
    const coords = feature.geometry?.coordinates;
    const props = feature.properties ?? {};
    if (!coords) continue;
    const [lngCoord, latCoord] = coords;
    const name = props.name?.trim();
    if (!name) continue;
    const osmType = osmTypeToLabel(props.osm_type);
    const addressParts = [
      [props.housenumber, props.street].filter(Boolean).join(" "),
      props.city,
      props.postcode,
      props.country,
    ].filter(Boolean);
    places.push({
      placeId: placeIdFrom(osmType, props.osm_id, latCoord, lngCoord),
      name,
      address: addressParts.length ? addressParts.join(", ") : undefined,
      lat: latCoord,
      lng: lngCoord,
      osmTags: {},
      osmHalalSignal: false,
      source: "geocode",
    });
  }
  return places;
}

async function searchNominatim(
  query: string,
  lat?: number,
  lng?: number,
): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "15",
    addressdetails: "1",
  });
  // Bias (not restrict) results toward the user's area.
  if (lat != null && lng != null) {
    const d = 1.0;
    params.set("viewbox", `${lng - d},${lat + d},${lng + d},${lat - d}`);
    params.set("bounded", "0");
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nominatim request failed: ${res.status}`);
  const json = (await res.json()) as NominatimResult[];
  const places: Place[] = [];
  for (const r of json) {
    const latNum = Number(r.lat);
    const lngNum = Number(r.lon);
    const name = (r.name || r.display_name?.split(",")[0] || "").trim();
    if (!name || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) continue;
    places.push({
      placeId: placeIdFrom(r.osm_type, r.osm_id, latNum, lngNum),
      name,
      address: r.display_name,
      lat: latNum,
      lng: lngNum,
      osmTags: {},
      osmHalalSignal: false,
      source: "geocode",
    });
  }
  return places;
}

function dedupe(places: Place[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const place of places) {
    if (seen.has(place.placeId)) continue;
    seen.add(place.placeId);
    out.push(place);
  }
  return out;
}

/** Order results nearest-first when we know the user's location. */
function sortByDistance(places: Place[], lat?: number, lng?: number): Place[] {
  if (lat == null || lng == null) return places;
  return [...places].sort(
    (a, b) =>
      haversineMeters(a.lat, a.lng, lat, lng) -
      haversineMeters(b.lat, b.lng, lat, lng),
  );
}

/**
 * Search for places by name/address, local-first. Photon (biased to the user's
 * location) first, Nominatim as fallback; results are ordered by distance from
 * the user so nearby matches surface first.
 */
export async function searchPlaces(
  query: string,
  lat?: number,
  lng?: number,
): Promise<Place[]> {
  let results: Place[] = [];
  try {
    results = await searchPhoton(query, lat, lng);
  } catch {
    results = [];
  }
  if (results.length === 0) {
    try {
      results = await searchNominatim(query, lat, lng);
    } catch {
      results = [];
    }
  }
  return sortByDistance(dedupe(results), lat, lng);
}
