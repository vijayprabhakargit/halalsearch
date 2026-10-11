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

### 3.2 MapLibre + OSM instead of Google Maps
Google Maps JS/Places would match the "built on Google Maps" vision but brings
billing and caching restrictions, and there is no structured "halal" field in
the Places API. OSM + MapLibre is free, has `diet:halal` tags, and gives full
control. Directions are still offered via a free Google Maps deep link.

### 3.3 Cost control is user-driven, not automatic
Gemini grounding is billed per executed search (5,000 free/month, then ~$14/1,000).
Decision: **auto-validate is off by default**; the map shows only OSM-tagged
places until the user acts. An opt-in "auto-validate nearby" toggle validates the
nearest **N (default 25, configurable)** with streamed results. A short-lived
in-memory cache avoids repeat charges within a session.

### 3.4 Verdict model: evidence + nuance + disclaimer
Halal is a religious/dietary requirement; a wrong "halal" is harmful. The AI
returns **evidence and a nuanced verdict** (`halal` / `likely_halal` /
`not_halal` / `unclear`) with confidence and cited sources, never a bare
"certified halal", always with an "AI estimate — not a certification" disclaimer.

### 3.5 Marker design
Basemap POI icons are baked into the tile style's symbol layers and cannot be
reliably reused for our data-driven points. Instead, a **teardrop pin** encodes:
**icon = place type** (from cuisine: restaurant/cafe/fast food/dessert) and
**colour + badge = halal status**. Bigger, clearer, and independently meaningful.

### 3.6 Search is local-first
Photon gets a location bias, but results are additionally **sorted by distance
from the user** and shown with a distance label; the Nominatim fallback gets a
`viewbox` bias. Nearby matches surface first, then others by distance.

### 3.7 Overpass resilience + tile fallback
Public Overpass mirrors are frequently overloaded (500/504). The app **races the
mirrors concurrently**, retries once, and **caches results for 5 minutes**. If
every mirror fails, it falls back to the food POIs already present in the map's
vector tiles (`poi` layer: `restaurant`, `cafe`, `fast_food`, `ice_cream`,
`bakery`) via `querySourceFeatures` — no extra request. Note: the style's POI
symbol layers only render at zoom ≥ 15, so we query the **source** tiles, not
just rendered features. Tile-derived places carry no `diet:halal` tags, so they
appear unvalidated.

### 3.8 MapLibre worker under Next/Turbopack
maplibre-gl v6 loads its worker from a separate file and requires
`setWorkerUrl()`. Next/Turbopack emits the worker without its sibling
`maplibre-gl-shared.mjs`, so the worker 404s and the map is blank. Fix: a
`postinstall`/`predev`/`prebuild` script copies both files into `public/maplibre/`
(git-ignored) and `lib/maplibreWorker.ts` calls `setWorkerUrl`.

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
