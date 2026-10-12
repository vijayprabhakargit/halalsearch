# HalalSearch — Design Decisions

This document records the product and engineering decisions made while building
HalalSearch, with the reasoning and the constraints behind each. It is meant as
future reference so the "why" is not lost.

---

## 1. Product

HalalSearch helps people find halal food places on a map. It shows nearby food
places (from OpenStreetMap), flags ones already tagged halal/vegetarian/vegan,
and lets a user get a halal assessment either from a community layer (stored) or
from an on-demand AI check (ephemeral).

Explicitly **not** in scope for the first web version: user accounts, the Android
client, and persisting AI results.

---

## 2. Architecture at a glance

| Concern | Choice | Why |
| --- | --- | --- |
| Web framework | Next.js (App Router) + TypeScript + Tailwind | One deployable app; server routes hide secrets and proxy third parties; the same REST routes can later serve an Android client |
| Map rendering | MapLibre GL + OpenStreetMap vector tiles | Free, no API key, full control of markers |
| Nearby discovery | Overpass API (raced across public mirrors) with a map-tile fallback | Free OSM data; resilient to Overpass outages |
| Place search | Photon, falling back to Nominatim | Free OSM geocoding |
| Halal AI check | Gemini API "Grounding with Google Search" | Sanctioned equivalent of "Google AI Mode"; returns an answer with cited sources |
| Persistence | libSQL (`@libsql/client`): local file in dev, Turso in prod | Lightweight, one API for local and hosted |
| Directions | Google Maps deep link (outbound) | Free, no Maps API/billing |

Data flow:

```
Browser ── geolocation ──▶ MapLibre map
  ├─ GET  /api/nearby?lat&lng&radius   → Overpass (raced) → normalized places
  │                                       └─ on failure → map-tile POIs
  ├─ GET  /api/search?q&lat&lng        → Photon/Nominatim (local-first)
  ├─ POST /api/validate                → Gemini grounding → verdict + sources (EPHEMERAL)
  ├─ POST /api/validate/stream (SSE)   → background validation of nearest N
  ├─ POST /api/places/summaries        → community summaries from the DB
  └─ POST /api/report                  → store a user's own assessment (DB)
```

---

## 3. Key decisions and rationale

### 3.1 "Piggy-back on Google AI Mode" → Gemini grounding instead
There is **no official API** for Google AI Mode / AI Overviews. Scraping it is
fragile and is exactly what Google is litigating (SerpApi / SearchGuard / DMCA).
The supported equivalent is the **Gemini API `google_search` grounding tool**,
which runs Google Search and returns an answer **with inline citations**. Chosen
for legality and reliability.

### 3.2 Google Maps (migrated from MapLibre + OSM)
The first version used MapLibre + OSM (free, `diet:halal` tags, no billing).
We migrated to **Google Maps JS + Places API (New)** for much better coverage and
because Google exposes `halal_restaurant` / `vegetarian_restaurant` /
`vegan_restaurant` as place types (returned in `types`) — the exact signal the
product wanted. Accepted trade-offs: per-SKU billing (Nearby Search Pro ~5,000
free/month, then ~$32/1k) and Maps Platform caching limits (only `place_id`
storable long-term). The OSM provider (Overpass + Photon) is kept in the repo,
unused, behind `lib/providers/index.ts`.

### 3.3 Cost control is user-driven, not automatic
When enabled, the AI check is billed per executed search (5,000 free/month, then
~$14/1,000). Decision: the AI check is **off by default** and, when on,
auto-validate is off, capped (default 25), and cached in memory. Map data comes
from Google Places (see 3.2).

### 3.4 Verdict model: evidence + nuance + disclaimer
Halal is a religious/dietary requirement; a wrong "halal" is harmful. The AI
returns **evidence and a nuanced verdict** (`halal` / `likely_halal` /
`not_halal` / `unclear`) with confidence and cited sources, never a bare
"certified halal", always with an "AI estimate — not a certification" disclaimer.

### 3.5 Marker design
Rather than the basemap's own POI icons (which we can't restyle or attach our
status to), we render a **teardrop pin**: **icon = place type** (from cuisine)
and **colour + badge = halal status**.

### 3.6 Search is local-first
Places Text Search is biased with a location circle and results are **sorted by
distance from the user** and shown with a distance label, so nearby matches
surface first.

### 3.7 OSM provider resilience (kept, unused)
The Overpass lookup (in the unused OSM provider) raced public mirrors, retried,
cached for 5 minutes, and fell back to map-tile POIs. None of this runs now that
the active provider is Google Places; it is retained only so we can switch back.

### 3.8 (Historical) MapLibre worker under Next/Turbopack
For the retired MapLibre path: maplibre-gl v6 needed `setWorkerUrl()` plus a copy
of its worker files, because Turbopack emitted the worker without its sibling.
No longer part of the app.

