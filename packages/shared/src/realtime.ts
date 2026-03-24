// ── GTFS-RT / Realtime Types ───────────────────────────────────────────────

export interface VehiclePosition {
  vehicleId: string
  routeId: string
  tripId: string
  lat: number
  lon: number
  bearing?: number
  speed?: number
  /** Unix timestamp of the position update */
  timestamp: number
  stopId?: string
  currentStopSequence?: number
}

export interface StopArrival {
  tripId: string
  routeId: string
  routeShortName: string
  headsign: string
  /** Scheduled arrival as Unix timestamp */
  scheduledArrivalUnix: number
  /** Predicted arrival as Unix timestamp (use for countdown) */
  predictedArrivalUnix: number
  /** Delay in seconds (positive = late, negative = early) */
  delaySeconds: number
  stopSequence: number
}

export interface Alert {
  id: string
  cause?: string
  effect?: string
  headerText: string
  descriptionText: string
  activePeriodStart?: number
  activePeriodEnd?: number
  routeIds: string[]
  stopIds: string[]
}

export interface VehicleDetails {
  routeShortName: string | null
  headsign: string | null
  nextStopName: string | null
}

export interface RouteWithLiveVehicles {
  route: import('./gtfs.js').GtfsRoute
  vehicles: VehiclePosition[]
  /** @deprecated use shapeSegments */
  shapePoints: Array<{ lat: number; lon: number }>
  /** Shape polyline per direction, sorted by directionId (index 0 = dir 0, index 1 = dir 1) */
  shapeSegments: Array<Array<{ lat: number; lon: number }>>
}

// ── Distance helpers ────────────────────────────────────────────────────────

export interface DistanceResult {
  /** Straight-line distance in km */
  asTheCrowFlies: number
  /** Road distance in km. Null when bus has already passed the stop. */
  byRoad: number | null
}
