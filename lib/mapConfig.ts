/** Fallback center when geolocation is unavailable. */
export const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 };

/** Browser key (HTTP-referrer restricted). Exposed to the client by design. */
export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Advanced markers need a Map ID; Google's DEMO_MAP_ID works for local/dev. */
export const GOOGLE_MAPS_MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
