# HalalSearch

Find halal food places on a map. The app shows nearby restaurants from
OpenStreetMap, flags places already tagged halal/vegetarian/vegan, and lets you
run an **AI-assisted halal check** (grounded in Google Search, with cited
sources) for any place — either on demand or in the background.

> ⚠️ Halal status shown here is an **AI estimate** based on public sources, not a
> religious certification. Always verify with the establishment.

## Features

- 📍 **Near me**: uses your browser location to show nearby food places on a map.
- ✅ **Instant OSM signals**: places tagged `diet:halal` / `diet:vegetarian` /
  `diet:vegan` (or halal-associated cuisines) are highlighted immediately.
- 🤖 **AI halal check**: tap a place → "Validate with AI" → returns a nuanced
  verdict (`halal` / `likely halal` / `not halal` / `unclear`), confidence,
  evidence bullets, and clickable **source links**.
- 🔁 **Auto-validate (opt-in)**: toggle it on to validate the nearest N places in
  the background; verdicts stream into the map live. Off by default to keep
  Gemini cost predictable.
- 🔎 **Search**: find a restaurant/address by name and check it before visiting.
- 🗺️ **Directions**: one-click "Open in Google Maps" deep link.
- 🧭 **Distances** computed client-side.

## How it works

| Concern | Choice |
| --- | --- |
| Map rendering | MapLibre GL + OpenStreetMap vector tiles (no API key) |
| Nearby discovery | Overpass API (raced across public mirrors); falls back to the map's own vector-tile POIs if all mirrors are down |
| Place search | Photon, falling back to Nominatim |
| Halal determination | Gemini API **"Grounding with Google Search"** (`google_search` tool) |
| App framework | Next.js (App Router) + TypeScript + Tailwind CSS |

Data flow:

```
Browser ── geolocation ──▶ MapLibre map
   ├─ GET  /api/nearby?lat&lng&radius   → Overpass  → normalized places
   ├─ GET  /api/search?q&lat&lng        → Photon/Nominatim
   ├─ POST /api/validate                → Gemini grounding → verdict + sources
   └─ POST /api/validate/stream (SSE)   → background validation of nearest N
```

The Gemini API key never leaves the server; the browser only talks to this app's
own API routes.

## Getting started

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then edit .env.local
npm run dev
```

Open http://localhost:3000. The browser will ask for location permission.

### Configuration

Set these in `.env.local`:

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes (for real AI checks) | From https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | No | Override the model (defaults to a Flash-tier model) |
| `GEMINI_MOCK` | No | `1` = return canned verdicts, no Gemini calls/billing (for UI dev & tests) |
| `OVERPASS_URL` | No | Override the primary Overpass endpoint |
| `OVERPASS_USER_AGENT` | No | Identify your app to OSM services |
| `NEXT_PUBLIC_MAP_STYLE_URL` | No | MapLibre style URL (defaults to OpenFreeMap "liberty") |
| `NEXT_PUBLIC_ENABLE_GOOGLE_CSE` | No | `1` = show the embedded Google Programmable Search Engine pane (off by default) |
| `NEXT_PUBLIC_GOOGLE_CSE_CX` | No | Google Programmable Search Engine id (`cx`) used by that pane |
| `TURSO_DATABASE_URL` | No | Community DB URL (defaults to `file:./data/halal.db`); set to a Turso URL in production |
| `TURSO_AUTH_TOKEN` | No | Turso auth token (only for a remote DB) |

To try the UI without spending anything:

```bash
# .env.local
GEMINI_MOCK=1
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |

## Cost & legal notes

- **Gemini grounding** is billed per executed search query (5,000/month free,
  then ~$14/1,000). Each validation is ~1–2 searches. Auto-validate is capped
  (default 25) and off by default; results are cached in memory for ~1 hour.
- **Grounded results must not be persisted.** Google's terms prohibit caching,
  storing, or building a database from grounded results — they may only be shown
  to the end user for their prompt. This app therefore keeps verdicts in a
  short-lived in-memory cache only (no database).
- **OSM services**: requests send a `User-Agent`; keep usage modest and respect
  each provider's usage policy.

## Community layer

Users can add their **own** halal assessment (Halal / Not halal / Unclear + an
optional note) from the place card. These are stored in a lightweight libSQL
database (`places` + `reports`) and aggregated into a summary; a community
verdict is only shown once there are at least 3 reports. Stored community data is
shown first, which reduces AI calls.

This is **user-generated content only** — AI results are never stored (see
`docs/DESIGN.md` for the reasoning and the legal constraints). The community
write path is deliberately independent of the AI check.

The DB defaults to a local SQLite file (`data/halal.db`, git-ignored). For
production, set `TURSO_DATABASE_URL` (+ `TURSO_AUTH_TOKEN`) to a Turso database —
same client, no code change.

## Project structure

```
app/
  page.tsx                       # map page
  api/nearby/route.ts            # Overpass nearby search
  api/search/route.ts            # Photon/Nominatim place search (local-first)
  api/validate/route.ts          # single-place AI check (ephemeral)
  api/validate/stream/route.ts   # SSE batch validation
  api/report/route.ts            # store a community assessment
  api/places/summaries/route.ts  # batch community summaries
components/
  HalalSearchApp.tsx             # top-level client app
  MapView.tsx                    # MapLibre map + markers
  PlacePin.tsx                   # teardrop pin (place type + halal status)
  PlaceCard.tsx                  # place card (AI verdict, community, links)
  CommunitySection.tsx           # community summary + "add your assessment"
  GoogleSearchPane.tsx           # optional embedded PSE (flagged off)
  SearchBox.tsx, SettingsPanel.tsx, Disclaimer.tsx, useSettings.ts
lib/
  overpass.ts, geocode.ts        # data sources
  gemini.ts, prompts.ts          # AI halal check
  db.ts, community.ts            # community DB + scoring
  cache.ts, distance.ts, status.ts, types.ts, api.ts, clientId.ts
scripts/
  copy-maplibre-worker.mjs       # maplibre worker files for Next/Turbopack
docs/
  DESIGN.md                      # design decisions + legal constraints
```

## Known limitations

- OSM halal tagging coverage is uneven, so some areas show few labelled places;
  use search + AI check, or enable auto-validate, to fill the gaps.
- Public Overpass endpoints are frequently overloaded; the app races several
  mirrors, retries, caches results for 5 minutes, and — if every mirror fails —
  falls back to food places from the map's own vector tiles (no OSM halal tags
  in that mode, but you can still validate each place with AI).
- Combining Gemini structured output with grounding can drop citation metadata;
  this app reads citations from the grounding metadata separately and parses the
  verdict from the model text.
- Community reports are anonymous and unmoderated in this version; treat the
  score as a signal, not a certification.

## Roadmap

- Moderation/abuse tooling and optional accounts (keep anonymous contribution).
- Android client (reuse the same REST/SSE API routes).
