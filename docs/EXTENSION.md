# HalalSearch — Chrome Extension (Google Maps overlay)

**Status: parked / exploratory.** This captures the idea, the trade-offs, and the
guardrails so it can be picked up without re-litigating the "why". Nothing here is
built yet.

The goal: let a user who is **already on Google Maps** click a toolbar button (or an
in-page "Show halal places" button) and see HalalSearch's halal/veg/community signal
overlaid on the place they're looking at — the same assessments the web app shows,
without sending them to a new map UI.

---

## 1. The one thing to get straight first

**The extension does not avoid the Google Maps API or its billing.** It still uses
**Places API (New)** for place data, and that requires the same **active Cloud
billing** the web app needs. What the extension changes is *where the UI lives*
(inside Google Maps), not the cost model.

It is a **distribution play, not a cost play.**

### Hosting: there is no saving
- The web app already runs for **~$0** hosting (Vercel Hobby + Turso free tier);
  the only recurring costs are the **domain** and **Maps Platform usage**.
- The extension **still needs a backend**: the server-side Places key must not ship
  in the extension (its bundle is inspectable, so the key would be stealable). The
  same `app/api/*` routes + community DB stay the source of truth — so you host the
  same thing either way.
- You would likely run **both** (site for mobile/SEO/sharing, extension for desktop
  Google Maps), i.e. additive, not a replacement.

### The one genuine cost delta
| Cost item | Web app | Extension |
| --- | --- | --- |
| Domain | ~$10/yr | (same backend) |
| Vercel/Turso hosting | $0 | $0 — still needed as backend |
| Maps JS **Dynamic Maps** loads | **billed per load** | **avoided** (overlay on Google's own map) |
| **Places API (New)** Nearby/Details | billed | billed (same; possibly higher) |
| Chrome Web Store | — | one-time ~$5 dev fee |

Only the *map-load* line goes away; **Places usage — the cost that scales — is
unchanged.** The monthly Maps free credits still apply to both.

---

## 2. Approaches

### A. Overlay on Google Maps (the headline idea)
- A content script on `https://www.google.com/maps/*` parses the current view
  (`/@lat,lng,zoom`) and calls our `/api/nearby` (Places API (New) under the hood),
  then draws our own markers/badges.
- Position overlays by converting lat/lng → pixel relative to the viewport center
  (Web Mercator). Works in 2D; **brittle** with pitch/3D/globe and when Google ships
  DOM/UI changes.
- **Robust variant:** annotate the **left results panel** with Halal / Not / Unclear
  badges (matched by `place_id`/name) instead of pixel-perfect map pins. Less flashy,
  far less likely to break.

### B. Thin deep-link button (recommended v0)
- A toolbar button that opens HalalSearch centered on the current Maps view
  (`/@lat,lng,zoom` → `?lat&lng`), plus an optional in-page "Show halal near here"
  button that does the same.
- Keeps **one** codebase, no scraping, no overlay fragility, **toS-safe**. Trivial to
  build and reuses everything.

### C. Ship our own full map inside the extension
- Hardest and most ToS-risky; not recommended.

**Recommended sequence: B first, then A.** The deep-link button proves demand with
near-zero risk; the overlay is the later, fragile layer.

---

## 3. Shared backend

The extension reuses the existing routes — no new data model:

```
Extension (content script / SW)
  ├─ GET  /api/nearby?lat&lng&radius   → places + halal/veg labels
  ├─ POST /api/places/summaries        → community status per place_id
  ├─ POST /api/report                  → optional contribute (later phase)
  └─ GET  /api/place?...               → on-demand details
```

- Community reports stay keyed on **`place_id` only** (see `docs/DESIGN.md`).
- The extension never persists Google place data (name/address/coords) beyond what
  the current page shows — only our **own** community verdicts are stored, keyed by
  `place_id`.

---

## 4. Manifest V3 sketch (for scope, not final)

```jsonc
{
  "manifest_version": 3,
  "name": "HalalSearch for Google Maps",
  "version": "0.1.0",
  "description": "Show halal / veg / community status while you browse Google Maps.",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://www.google.com/maps/*",
    "https://halalsearch.net/*"
  ],
  "background": { "service_worker": "sw.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["https://www.google.com/maps/*"],
      "js": ["content.js"],
      "css": ["overlay.css"]
    }
  ],
  "action": { "default_title": "Show halal places" },
  "icons": { "128": "icon128.png" }
}
```

Notes:
- MV3 forbids **remote code**; all JS ships in the bundle.
- Prefer routing API calls through the **service worker** (or add CORS for the
  `chrome-extension://` origin on our API routes) so the content script isn't blocked
  by CORS on `google.com`.
- Declare the minimum `host_permissions`; justify each in the store listing.

---

## 5. ToS & policy guardrails (must-do)

- **Google Maps ToS:** do not scrape/extract Google place data into storage, and do
  not repackage Google's content. Reading the **URL** + calling **our own**
  Places-API-backed service and rendering **our own** community verdicts is the safe
  line. Only `place_id` may be kept long-term.
- **Chrome Web Store:** Manifest V3, no remote code, clear privacy disclosure for
  location/permissions, and no mimicking of Google's own UI/branding. Overlays in a
  third-party page draw review scrutiny — keep the injected UI unmistakably ours.
- **Graceful degradation:** when projection fails (3D/globe) fall back to list-panel
  badges; never break the host page.
- **A userscript (Tampermonkey) is a lower-policy-risk way to prototype** the same
  behaviour for personal use before any store submission.

---

## 6. Risks & open questions

- **Mobile gap:** mobile Chrome/Android/iOS effectively don't run extensions the way
  desktop does — and "find halal near me" is mostly a *mobile* need. The web app
  already covers that; the extension is a desktop convenience, not a mobile answer.
- **DOM fragility:** Google Maps markup changes without notice; budget for ongoing
  maintenance and defensive feature-detection.
- **No public URL:** a site is discoverable (SEO), shareable (link a specific place),
  and easy to monetize (donations/UPI). An extension is none of these — closer to a
  companion, not a replacement.
- **Monetization:** Chrome Web Store removed direct in-app payments; donations would
  link out, more awkwardly than on the site.
- **Key security:** never embed the server Places key in the extension; keep the
  backend proxy.

---

## 7. Out of scope (for now)

- Auto-running on every Maps view (cost + ToS noise); the action stays **on-demand**.
- Accounts/auth, moderation tooling, and report submission in the extension (phase 2+,
  reuse the site).
- Any Android/iOS equivalent.

---

## 8. References

- Web app design & legal constraints: [`DESIGN.md`](DESIGN.md)
- Deployment & billing notes: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Chrome extension MV3: <https://developer.chrome.com/docs/extensions/develop/migrate>
- Maps error codes (e.g. `BillingNotEnabledMapError`, `RefererNotAllowedMapError`):
  <https://developers.google.com/maps/documentation/javascript/error-messages>