# HalalSearch

Find halal food places on a map, driven by the community. The app shows nearby
restaurants, highlights ones already labelled halal / vegetarian / vegan, and
lets users mark places they know so the next person benefits. Assessments are
stored, so the directory gets more useful over time.

**Live:** https://halalsearch.vercel.app/

> ⚠️ Halal status shown here is based on public data and community reports — not a
> religious certification. Always verify with the establishment.

## Features

- 📍 **Near me**: uses your browser location to show nearby food places on a map.
- ✅ **Halal/veg signals**: places already labelled halal / vegetarian / vegan in
  the map data are highlighted immediately.
- 🙋 **Community halal reports**: mark a place Halal / Not halal / Unclear, with an
  optional note. Reports are stored and shown to others; a community verdict
  appears once there are at least 3.
- 🔎 **Search**: find a restaurant/address by name; results are local-first.
- 🗺️ **Directions**: one-click "Open in Google Maps" deep link.
- 🧭 **Distances** computed client-side.
- 🤖 **AI halal check** (optional, off by default): a Gemini-grounded check with
  cited sources, kept in code and enabled with `NEXT_PUBLIC_ENABLE_AI_CHECK`.

## How it works

| Concern | Choice |
| --- | --- |
| Map rendering | MapLibre GL + OpenStreetMap vector tiles (no API key) |
| Nearby discovery | Overpass API (raced across public mirrors); falls back to the map's own vector-tile POIs if all mirrors are down |
| Place search | Photon, falling back to Nominatim |
| Halal signals | Map-data halal / vegetarian / vegan tags + **community reports** (stored) |
| Community data | libSQL (`@libsql/client`): local file in dev, Turso in production |
| AI halal check | Gemini grounding — **optional, off by default** |
| App framework | Next.js (App Router) + TypeScript + Tailwind CSS |

Data flow:

```
Browser ── geolocation ──▶ MapLibre map
   ├─ GET  /api/nearby?lat&lng&radius   → Overpass → normalized places
   ├─ GET  /api/search?q&lat&lng        → Photon/Nominatim (local-first)
   ├─ POST /api/report                  → store a community assessment
   ├─ POST /api/places/summaries        → community summaries
   └─ POST /api/validate (/stream)      → optional AI check (off by default)
```

Server secrets (the Gemini key and DB token) never reach the browser; the browser
only talks to this app's own API routes.

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
| `NEXT_PUBLIC_ENABLE_AI_CHECK` | No | `1` = show the AI halal check (off by default) |
| `GEMINI_API_KEY` | No (only if the AI check is enabled) | From https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | No | Override the model (defaults to a Flash-tier model) |
| `GEMINI_MOCK` | No | `1` = return canned verdicts, no Gemini calls/billing (for UI dev & tests) |
| `OVERPASS_URL` | No | Override the primary Overpass endpoint |
| `OVERPASS_USER_AGENT` | No | Identify your app to OSM services |
| `NEXT_PUBLIC_MAP_STYLE_URL` | No | MapLibre style URL (defaults to OpenFreeMap "liberty") |
| `NEXT_PUBLIC_ENABLE_GOOGLE_CSE` | No | `1` = show the embedded Google Programmable Search Engine pane (off by default) |
| `NEXT_PUBLIC_GOOGLE_CSE_CX` | No | Google Programmable Search Engine id (`cx`) used by that pane |
| `NEXT_PUBLIC_DONATE_URL` | No | Donation link shown next to Settings (hidden if unset) |
| `TURSO_DATABASE_URL` | No | Community DB URL (defaults to `file:./data/halal.db`); set to a Turso URL in production |
| `TURSO_AUTH_TOKEN` | No | Turso auth token (only for a remote DB) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No (Google Maps migration) | Browser key, HTTP-referrer restricted |
| `GOOGLE_MAPS_API_KEY` | No (Google Maps migration) | Server key for Places API (New) |

To try the AI check without spending anything (it is off by default):

```bash
# .env.local
NEXT_PUBLIC_ENABLE_AI_CHECK=1
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

## Cost & open-source notes

- **This is an open-source, self-funded project.** Hosting (Vercel), the database
  (Turso), and any AI usage are borne by the maintainer. Donations help cover
  these — set `NEXT_PUBLIC_DONATE_URL` to show a Donate button next to Settings.
- **The AI check is off by default**, so the app runs at effectively no API cost.
  When enabled, Gemini grounding is billed per executed search (5,000/month free,
  then ~$14/1,000) and auto-validate is capped (default 25); results are cached in
  memory for ~1 hour.
- **Grounded results must not be persisted.** Google's terms prohibit caching,
  storing, or building a database from grounded results — they may only be shown
  to the end user for their prompt. This app stores **community reports only**;
  AI verdicts stay in a short-lived in-memory cache.
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
  DonateButton.tsx               # optional donate link (env-gated)
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

- **Google Maps migration** (next): swap MapLibre/OSM for Google Maps JS + Places
  API (New) for better coverage, and to use Google's native `halal_restaurant` /
  `vegetarian_restaurant` / `vegan_restaurant` place types as a halal signal.
  Billing is per SKU (Nearby Search Pro: 5,000 free/month, then ~$32/1k) —
  mitigated with debounce + area caching to stay near free. Only `place_id` may be
  stored long-term, so the community DB will key on `place_id`. See `docs/DESIGN.md`.
- **Tiered halal status** (next): show each signal with its source and confidence —
  Google Maps tag, community consensus (visit-weighted), and optional certification
  link.
- **Google AdSense** (parked): monetization is possible but needs approval and
  real content pages; the app is navigation-heavy so approval is uncertain.
  Donations are the near-term support path.
- Moderation/abuse tooling and optional accounts (keep anonymous contribution).
- Android client (reuse the same REST/SSE API routes).

## Deployment

Live: **https://halalsearch.vercel.app/** — deployed on Vercel with a Turso
libSQL database for the community layer.

Import the repo into Vercel and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
(plus any optional vars), then deploy. DB tables are created automatically. Add
`GEMINI_API_KEY` + `NEXT_PUBLIC_ENABLE_AI_CHECK=1` only if you want the AI check
(and enable billing on the Google Cloud project for cited sources). Full
step-by-step, verification checklist, and rollback are in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## License

[MIT](LICENSE).

Map data © OpenStreetMap contributors (ODbL). Map tiles by
[OpenFreeMap](https://openfreemap.org/) / OpenMapTiles.
