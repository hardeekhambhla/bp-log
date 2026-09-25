# Handoff

**State (2026-09-25)**: built and tested locally, not yet deployed.

- Static SPA in `public/` (vanilla JS, hash routes `#/` and `#/p/<id>`), Pages Functions in
  `functions/api/*` backed by **D1** (binding `DB`). `lib/api.js` creates tables on first request
  (no migration step) and holds validation. Profiles are seeded once via a `meta` row.
- Profile avatars: `icon` int (0-11) per profile, random + unique-preferring on create/seed; rendered from `ICONS` in `public/app.js` (keep length = `ICON_COUNT` in `lib/api.js`). Column is auto-added to older DBs in `lib/api.js`.
- API: `GET/POST /api/profiles`, `PATCH/DELETE /api/profiles/:id`, `GET /api/readings?profile=`,
  `POST /api/readings`, `PATCH/DELETE /api/readings/:id`.
- Local dev: `make dev` (wrangler pages dev, local D1 in `.wrangler/`).
- Deploy: Pages project, no build command, output dir `public`; D1 database bound as `DB`
  (Settings > Bindings). No `wrangler.toml` on purpose (it would override dashboard bindings).
- **No auth**: anyone with the URL can read/write. Protect with Cloudflare Access (Zero Trust >
  Access > Applications, allow family emails) before sharing the URL.
- BP categories follow AHA (normal <120/80, elevated 120-129, stage 1 130-139/80-89, stage 2
  >=140/90, very high >180/120) — display only, not medical advice.
