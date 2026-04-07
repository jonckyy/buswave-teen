/**
 * Helpers to extract a sub-segment of a route shape.
 *
 * Used to draw the "remaining trip" polyline from a bus's current position
 * up to a favorite stop.
 */

export interface ShapePoint {
  lat: number
  lon: number
}

/** Squared great-circle distance approximation (good enough for ranking nearest points) */
function sqDist(a: ShapePoint, b: ShapePoint): number {
  const dLat = a.lat - b.lat
  const dLon = a.lon - b.lon
  return dLat * dLat + dLon * dLon
}

/** Find the index of the shape point closest to a given coordinate. */
export function nearestShapeIndex(shape: ShapePoint[], lat: number, lon: number): number {
  if (shape.length === 0) return -1
  let bestIdx = 0
  let bestDist = sqDist(shape[0], { lat, lon })
  for (let i = 1; i < shape.length; i++) {
    const d = sqDist(shape[i], { lat, lon })
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return bestIdx
}

/**
 * Get the segment of `shape` between the bus position and the stop.
 * Direction-agnostic: returns the slice from min(busIdx, stopIdx) to max+1.
 * Returns an empty array if the shape is empty or the points coincide.
 */
export function getRemainingShape(
  shape: ShapePoint[],
  busLat: number,
  busLon: number,
  stopLat: number,
  stopLon: number
): ShapePoint[] {
  if (shape.length < 2) return []
  const busIdx = nearestShapeIndex(shape, busLat, busLon)
  const stopIdx = nearestShapeIndex(shape, stopLat, stopLon)
  if (busIdx === stopIdx) {
    // Bus is right at the stop — return just the two points
    return [
      { lat: busLat, lon: busLon },
      { lat: stopLat, lon: stopLon },
    ]
  }
  const lo = Math.min(busIdx, stopIdx)
  const hi = Math.max(busIdx, stopIdx)
  const segment = shape.slice(lo, hi + 1)
  // Anchor the actual bus and stop coords at the ends for accuracy
  return [
    { lat: busLat, lon: busLon },
    ...segment,
    { lat: stopLat, lon: stopLon },
  ]
}
