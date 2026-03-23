import { Hono } from 'hono'
import { getVehiclePositions } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import type { VehiclePosition, VehicleDetails, ApiResponse } from '@buswave/shared'

export const vehiclesRouter = new Hono()

/** GET /api/realtime/vehicles — all vehicles or filtered by ?routeId= */
vehiclesRouter.get('/', async (c) => {
  const routeId = c.req.query('routeId')
  const feed = await getVehiclePositions()

  const vehicles: VehiclePosition[] = (feed.entity ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((e: any) => {
      if (!e.vehicle?.position) return false
      if (routeId && e.vehicle?.trip?.routeId !== routeId) return false
      return true
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => ({
      vehicleId: String(e.vehicle.vehicle?.id ?? e.id),
      routeId: e.vehicle.trip?.routeId ?? '',
      tripId: e.vehicle.trip?.tripId ?? '',
      lat: e.vehicle.position.latitude,
      lon: e.vehicle.position.longitude,
      bearing: e.vehicle.position.bearing ?? undefined,
      speed: e.vehicle.position.speed ?? undefined,
      timestamp: Number(e.vehicle.timestamp ?? Math.floor(Date.now() / 1000)),
      stopId: e.vehicle.stopId ?? undefined,
      currentStopSequence: e.vehicle.currentStopSequence ?? undefined,
    }))

  return c.json({ data: vehicles } satisfies ApiResponse<VehiclePosition[]>)
})

/** GET /api/realtime/vehicles/details?routeId=&tripId=&stopId= */
vehiclesRouter.get('/details', async (c) => {
  const routeId = c.req.query('routeId') ?? ''
  const tripId  = c.req.query('tripId')  ?? ''
  const stopId  = c.req.query('stopId')  ?? ''

  const [routeRow, tripRow, stopRow] = await Promise.all([
    routeId
      ? supabase.from('routes').select('route_short_name').eq('route_id', routeId).maybeSingle()
      : Promise.resolve({ data: null }),
    tripId
      ? supabase.from('trips').select('trip_headsign').eq('trip_id', tripId).maybeSingle()
      : Promise.resolve({ data: null }),
    stopId
      ? supabase.from('stops').select('stop_name').eq('stop_id', stopId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const details: VehicleDetails = {
    routeShortName: (routeRow.data as any)?.route_short_name ?? null,
    headsign:       (tripRow.data  as any)?.trip_headsign    ?? null,
    nextStopName:   (stopRow.data  as any)?.stop_name        ?? null,
  }

  return c.json({ data: details } satisfies ApiResponse<VehicleDetails>)
})
