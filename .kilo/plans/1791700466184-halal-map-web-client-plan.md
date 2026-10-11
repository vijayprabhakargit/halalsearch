# HalalSearch — Web Client (v1) Implementation Plan

## Goal

Build a web app that helps people find halal food places:
- On load, use the browser's current location and show nearby food places on a map.
- Immediately show places that are **explicitly tagged halal/vegetarian/vegan** in OpenStreetMap (OSM).
- Let the user **click any place and get an AI verdict** on whether it is halal, with cited sources ("halal certificate" card).
- Provide an optional **"Auto-validate nearby"** mode (off by default) that validates the nearest **N (default 25, configurable)** places in the background and streams verdicts into the UI live.
- Show distance and a free outbound **"Open in Google Maps"** deep link for directions.

Later (explicitly out of scope for v1): accounts, persistent database, community reviews/confirmation, and an Android client.

## Key Decisions (locked)

1. **Halal determination engine:** Gemini API **"Grounding with Google Search"** (`google_search` tool). This is the sanctioned, supported equivalent of "Google AI Mode" and returns an answer plus inline citations (`groundingMetadata` / `url_citation`). Scraping Google AI Mode is **not** used (no official API; against Google ToS; actively litigated).
2. **Map + discovery data:** **MapLibre GL + OpenStreetMap** (free). Discovery via **Overpass API**; search/geocoding via **Photon** (preferred) with **Nominatim** fallback. Directions provided via free Google Maps deep links (no Maps API).
3. **Web stack:** **Next.js (App Router) + TypeScript + Tailwind**, map via `react-map-gl` + `maplibre-gl`. Server API routes keep the Gemini key server-side and proxy Overpass/Photon.
4. **Default UX = on-demand.** Map shows OSM halal/veg-labelled places; clicking a place validates it. A settings toggle **"Auto-validate nearby" (default OFF)** enables background validation of the nearest N places (default 25, configurable).
5. **Verdict model = evidence + nuanced verdict + disclaimer** (never a bare yes/no). Verdicts: `halal`, `likely_halal`, `not_halal`, `unclear`, plus confidence, evidence bullets, cited sources, timestamp, and an **"AI estimate — not a certification"** disclaimer.
6. **No persistence in v1.** Validation results are cached **in-memory (server, short TTL ~1h)** and client settings in `localStorage` only. No database.

## Legal / ToS Constraints (must respect)

- **Gemini grounded results may NOT be cached/stored/syndicated or used to build a database.** They may only be shown to the end user for their prompt. Therefore the cache must be **ephemeral** (short TTL, display-only) and there must be **no DB of AI verdicts**. Community data later must be user-generated, not derived from grounded results.
- **OSM/Overpass/Nominatim usage policies:** set a descriptive `User-Agent`, keep request rates low (Nominatim ≤1 req/s), and cache Overpass responses briefly client/session side.
- Gemini grounding is billed per executed search query after the free tier; keep the auto-validate cap + cache to stay within limits (see Cost).

## Cost Model (context)

- Gemini 3-class grounding: **5,000 free search queries/month**, then **~$14 / 1,000** (~$0.014 each). Each place validation ≈ 1–2 searches. Plus negligible Flash token cost.
- Default (on-demand) usage = ~1 search per clicked place.
- Auto-validate ON with cap 25 = ≤25 searches per fresh area, then cached. Cap and toggle give the user direct cost control.

## Architecture & Data Flow

```
Browser (Next.js client)
  ├─ geolocation -> map center (MapLibre)
  ├─ GET /api/nearby?lat&lng&radius  -> server -> Overpass -> normalized places
  ├─ GET /api/search?q               -> server -> Photon/Nominatim -> place candidates
  ├─ POST /api/validate              -> server -> Gemini grounding -> verdict+evidence+sources
  └─ GET  /api/validate/stream?...   -> server -> SSE: validate nearest N, emit verdicts as ready
                                        (used only when Auto-validate is ON)
```

