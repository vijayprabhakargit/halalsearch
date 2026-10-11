# HalalSearch — Deployment Plan

Target: deploy the Next.js app to a serverless host with a hosted libSQL
community database. Vercel + Turso is the recommended path; alternatives are
listed at the end.

---

## 0. Prerequisites

- Repo pushed to GitHub (done).
- A Google AI Studio API key with **billing enabled** on the project (required
  for Grounding with Google Search — otherwise checks fall back to ungrounded).
- Accounts: Vercel (or Netlify), Turso.

---

## 1. Provision the community database (Turso)

Serverless hosts have no persistent disk, so the local `file:` DB does not work
in production. Turso is serverless SQLite using the same `@libsql/client` — no
code change.

```bash
turso auth login
turso db create halalsearch
turso db show halalsearch --url        # -> TURSO_DATABASE_URL (libsql://...)
turso db tokens create halalsearch     # -> TURSO_AUTH_TOKEN
```

Tables are created automatically on first request (no migration step).

---

## 2. Import the project into the host (Vercel)

1. Vercel → **Add New → Project → Import Git Repository** → select the repo.
2. Framework preset: **Next.js** (auto). Root directory: repo root.
3. Leave build/install commands at defaults. The `postinstall` / `prebuild`
   hooks generate `public/maplibre/` (git-ignored worker files) during build, so
   the map works in production.

---

## 3. Environment variables (Vercel → Settings → Environment Variables)

Required:

| Var | Value |
| --- | --- |
| `GEMINI_API_KEY` | your key |
| `TURSO_DATABASE_URL` | `libsql://…` from step 1 |
| `TURSO_AUTH_TOKEN` | token from step 1 |

Optional:

| Var | Notes |
| --- | --- |
| `GEMINI_MODEL` | override the model |
| `OVERPASS_USER_AGENT` | set a real UA, e.g. `HalalSearch/0.1 (you@example.com)` |
| `OVERPASS_URL` | pin a specific mirror |
| `NEXT_PUBLIC_MAP_STYLE_URL` | alternative map style |
| `NEXT_PUBLIC_ENABLE_GOOGLE_CSE` / `NEXT_PUBLIC_GOOGLE_CSE_CX` | show the PSE pane |

Notes:
- Do **not** set `GEMINI_MOCK` in production.
- `NEXT_PUBLIC_*` values are inlined at **build time** — set them before the
  deploy; changing them requires a redeploy.

---

## 4. Google Cloud billing (for citations)

Enable billing on the project tied to `GEMINI_API_KEY`. Until then, AI checks
return an ungrounded answer flagged "Not web-verified". The 5,000 free grounded
searches/month still apply once billing is enabled.

---

## 5. Deploy and verify

- Trigger the deploy.
- Verification checklist:
  - [ ] Home page loads; map tiles render.
  - [ ] `GET /maplibre/maplibre-gl-worker.mjs` → 200 (map worker).
  - [ ] `GET /api/health` → 200 `{"ok":true,"db":"ok"}`.
  - [ ] Nearby places load (Overpass, or tile fallback if Overpass is down).
  - [ ] Search returns local-first results with distances.
  - [ ] "Validate with AI" returns a verdict (and sources once billing is on).
  - [ ] "Add your own assessment" saves and re-appears after reopening the place
        (confirms Turso persistence).

---

## 6. Hardening before public traffic

- **Rate limiting** is already applied in-memory to `/api/validate`,
  `/api/validate/stream`, `/api/report`, `/api/nearby`, and `/api/search`. This is
  best-effort: each serverless instance keeps its own counter. For a hard global
  limit, back it with a shared store (e.g. Upstash Redis).
- **Cost cap:** keep auto-validate off by default; consider a global daily
  Gemini-search budget/counter.
- **Moderation:** community reports are anonymous and unmoderated — add
  flagging/abuse handling before promotion.
- **Custom domain** (HTTPS is automatic on Vercel).

---

## Alternatives

- **Netlify** — same setup (Next runtime + Turso env vars).
- **Self-host (VPS/Docker)** — `npm ci && npm run build && npm start` behind
  nginx. The local SQLite file works here but needs a **persistent volume**; you
  manage scaling/TLS. Good if you want to avoid serverless SKUs.
- **Cloudflare Pages/Workers** — possible, but the libSQL client must use the
  HTTP path; more work than Vercel.

---

## Rollback

- Vercel keeps immutable deployments — "Promote to Production" a previous one to
  roll back instantly.
- The DB is external (Turso); deploys never touch it. Back up with
  `turso db shell halalsearch ".dump" > backup.sql`.

---

## Cost summary

- **Host:** Vercel free tier is fine for a prototype; Pro if needed.
- **DB:** Turso free tier covers small usage.
- **Gemini:** 5,000 grounded searches/month free, then ~$14/1,000. On-demand +
  cache + community data keep usage low.
- **OSM/Overpass/Photon:** free (respect usage policies).
