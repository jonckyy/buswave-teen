# BusWave — Claude Instructions

Real-time Belgian TEC bus tracker. Monorepo: Turborepo + pnpm workspaces.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), TailwindCSS, shadcn/ui |
| Backend | Bun + Hono (`apps/api`) |
| Shared types | `@buswave/shared` (`packages/shared`) |
| Database | Supabase (Postgres + full-text search + Auth) |
| Deployment | Railway (API), Vercel (web) |

## Live URLs

- API: `https://buswaveapi-production.up.railway.app`
- Web: `https://buswave-web.vercel.app`

## GTFS-RT Feed

- Base URL: `https://gtfsrt.tectime.be/proto/RealTime`
- Auth: `?key=<API_KEY>` query param (NOT a header)
- API key: `17F9BC53DDA54E0887B1D866E1561CBB`
- Format: protobuf binary — use `gtfs-realtime-bindings` (CJS, import via `require()`)
- Endpoints: `/vehicles` (10s TTL), `/trips` (10s TTL), `/Alerts` (30s TTL)
- GTFS static zip: `https://opendata.tec-wl.be/Current%20GTFS/TEC-GTFS.zip`

## API Response Envelope

All endpoints return `{ data: T }`. Never break this contract.

## Critical Rules (never violate)

1. Route polyline must use `shapes.txt` points — NEVER stop coordinates
2. `shapeDistanceKm()` returns null when bus passed stop — hide road distance in that case
3. Never render `''` as JSX child — use `null`
4. Zustand selectors must select primitives only
5. Countdown = `Math.max(0, Math.round(predictedArrivalUnix - Date.now()/1000))`, ticking via `setInterval` locally, reset on refetch
6. GTFS-RT cache is NEVER skipped — min intervals enforced server-side
7. Map auto-fit on first load only (ref-gated) — manual refresh must not reset zoom
8. Favorites: sync to Supabase for logged-in users, localStorage fallback for unauthenticated

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

## Dev Commands

```bash
pnpm dev          # run all apps
pnpm --filter api dev
pnpm --filter web dev
```

## Deployment Notes

- Railway uses `Dockerfile` at repo root (multi-stage Bun build)
- Vercel uses `apps/web/vercel.json` — buildCommand: `next build`, installCommand: `cd ../.. && pnpm install`
- `gtfs-realtime-bindings` is CJS — import with `require()` in Bun ESM context
