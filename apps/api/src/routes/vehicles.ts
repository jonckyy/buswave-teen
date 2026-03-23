import { Hono } from 'hono'
import { getVehiclePositions } from '../lib/gtfs-rt.js'
import type { VehiclePosition, ApiResponse } from '@buswave/shared'

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
