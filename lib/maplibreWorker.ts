import { setWorkerUrl } from "maplibre-gl";

// MapLibre GL JS v6 needs an explicit worker URL when bundled. The worker files
// are served from public/maplibre (see scripts/copy-maplibre-worker.mjs).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