- **Place identity:** use OSM `type/id` (e.g. `node/12345`) as `placeId`. For Photon/Nominatim-only results, synthesize an id from `osm_type`+`osm_id` (or lat/lng hash).
- **Normalized place shape (`Place`):** `{ placeId, name, address?, lat, lng, osmTags: { cuisine?, "diet:halal"?, "diet:vegetarian"?, "diet:vegan"? }, source: 'osm'|'geocode' }`.
- **`Verdict` shape:** `{ placeId, verdict: 'halal'|'likely_halal'|'not_halal'|'unclear', confidence: number(0-1), evidence: string[], sources: {title,url}[], model, checkedAt, cached: boolean }`.

## Backend API Routes

1. `GET /api/nearby?lat&lng&radius(<=3000)&limit`
   - Build Overpass QL: `amenity~"restaurant|cafe|fast_food|food_court"` (and optionally `bar`) in radius; fetch tags `name,cuisine,diet:halal,diet:vegetarian,diet:vegan,addr:*,opening_hours`.
   - Return normalized `Place[]` + a derived `osmHalalSignal` flag per place (`diet:halal=yes`, or `diet:vegetarian=yes`/`diet:vegan=yes`, or halal-associated cuisine like `kebab`, `turkish`, `middle_eastern`).
2. `GET /api/search?q&lat&lng`
   - Photon (bias to current location) → fallback Nominatim. Return `Place[]` candidates.
3. `POST /api/validate` body `{ placeId, name, address?, lat, lng, osmTags? }`
   - Call Gemini `generateContent` (model: a current Flash-tier model) with `tools:[{google_search:{}}]`.
   - Prompt instructs: research this specific business; report (a) whether meat is zabiha/halal-certified, (b) whether pork/alcohol are served, (c) vegetarian/vegan options; then output a verdict, confidence, evidence bullets, and sources.
   - Map Gemini response → `Verdict`. Extract citations from grounding metadata.
   - Cache in-process (Map, TTL ~1h). Return `Verdict`.
4. `GET /api/validate/stream?placeIds=...` (Server-Sent Events)
   - Server validates provided places with **concurrency 3**, emits an SSE event per place as it resolves (`event: verdict`, `data: {json}`), then `event: done`.
   - Client uses this only when Auto-validate is ON. Respects the configured cap.

## Frontend