### 3.9 Graceful degradation when grounding is unavailable
If the grounded call fails with 429/403 (quota/billing), the app retries the same
prompt **without grounding**, returns an answer flagged `grounded: false`, and
the UI marks it **"Not web-verified — no cited sources."** Grounding itself
requires billing enabled on the Google Cloud project.

---

## 4. Legal / ToS constraints (important)

These constraints shape the data model. They are our reading, not legal advice;
for a public launch, get counsel or ask Google for explicit permission.

### 4.1 Gemini grounded results cannot be stored
Gemini API Additional ToS:

> "You will not… cache, frame, syndicate, resell, analyze, train on, or otherwise
> learn from Grounded Results or Search Suggestions… it is a violation of these
> terms to use Grounding with Google Search to extract or collect one or more of
> these components for another purpose (for example… using Links to build an
> index)."
>
> "You may allow end user(s) to copy and store individual Grounded Results that
> were displayed to them… as long as you do not allow Grounded Results to be
> accessed or collected by automated or programmatic means **or to be used to
> create a database**."

Therefore:
- AI verdicts (and their answer text, evidence, links) are **never persisted**.
  They are shown live and cached in memory only.
- The "to be used to create a database" clause has **no** "automated" qualifier,
  so a human click does **not** by itself make funneling an AI verdict into the
  DB permissible.

### 4.2 What we may store
| Data | Stored? | Basis |
| --- | --- | --- |
| Place/location (from OSM) | Yes | ODbL (attribution + share-alike) |
| Community contributions (user's own halal/not/unclear + note) | Yes | User-generated content |
| Derived community score | Yes | Computed from our own UGC |
| AI verdict from grounding (+ links) | **No** | Gemini ToS |
| AI verdict from an ungrounded call | Possible, but avoided | Allowed, but lower reliability |

### 4.3 The community write path must be independent
To stay within the ToS:
1. The AI check is **display-only and ephemeral**; nothing AI-derived reaches the DB.
2. "Add your assessment" is a **separate, explicit** action; the user picks the
   verdict themselves, **not pre-filled** from the AI result.
3. We store only the user's own fields — never AI text, evidence, or links.
4. The AI section and the community section stay visually distinct so the flow
   does not read as "confirm the AI."

### 4.4 Other services
- OSM (Overpass/Nominatim/Photon): set a `User-Agent`, keep request rates modest.
- Outbound Google Maps links and the optional Google Programmable Search Engine
  embed are permitted; iframing `google.com/search` is not (blocked by
  `X-Frame-Options`/CSP and against ToS).

---

## 5. Data model (community layer)

Minimal on purpose — only what is needed.

```sql
CREATE TABLE places (
  place_id TEXT PRIMARY KEY,   -- OSM id, e.g. "node/12345"
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT,
  cuisine TEXT,
  source TEXT,                 -- 'osm' | 'tile' | 'geocode'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT NOT NULL,
  verdict TEXT NOT NULL,       -- 'halal' | 'not_halal' | 'unclear'
  note TEXT,
  client_id TEXT,              -- anonymous contributor id (no accounts yet)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Score: aggregate `reports` per place. A community verdict is only shown once
there are enough independent reports (`MIN_REPORTS_FOR_VERDICT = 3`); otherwise
the summary shows raw counts and no verdict. This avoids over-trusting a single
contribution.

---

## 6. Roadmap / follow-ups

- Community layer (this change): contributions + score, AI stays ephemeral.
- Moderation/abuse: rate limits, flagging, possibly weighted/trusted contributors.
- Accounts (optional) for reputation; keep anonymous contribution possible.
- Android client reusing the REST/SSE routes.
- If stored AI verdicts are ever wanted, the only clean routes are an ungrounded
  model or a search provider whose terms permit storage — a quality/legal trade
  we deliberately avoid for a halal determination.

### Done: Google Maps migration
Migrated (see 3.2). Notes from the migration, correcting the earlier estimate:

- **`halal_restaurant` / `vegetarian_restaurant` / `vegan_restaurant` are Table A
  types** — returned in a place's `types`, so we badge from `types` without
  filtering by halal. Broad primary types (`restaurant`, `cafe`,
  `fast_food_restaurant`, `coffee_shop`, `bakery`) also return restaurant
  subtypes, so halal places are not missed.
- Nearby Search uses `includedPrimaryTypes` (to exclude non-food venues that
  merely contain a cafe) and `rankPreference: POPULARITY` (DISTANCE returned a
  cluster of obscure ghost listings). It returns **at most 20 results with no
  pagination**, so nearby is deliberately capped at 20 (with an optional second
  type bucket for cafes/bars — see the cost note). **Place details are fetched on
  demand** (`/api/place`) when a user opens a place, and Places responses are
  **cached in memory for the browser session** (cleared on reload).
- Text Search is biased to the user and sorted by distance.
- Only `place_id` may be stored long-term; other Places data is cached ≤30 days.
  We currently keep Google name/address/coords in `places` indefinitely — a ToS
  issue to fix (store `place_id` + our own fields; treat Google fields as a
  ≤30-day cache).
