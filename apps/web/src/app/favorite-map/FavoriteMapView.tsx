'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getTileUrl, isTileDark } from '@buswave/shared'
import { busIcon, stopMarkerIcon, getDirColors } from '@/components/map/map-icons'
import type { GtfsStop, VehiclePosition, RouteWithLiveVehicles } from '@buswave/shared'

interface Props {
  stop: GtfsStop | null
  nextBus: VehiclePosition | null
  routeLive: RouteWithLiveVehicles | null
  tileStyle: string
}

/** Find the index of the closest point on a polyline to a given lat/lon */
function closestIndex(seg: Array<{ lat: number; lon: number }>, lat: number, lon: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < seg.length; i++) {
    const dx = seg[i].lat - lat
    const dy = seg[i].lon - lon
    const d = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

/** Trim a polyline segment to only show points between a bus and a stop */
function trimSegment(
  seg: Array<{ lat: number; lon: number }>,
  bus: VehiclePosition | null,
  stop: GtfsStop | null
): Array<{ lat: number; lon: number }> {
  if (!bus || !stop || seg.length === 0) return seg

  const busIdx = closestIndex(seg, bus.lat, bus.lon)
  const stopIdx = closestIndex(seg, stop.stop_lat, stop.stop_lon)

  const from = Math.min(busIdx, stopIdx)
  const to = Math.max(busIdx, stopIdx)

  return seg.slice(from, to + 1)
}

/** Auto-fit the map to show the trimmed route segment */
function AutoFit({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const hasFit = useRef(false)

  useEffect(() => {
    if (hasFit.current || positions.length === 0) return
    hasFit.current = true

    if (positions.length >= 2) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    } else {
      map.setView(positions[0], 15)
    }
  }, [map, positions])

  return null
}

export default function FavoriteMapView({ stop, nextBus, routeLive, tileStyle }: Props) {
  const isDark = isTileDark(tileStyle)
  const dirColors = getDirColors(isDark)

  // Find the best matching shape segment and trim it between bus and stop
  const trimmedSegment = useMemo(() => {
    if (!routeLive?.shapeSegments?.length) return null

    // Pick the segment closest to the bus (if we have one) or the stop
    let bestSeg = routeLive.shapeSegments[0]
    if (nextBus && routeLive.shapeSegments.length > 1) {
      let bestDist = Infinity
      for (const seg of routeLive.shapeSegments) {
        const idx = closestIndex(seg, nextBus.lat, nextBus.lon)
        const dx = seg[idx].lat - nextBus.lat
        const dy = seg[idx].lon - nextBus.lon
        const d = dx * dx + dy * dy
        if (d < bestDist) { bestDist = d; bestSeg = seg }
      }
    }

    return trimSegment(bestSeg, nextBus, stop)
  }, [routeLive, nextBus, stop])

  const polyPositions = useMemo<[number, number][]>(() => {
    if (!trimmedSegment) return []
    return trimmedSegment.map((p) => [p.lat, p.lon] as [number, number])
  }, [trimmedSegment])

  // Points for auto-fit: bus + stop + trimmed route
  const fitPositions = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [...polyPositions]
    if (stop) pts.push([stop.stop_lat, stop.stop_lon])
    if (nextBus) pts.push([nextBus.lat, nextBus.lon])
    return pts
  }, [polyPositions, stop, nextBus])

  return (
    <MapContainer
      center={stop ? [stop.stop_lat, stop.stop_lon] : [50.4, 4.5]}
      zoom={14}
      style={{ height: '100%', width: '100%', background: isDark ? '#0A0E17' : '#F2F2F2' }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={getTileUrl(tileStyle)}
      />

      <AutoFit positions={fitPositions} />

      {/* Trimmed route polyline (bus → stop only) */}
      {polyPositions.length > 1 && (
        <Polyline
          positions={polyPositions}
          color={dirColors['0'] ?? '#00D4FF'}
          weight={4}
          opacity={isDark ? 0.7 : 0.85}
        />
      )}

      {/* Stop marker */}
      {stop && (
        <Marker
          position={[stop.stop_lat, stop.stop_lon]}
          icon={stopMarkerIcon(dirColors['0'] ?? '#00D4FF', true, isDark)}
        />
      )}

      {/* Next bus marker */}
      {nextBus && (
        <Marker
          position={[nextBus.lat, nextBus.lon]}
          icon={busIcon(nextBus.bearing, true, '#FF9100', isDark)}
        />
      )}
    </MapContainer>
  )
}
