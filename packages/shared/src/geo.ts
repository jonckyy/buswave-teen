// ── Geo utilities (shared between web + API) ─────────────────────────────────

const R_EARTH_KM = 6371
const DEG_TO_RAD = Math.PI / 180

/** Haversine distance between two lat/lon points. Returns km. */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLon = (lon2 - lon1) * DEG_TO_RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLon / 2) ** 2
  return R_EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Road distance (km) from shape_dist_traveled values.
 * Returns null if bus has already passed the stop (remaining < 0).
 * TEC uses meters for shape_dist_traveled.
 */
export function shapeDistanceKm(
  busShapeDist: number | undefined,
  stopShapeDist: number | undefined
): number | null {
  if (busShapeDist == null || stopShapeDist == null) return null
  const remaining = stopShapeDist - busShapeDist
  if (remaining < 0) return null
  return remaining / 1000
}

/**
 * Road distance (km) along a shape polyline from bus position to stop position.
 * Finds the nearest shape point to each and sums intermediate segment distances.
 * Returns null if bus index >= stop index (bus already passed).
 */
export function shapePolylineDistanceKm(
  shape: Array<{ lat: number; lon: number }>,
  busPt: { lat: number; lon: number },
  stopPt: { lat: number; lon: number }
): number | null {
  if (shape.length < 2) return null

  let busIdx = 0
  let busMin = Infinity
  let stopIdx = 0
  let stopMin = Infinity

  for (let i = 0; i < shape.length; i++) {
    const pt = shape[i]!
    const dBus = haversineKm(busPt.lat, busPt.lon, pt.lat, pt.lon)
    if (dBus < busMin) { busMin = dBus; busIdx = i }
    const dStop = haversineKm(stopPt.lat, stopPt.lon, pt.lat, pt.lon)
    if (dStop < stopMin) { stopMin = dStop; stopIdx = i }
  }

  if (busIdx >= stopIdx) return null

  let dist = 0
  for (let i = busIdx; i < stopIdx; i++) {
    const a = shape[i]!, b = shape[i + 1]!
    dist += haversineKm(a.lat, a.lon, b.lat, b.lon)
  }
  return dist
}

/**
 * Minimum distance (meters) from a point to any segment of a polyline.
 * Used for off-route detection: if result > threshold, bus is deviating.
 */
export function pointToPolylineDistanceM(
  lat: number, lon: number,
  polyline: Array<{ lat: number; lon: number }>
): number {
  if (polyline.length === 0) return Infinity
  if (polyline.length === 1) {
    const p = polyline[0]!
    return haversineKm(lat, lon, p.lat, p.lon) * 1000
  }

  let minDist = Infinity

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i]!, b = polyline[i + 1]!
    const dist = pointToSegmentDistanceM(
      lat, lon,
      a.lat, a.lon,
      b.lat, b.lon
    )
    if (dist < minDist) minDist = dist
  }

  return minDist
}

/**
 * Distance (meters) from a point to a line segment.
 * Projects point onto segment, clamps to endpoints.
 */
function pointToSegmentDistanceM(
  pLat: number, pLon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number
): number {
  const dx = bLon - aLon
  const dy = bLat - aLat
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) return haversineKm(pLat, pLon, aLat, aLon) * 1000

  // Project point onto line, clamp t to [0, 1]
  const t = Math.max(0, Math.min(1, ((pLon - aLon) * dx + (pLat - aLat) * dy) / lenSq))
  const projLat = aLat + t * dy
  const projLon = aLon + t * dx

  return haversineKm(pLat, pLon, projLat, projLon) * 1000
}
