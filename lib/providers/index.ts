import type { Place } from "../types";

export interface PlaceProvider {
  getNearbyPlaces(
    lat: number,
    lng: number,
    radius: number,
    limit: number,
  ): Promise<Place[]>;
  searchPlaces(query: string, lat?: number, lng?: number): Promise<Place[]>;
  getPlaceDetails(placeId: string): Promise<Place | null>;
}

/**
 * Active provider: Google Places (New). Swapping the export below to `./osm`
 * reverts to OpenStreetMap (Overpass + Photon) — that module is kept in the
 * repo, unused.
 */
export { getNearbyPlaces, searchPlaces, getPlaceDetails } from "./google";
