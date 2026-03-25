# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Real-time Belgian TEC bus tracker. Monorepo: Turborepo + pnpm workspaces.

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), TailwindCSS, shadcn/ui |
| Backend | Bun + Hono (`apps/api`) |
| Shared types | `@buswave/shared` (`packages/shared`) |
| Database | Supabase (Postgres + full-text search) |
| Deployment | Railway (API), Vercel (web) |

## Dev Commands

```bash
pnpm dev                          # run all apps concurrently (Turborepo)
pnpm --filter api dev             # API only (Bun watch on port 3001)
pnpm --filter web dev             # Web only (Next.js on port 3000)
pnpm typecheck                    # tsc --noEmit across all packages
pnpm lint                         # ESLint across all packages
pnpm format                       # Prettier across all files
```

### Testing (Playwright — web only)

Tests run against the **live production URL** (`https://buswave-web.vercel.app`). Always push before running stop/filter tests. Playwright requires system libs that may not be installed; if `libnspr4.so` (or similar) is missing, download missing `.deb` packages with `apt-get download <pkg>`, extract with `dpkg-deb -x`, then run with `LD_LIBRARY_PATH`:

```bash
cd apps/web
LD_LIBRARY_PATH=/tmp/playwright-libs/lib/x86_64-linux-gnu:/tmp/playwright-libs/usr/lib/x86_64-linux-gnu \
  npx playwright test e2e/map-stops.spec.ts --reporter=list

# Single test by name
npx playwright test --grep "buses load" ...
```

## Architecture

### API (`apps/api`)

Hono app with four routers, each mounted **once** — duplicate mounts break sub-path matching:

```
/api/realtime/vehicles  → vehiclesRouter  (vehicles.ts)
/api/realtime/stops     → stopsRouter     (stops.ts)
/api/realtime/routes    → routesRouter    (routes.ts)
/api/realtime/alerts    → alertsRouter    (alerts.ts)
/health, /debug/*       → inline handlers
```

**GTFS-RT feed** is fetched via `apps/api/src/lib/gtfs-rt.ts`. It has an in-memory cache (vehicles/trips: 10s, alerts: 30s, shapes: 60s). The cache is **never skipped** — callers always get cached data within TTL.

Key quirks baked into the API:
- **Timezone**: TEC `stop_times.arrival_time` is Brussels local time (CET/CEST), not UTC. `gtfsTimeToUnix()` in `stops.ts` subtracts `brusselsOffsetSec()` when converting to Unix.
- **Dead band**: TEC GTFS-RT sends `delay = -60` as a default "no data" value. Delays within ±60s are treated as 0.
- **Headsign fallback**: Many TEC trips have an empty `trip_headsign`. All three relevant endpoints fall back to the last stop name of the trip.
- **`gtfs-realtime-bindings` is CJS**: Import with `require()` in the Bun ESM context (see top of `gtfs-rt.ts`).

### Web (`apps/web`)

All pages are under `apps/web/src/app/`:

| Route | File | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Home: debug status panel + favorites |
| `/map` | `map/page.tsx` | Live map with line filter autocomplete |
| `/search` | `search/page.tsx` | Line/stop search with stop-picker for favorites |
| `/alerts` | `alerts/page.tsx` | Alerts from last 2 hours |
| `/line/[id]` | `line/page.tsx` | Per-line detail view |

**Data fetching**: React Query (`@tanstack/react-query`) everywhere. All queries call `apps/web/src/lib/api.ts`, which wraps fetch calls to the Hono backend and unwraps `{ data: T }` envelopes. `NEXT_PUBLIC_API_URL` env var sets the base URL (defaults to `http://localhost:3001`).

**Map** (`BusMap.tsx`) is `dynamic`-imported with `ssr: false`. Leaflet pane z-indices (200–700) require `[isolation:isolate]` on the wrapper div to scope them; the filter dropdown uses `z-[9999]`.

**State**:
- `useFavoritesStore` (Zustand + `persist`) — favorites keyed by `stopId:routeId` composite. Selectors must return primitives only.
- `useCountdown(predictedArrivalUnix)` hook — ticks every second locally, resets synchronously when the unix value changes after a refetch.

**Supabase** tables used (read-only from frontend): `routes`, `stops`, `trips`, `stop_times`, `shapes`. Schema is in `supabase/migrations/`.

## API Response Contract

All endpoints return `{ data: T }`. Never break this shape.

## Critical Rules

1. Route polyline must use `shapes.txt` points — NEVER stop coordinates
2. `shapeDistanceKm()` returns null when bus has passed the stop — hide road distance in that case
3. Never render `''` as a JSX child — use `null`
4. Zustand selectors must return primitives only (no objects/arrays derived inline)
5. Countdown: `Math.max(0, Math.round(predictedArrivalUnix - Date.now()/1000))`, ticking via `setInterval` locally, reset on refetch — prefer `useCountdown()` hook
6. GTFS-RT cache is never skipped — min intervals enforced in `gtfs-rt.ts`
7. Map auto-fit on first load only (ref-gated with `hasFit` ref) — refresh must not reset zoom
8. Favorites sync to Supabase for logged-in users, localStorage fallback for unauthenticated

## Live URLs

- API: `https://buswaveapi-production.up.railway.app`
- Web: `https://buswave-web.vercel.app`

## GTFS-RT Feed

- Base URL: `https://gtfsrt.tectime.be/proto/RealTime`
- Auth: `?key=<API_KEY>` query param (NOT a header)
- API key: `17F9BC53DDA54E0887B1D866E1561CBB` (also in `GTFS_RT_API_KEY` env var)
- Endpoints: `/vehicles` (10s TTL), `/trips` (10s TTL), `/Alerts` (30s TTL)
- GTFS static zip: `https://opendata.tec-wl.be/Current%20GTFS/TEC-GTFS.zip`

## Design Tokens

```
Background:   #0A0E17
Card:         #131A2B
Accent cyan:  #00D4FF
On time:      #00E676
Slight delay: #FF9100
Large delay:  #FF3D71
Muted text:   #8892B0
```

## Deployment

- **Railway** (API): `Dockerfile` at repo root, multi-stage Bun build. Update the `commit` string in `/health` after deploys.
- **Vercel** (web): `apps/web/vercel.json` — `buildCommand: next build`, `installCommand: cd ../.. && pnpm install`. Vercel deploys automatically on push to `main`.
- API env vars required: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GTFS_RT_API_KEY`, `CORS_ORIGIN`
