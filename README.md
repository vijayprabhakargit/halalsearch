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
  optional note. Reports are stored and shown to others; a lone vote reads as
  **low confidence**, and "halal" is confirmed at **≥2 contributors** with a
  strong majority.
- 👆 **Tap to check**: click any spot on the map — even a place that isn't among
  the nearby pins — to fetch and tag it on demand (community summary included).
- 🔎 **Search**: find a restaurant/address by name; results are local-first.
- 🗺️ **Directions**: one-click "Open in Google Maps" deep link.
- 🧭 **Distances** computed client-side.
- 🤖 **AI halal check** (on by default): a Gemini-grounded check with cited
  sources. Strictly **on-demand** — it runs only when you open a place and tap
  "Validate with AI" (nothing is invoked automatically). Requires `GEMINI_API_KEY`;
  hide it with `NEXT_PUBLIC_ENABLE_AI_CHECK=0`.

## How to use

1. **Allow location** — the map opens on you (blue dot) and loads nearby food
   places.
2. **Read the pins** — colour is the halal status (grey = not checked yet; the
   in-app **ⓘ** button shows the full legend).
3. **Tap a pin** — open its card: Google's label, the community's reports, and a
   one-tap "Open in Google Maps".
4. **Tap anywhere on the map** — even a place without a pin — to look it up and
   check it on demand.
5. **Search** — type a restaurant or an area in the box; results are local-first.
6. **Pan, then "Search this area"** — load places in the new view.
7. **Filter** — the chips (bottom-left): Halal / Veg / Community / Not validated.
8. **Contribute** — open a place → *Add your own assessment* (Halal / Not halal /
   Unclear). One report per person; "halal" is confirmed at ≥2 agreeing reports.

The in-app **ⓘ button** (bottom-right, above the map controls) mirrors these
instructions.

> Halal status is an estimate from public data and community reports — not a
> religious certification. Always verify with the establishment.

## How it works

| Concern | Choice |
| --- | --- |
| Map rendering | Google Maps JavaScript API |
| Nearby discovery | Google Places API (New) Nearby Search — **up to 20 per area** (single request) |
| Place details | Google Places API (New) Place Details — **on demand**, when a user opens a place |
| Place search | Google Places API (New) Text Search (local-first) |
| Halal signals | Google place types (`halal_restaurant` / `vegetarian_restaurant` / `vegan_restaurant`) + **community reports** (stored) |
| Community data | libSQL (`@libsql/client`): local file in dev, Turso in production |
| AI halal check | Gemini grounding — **optional, off by default** |
| App framework | Next.js (App Router) + TypeScript + Tailwind CSS |

Data flow:

```
Browser ── geolocation ──▶ Google Map
   ├─ GET  /api/nearby?lat&lng&radius   → Places Nearby Search → places
   ├─ GET  /api/search?q&lat&lng        → Places Text Search (local-first)
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
| `NEXT_PUBLIC_ENABLE_AI_CHECK` | No | On-demand AI halal check is **on by default**; set `0` to hide it (nothing runs automatically) |
| `GEMINI_API_KEY` | No (only if the AI check is enabled) | From https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | No | Override the model (defaults to a Flash-tier model) |
| `GEMINI_MOCK` | No | `1` = return canned verdicts, no Gemini calls/billing (for UI dev & tests) |
| `COMMUNITY_STRICT_HALAL` | No | `1` = require ≥2 agreeing reports (and a strong majority) for a community "halal" verdict; off by default (a single halal vote is enough) |
| `OVERPASS_URL` | No (OSM provider, unused) | Override the primary Overpass endpoint |
| `OVERPASS_USER_AGENT` | No (OSM provider, unused) | Identify your app to OSM services |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | No | Google Maps Map ID for advanced markers (defaults to `DEMO_MAP_ID`) |
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
- **Google Maps Platform is billed per SKU** (Dynamic Maps loads; Nearby Search
  Pro ~5,000 free/month then ~$32/1k; Text Search/Details pro-rata). Nearby is a
  **single request capped at Google's 20 results** (no pagination), place details
  are fetched **on demand** when a user opens a place, and Places responses are
  **cached in memory for the browser session** (cleared on reload) plus a short
  **10-minute server cache per area**, so repeated searches/clicks don't re-bill.
- **Maps Platform caching:** only `place_id` may be stored long-term, so the
  community DB keys on `place_id`.

## Community layer

Users can add their **own** halal assessment (Halal / Not halal / Unclear + an
optional note) from the place card. These are stored in a lightweight libSQL
database (a `reports` table keyed by Google `place_id`) and aggregated into a
summary — no Google place data (name/address/coords) is persisted. Stored
community data is the primary source of halal status.

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
  api/nearby/route.ts            # nearby places (active provider)
  api/search/route.ts            # place search (active provider)
  api/validate/route.ts          # single-place AI check (ephemeral)
  api/validate/stream/route.ts   # SSE batch validation
  api/report/route.ts            # store a community assessment
  api/places/summaries/route.ts  # batch community summaries
  api/health/route.ts            # liveness + DB probe
components/
  HalalSearchApp.tsx             # top-level client app
  MapView.tsx                    # Google Map + markers
  PlacePin.tsx                   # teardrop pin (place type + halal status)
  PlaceCard.tsx                  # place card (community, links, optional AI)
  CommunitySection.tsx           # community summary + "add your assessment"
  GoogleSearchPane.tsx           # optional embedded PSE (flagged off)
  DonateButton.tsx               # optional donate link (env-gated)
  SearchBox.tsx, SettingsPanel.tsx, Disclaimer.tsx, useSettings.ts
lib/
  providers/google.ts            # active provider (Places API New)
  providers/index.ts             # provider selector
  overpass.ts, geocode.ts        # OSM provider (kept, unused)
  gemini.ts, prompts.ts          # AI halal check
  db.ts, community.ts            # community DB + scoring
  mapConfig.ts, cache.ts, distance.ts, status.ts, types.ts, api.ts, clientId.ts
docs/
  DESIGN.md                      # design decisions + legal constraints
  DEPLOYMENT.md                  # deployment plan
```

## Known limitations

- Google's halal/veg labels are business-self-reported and coverage varies, so a
  missing label doesn't mean a place isn't halal — labels are a signal, not a
  guarantee.
- Nearby Search returns at most 20 results per request.
- Community reports are anonymous and unmoderated in this version; treat the
  score as a signal, not a certification.

## Roadmap

- **Tiered halal status** (next): show each signal with its source and
  confidence — Google Maps tag, community consensus (visit-weighted), and
  optional certification link.
- **Google AdSense** (parked): monetization is possible but needs approval and
  real content pages; the app is navigation-heavy so approval is uncertain.
  Donations are the near-term support path.
- Moderation/abuse tooling and optional accounts (keep anonymous contribution).
- Android client (reuse the same REST/SSE API routes).

## Deployment

Live: **https://halalsearch.vercel.app/** — deployed on Vercel with a Turso
libSQL database for the community layer.

Import the repo into Vercel and set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
`GOOGLE_MAPS_API_KEY`, and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (plus
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`), then deploy. DB tables are created
automatically. The on-demand AI check is on by default — add `GEMINI_API_KEY` to
use it (or set `NEXT_PUBLIC_ENABLE_AI_CHECK=0` to hide it). Full step-by-step,
verification checklist, and rollback are in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## License

[MIT](LICENSE).

Map data and imagery © Google (Google Maps Platform — Maps JavaScript API and
Places API).
