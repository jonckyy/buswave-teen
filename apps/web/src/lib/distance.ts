/**
 * Haversine distance between two lat/lon points.
 * Returns distance in km.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Returns road distance (km) from shape_dist_traveled, or null
 * if the bus has already passed the stop (dist is negative / bus is ahead).
 * Per spec: return null when bus has passed — callers must hide it.
 */
export function shapeDistanceKm(
  busShapeDist: number | undefined,
  stopShapeDist: number | undefined
): number | null {
  if (busShapeDist == null || stopShapeDist == null) return null
  const remaining = stopShapeDist - busShapeDist
  if (remaining < 0) return null // bus already passed stop
  return remaining / 1000 // TEC uses meters
}