- **Map page (`app/page.tsx`):**
  - Request geolocation; center MapLibre on current location; error/permission-denied fallback (default center + manual search).
  - Fetch `/api/nearby` for the current view/radius.
  - **Default filter:** show OSM halal/veg-signalled places only; provide a **"Show all food places"** toggle to reveal untagged places (still clickable to validate).
  - **Markers colored by status:** green = halal/likely_halal, red = not_halal, amber = unclear, grey = unvalidated, animated/spinner = validating.
  - **Click marker → detail card ("certificate"):** place name/address, OSM tags, distance, **Validate** button → `POST /api/validate` → render verdict, confidence, evidence bullets, clickable **sources**, checkedAt, and the **AI-estimate disclaimer**; plus **"Open in Google Maps"** deep link (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` or name+address).
- **Search box:** type → `/api/search` suggestions → select → map flies to it and opens the certificate card (user triggers validate).
- **Settings panel (persisted in `localStorage`):** `autoValidate: boolean` (default `false`), `autoValidateCap: number` (default `25`), `radius: number` (default e.g. 1500 m).
  - When `autoValidate` is ON: on map load/pan, validate the nearest `autoValidateCap` places via SSE; update badges live; show a small "validating… (x/y)" indicator; skip already-cached places.
- **Distance:** compute haversine client-side; display m/km.
- **Global disclaimer banner:** "Halal status is an AI estimate based on public sources, not a religious certification. Verify with the establishment."

## Suggested Project Layout

```
app/
  page.tsx                 # map + search + settings UI
  api/nearby/route.ts
  api/search/route.ts
  api/validate/route.ts
  api/validate/stream/route.ts
components/
  MapView.tsx, PlaceMarker.tsx, PlaceCard.tsx (certificate), SearchBox.tsx, SettingsPanel.tsx, Disclaimer.tsx
lib/
  overpass.ts, geocode.ts, gemini.ts (grounding + verdict mapping), cache.ts (in-memory TTL), distance.ts, types.ts
  prompts.ts               # halal-research prompt builder
```

## Configuration / Secrets

- Server-only env: `GEMINI_API_KEY` (never exposed to client). Optional `GEMINI_MODEL` override.
- Optional env/config: Overpass endpoint, Photon/Nominatim endpoints, `OVERPASS_USER_AGENT`.
- Add `.env.local` to `.gitignore`; document required vars in README/`.env.example`.

## Risks & Mitigations

- **Sparse OSM halal tags:** many areas will show few labelled places → the click-to-validate and auto-validate modes are the coverage backstop; keep the "show all" toggle discoverable.
- **Structured-output + grounding citation bug (2026):** combining `responseSchema`/JSON with grounding can drop `groundingMetadata` (citations). Mitigation: request a clearly delimited JSON block in the model text (or plain text + parse), and read citations from grounding metadata separately; validate with a smoke test asserting sources are present.
- **Overpass/Nominatim rate limits & flakiness:** set `User-Agent`, low rates, short caching, graceful fallbacks (Photon↔Nominatim), timeout + retry.
- **Cost from auto-validate:** default OFF, hard cap, session cache, and (later) a global daily search counter.
- **False "halal" answers are harmful:** nuanced verdict + evidence + disclaimer; never display a bare "certified halal".
- **Geolocation denial:** handle gracefully with manual place/address search.

## Validation Plan

- **Unit tests:** Overpass response → `Place[]` normalization; `osmHalalSignal` derivation; haversine distance; Gemini response → `Verdict` mapping (incl. citation extraction); cache TTL behavior.
- **Mock mode:** `GEMINI_MOCK=1` env to return canned verdicts so UI/dev work incurs no billing.
- **Smoke test:** `/api/validate` on a known restaurant returns a verdict with ≥1 source URL.
- **Manual e2e:** grant geolocation → nearby halal-labelled places render → click → certificate shows verdict + sources + disclaimer → toggle auto-validate → badges fill in with "validating x/y" → reopen/pan uses cache (no re-billing).
- **Lint/typecheck/build:** run the project's `lint`, `typecheck`, and `build` scripts before considering v1 complete.

## Ordered Task List

1. Scaffold Next.js (TS, Tailwind, App Router); add `maplibre-gl`, `react-map-gl`; set up env handling and `.env.example`.
2. Implement `lib/types.ts`, `lib/distance.ts`, `lib/cache.ts` (in-memory TTL).
3. Implement `lib/overpass.ts` + `GET /api/nearby` (query, parse, normalize, `osmHalalSignal`).
4. Implement `lib/geocode.ts` (Photon + Nominatim fallback) + `GET /api/search`.
5. Implement `lib/prompts.ts` + `lib/gemini.ts` (grounding call, verdict mapping, citation extraction, mock mode) + `POST /api/validate` with caching.
6. Implement `GET /api/validate/stream` (SSE, concurrency 3, cap).
7. Build `MapView` + `PlaceMarker` (status colors), geolocation centering, nearby fetch, default halal-only filter + "show all" toggle.
8. Build `PlaceCard` ("certificate"), SearchBox, SettingsPanel (auto-validate toggle + cap + radius), Disclaimer banner, Google Maps deep link.
9. Wire auto-validate: on map load/pan, SSE stream nearest `cap`, live badge updates, "validating x/y" indicator, cache short-circuit.
10. Tests (unit + smoke), mock mode, then run lint/typecheck/build.

## Out of Scope (v1) / Future Seams

- No accounts, no database, no persistent AI-verdict store (ToS).
- **Community layer (follow-up):** overlay user-submitted halal confirmations/reviews keyed by `placeId`; must be user-generated (not derived from grounded results). Design `Place`/`Verdict` types and the REST route shape now so this can be added without rework.
- **Android client (follow-up):** reuse the same REST/SSE API routes.

## Open Items (defaults chosen; confirm during implementation)

- Map style/tiles: use a no-key OSM-based vector style (e.g. OpenFreeMap) or OSM raster tiles; confirm tile provider + attribution.
- Default radius (proposed 1500 m) and default cap (25).
- Which Flash-tier model id to target for grounding.
