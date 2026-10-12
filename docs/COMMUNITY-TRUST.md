# Community Trust & Abuse Resistance

Design notes for how we store and trust community halal/not-halal reports.
This is a plan, not an implementation. No paid services for now — free tiers and
low-effort wins first.

---

## 1. Why this matters

A trust directory lives or dies on abuse resistance. Google gives us a sparse
`halal_restaurant` type; the community layer is what fills the gaps — so it is
also the most attractive target.

**Core asymmetry:** a wrong **"not halal"** is annoying; a wrong **"halal"** is
*harmful* (someone may eat something impermissible). Every guardrail should be
**asymmetric**: hard to upgrade a place to *halal*, easy to dispute / downgrade.

---

## 2. Threat model

| Actor | Goal | Example |
| --- | --- | --- |
| Competitor | Harm a rival | Mark a rival "not halal" |
| Bad actor / owner | Falsely promote | Mark a non-halal place "halal" |
| Coordinated group | Push a verdict | Brigading / review-bombing |
| Troll | Vandalise | Random reports |
| Sybil | Scale influence | Many fake identities |
| Honest user | (noise) | Confuses zabiha vs "no pork"; stale info |

---

## 3. Principles

1. **Asymmetry** — conservative on "halal", quick on "not halal"/dispute.
2. **Store raw, derive aggregates** — keep every report (identity, time, visit
   flag, evidence) append-only; recompute summaries. Never overwrite history.
3. **Never claim certification** — show "Community-confirmed (N reports, X
   disputes)" + the disclaimer; a community verdict is a signal, not a ruling.
4. **Provenance & transparency** — show the source and confidence of each signal
   (Google type / community / certified).
5. **Incremental friction** — cheapest controls first; add friction only as
   volume/abuse requires.

---

## 4. Current weaknesses

- Identity = anonymous `client_id` in `localStorage` — spoofable by clearing
  storage or calling the API directly.
- No de-duplication: one actor can submit many reports for the same place.
- Rate limiting is per-IP, per-instance (in-memory) — distributed/trivial bypass.
- Verdict is a raw ratio with **no minimum** → **a single vote flips a badge**
  (the most exploitable property today).
- No flagging, no review queue, no audit surface for users.

---

## 5. Guardrails by tier

### Tier 1 — cheap, high impact (free)
- **One report per (identity, place)** — upsert; a user can *change* their vote
  but never stack it.
- **Per-place rate cap** — e.g. reject if a place gets more than N reports in a
  short window (DB-counted, works across instances).
- **Asymmetric display threshold** — show a *positive* "halal" tone only at
  ≥2 distinct contributors AND ≥0.66 ratio; a lone vote shows as
  **"1 confirmation (unconfirmed)"**, not a green badge. Downgrades can apply
  faster.
- **Server-issued identity** — a signed, HttpOnly cookie minted on first visit
  (HMAC with a server secret) instead of trusting a client-supplied id.
- **Bot friction** — Cloudflare Turnstile / hCaptcha on submit (free tier).

### Tier 2 — weighting & statistics
- **Visit-verified weighting** — if the reporter was within ~200 m (client-side
  check, store only a boolean), weight ~2–3×.
- **Contributor reputation** — weight by how often an identity's past votes
  agreed with eventual consensus.
- **Bayesian / Wilson aggregation** — start from an "unknown" prior and shrink
  small samples toward unclear; 1 vote stays low-confidence, many votes dominate.
- **Recency decay** — older votes count less (ownership/chef/certification can
  change).
- **Per-contributor cap** — one identity can't exceed N votes of weight per place.
- **Surge/disagreement detection** — a sudden flip of an established verdict is
  flagged for review rather than applied instantly.

### Tier 3 — moderation & trust
- **Flag/report** control on entries; **audit log** for review.
- **Admin review queue** for disputed/volatile places.
- **Certification tier** — a verified certifier link is authoritative and immune
  to vote-stuffing.
- **Optional accounts** for reputation (allow anonymous, weight lower; or require
  sign-in only to contribute).

---

## 6. Easy wins (free, low effort) — Phase 1 candidates

Ordered by impact-to-effort. All use the existing stack (libSQL + Next routes);
no new services, no cost.

| # | Win | Effort | Impact | Notes |
| --- | --- | --- | --- | --- |
| 1 | **De-dupe per (client, place)** — unique index + upsert | Low | High | Kills single-actor stuffing |
| 2 | **Per-place rate cap** (DB-counted, e.g. ≤8 reports/hour) | Low | Medium | Works across instances |
| 3 | **Asymmetric display threshold** (halal needs ≥2 contributors & ≥0.66; lone vote = "unconfirmed") | Low | High | Fixes one-vote-flips; keeps counts visible |
| 4 | **Signed identity cookie** (HMAC, HttpOnly) | Medium | High | Replaces trust in client-supplied id |
| 5 | **Surge guard** — flag if an established verdict flips quickly | Medium | Medium | Needs a "previous verdict" snapshot |
| 6 | **Recency weighting** in the summary | Medium | Medium | Needs timestamp math in aggregation |

Deferred (more effort / friction / cost): Turnstile captcha, visit-verified
geolocation weighting, contributor reputation, Bayesian/Wilson scoring, accounts,
admin review queue, certification tier.

Suggested quick sequence: **1 → 3 → 2** (all low effort), then 4.

---

## 7. Aggregation sketch (for later)

Replace the raw ratio with a confidence-aware score:

- Prior: each place starts "unclear" with a small pseudo-count.
- Posterior halal probability from halal vs not-halal counts, shrunk toward the
  prior for small samples (Beta/Wilson-style).
- Weight each report by: identity confidence × visit flag × recency.
- Map to display tiers: `unconfirmed` → `community-confirmed` → `certified`.

---

## 8. Data-model implications

- `reports` stays append-only: `(id, place_id, verdict, note, client_id,
  created_at, visit_verified, source)`. Add a **unique index** on
  `(place_id, client_id)` for the de-dupe win (upsert on conflict).
- Keep a **verdict snapshot** per place if we add surge detection (previous
  verdict + when it changed).
- Identity: move to a signed cookie value; keep `client_id` as a *hash* of it.
- Never destructively overwrite; recompute summaries from raw reports.

---

## 9. Open questions

- Is "one vote shows, but as **unconfirmed / low-confidence**" acceptable, rather
  than flipping the map badge? (Proposed: yes.)
- Keep contribution **anonymous** long-term, or require lightweight sign-in to
  vote (with anonymous weighted lower)?
- How much visible moderation (flag counts, disputes) do we want in v1?

---

## 10. Status

**Implemented (Phase 1):**
- **#1 De-dupe per (identity, place)** — unique index on `(place_id, client_id)`
  + upsert (re-voting updates your existing report).
- **#2 Per-place rate cap** — max 8 fresh reports per place per hour (DB-counted,
  so it holds across instances).
- **#3 Asymmetric display threshold** — a lone vote reads as
  "1 confirmation (low confidence)"; a green *halal* tone needs ≥2 contributors
  and ≥0.66; downgrades (`not_halal`) apply immediately on a negative majority.
- **#4 Server-issued signed identity** — HMAC-signed, HttpOnly `hs_id` cookie
  (`IDENTITY_SECRET`, falling back to `TURSO_AUTH_TOKEN`), minted on first report.

**Not yet:** surge guard, recency weighting, captcha, visit-verified weighting,
contributor reputation, Bayesian/Wilson scoring, accounts, admin review queue,
certification tier.
