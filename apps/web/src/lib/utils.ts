import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Delay color based on seconds */
export function delayColor(delaySeconds: number): string {
  if (delaySeconds <= 60 && delaySeconds >= -60) return 'text-on-time'
  if (delaySeconds <= 300) return 'text-slight-delay'
  return 'text-large-delay'
}

/** Haversine distance in km between two lat/lon points */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function nearestShapeIndex(shape: Array<{ lat: number; lon: number }>, pt: { lat: number; lon: number }): number {
  let minDist = Infinity
  let minIdx = 0
  for (let i = 0; i < shape.length; i++) {
    const d = haversineKm(pt.lat, pt.lon, shape[i].lat, shape[i].lon)
    if (d < minDist) { minDist = d; minIdx = i }
  }
  return minIdx
}

/**
 * Distance in km along the shape polyline from busPt to stopPt.
 * Returns null if the bus has already passed the stop (bus index >= stop index).
 */
export function shapeDistanceKm(
  shape: Array<{ lat: number; lon: number }>,
  busPt: { lat: number; lon: number },
  stopPt: { lat: number; lon: number }
): number | null {
  if (shape.length < 2) return null
  const busIdx = nearestShapeIndex(shape, busPt)
  const stopIdx = nearestShapeIndex(shape, stopPt)
  if (busIdx >= stopIdx) return null
  let dist = 0
  for (let i = busIdx; i < stopIdx; i++) {
    dist += haversineKm(shape[i].lat, shape[i].lon, shape[i + 1].lat, shape[i + 1].lon)
  }
  return dist
}

/** Format delay for display: "+3 min", "-1 min", "à l'heure" */
export function formatDelay(delaySeconds: number): string {
  if (Math.abs(delaySeconds) <= 30) return "à l'heure"
  const mins = Math.round(delaySeconds / 60)
  if (mins > 0) return `+${mins} min`
  return `${mins} min`
}
