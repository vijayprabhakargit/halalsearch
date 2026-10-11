// MapLibre GL JS v6 loads its web worker from a separate file next to its own
// script. Next.js/Turbopack emits the worker but not its `maplibre-gl-shared.mjs`
// sibling, so the worker 404s and the map renders blank.
//
// Fix (per MapLibre docs for Next.js): serve both files from public/ and point
// MapLibre at the worker with setWorkerUrl(). This script keeps those copies in
// sync with the installed maplibre-gl version.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "node_modules", "maplibre-gl", "dist");
const targetDir = join(root, "public", "maplibre");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(sourceDir)) {
  console.warn("[maplibre-worker] maplibre-gl is not installed yet; skipping copy.");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  const from = join(sourceDir, file);
  if (!existsSync(from)) {
    console.warn(`[maplibre-worker] missing ${file}; skipping.`);
    continue;
  }
  copyFileSync(from, join(targetDir, file));
}
console.log(`[maplibre-worker] copied worker files to public/maplibre`);
