'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

/** Animated dashed polyline that flows in the direction of the bus */
function AnimatedRoute({ positions, color, isDark }: { positions: [number, number][]; color: string; isDark: boolean }) {
  const map = useMap()
  const polyRef = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (positions.length < 2) return

    // Solid background line
    const bgLine = L.polyline(positions, {
      color,
      weight: 4,
      opacity: isDark ? 0.3 : 0.25,
    }).addTo(map)

    // Animated dashed line on top
    const dashLine = L.polyline(positions, {
      color,
      weight: 4,
      opacity: isDark ? 0.8 : 0.9,
      dashArray: '12 8',
      className: 'animated-dash',
    }).addTo(map)

    polyRef.current = dashLine

    return () => {
      map.removeLayer(bgLine)
      map.removeLayer(dashLine)
    }
  }, [map, positions, color, isDark])

  return null
}

/** Bus marker that smoothly animates to new positions */
function AnimatedBusMarker({ bus, isDark }: { bus: VehiclePosition; isDark: boolean }) {
  const markerRef = useRef<L.Marker | null>(null)
  const [displayPos, setDisplayPos] = useState<[number, number]>([bus.lat, bus.lon])
  const animFrame = useRef<number>(0)

  useEffect(() => {
    const targetLat = bus.lat
    const targetLon = bus.lon
    const startLat = displayPos[0]
    const startLon = displayPos[1]

    // Skip animation if first render or distance is tiny
    const dist = Math.abs(targetLat - startLat) + Math.abs(targetLon - startLon)
    if (dist < 0.000001) return

    const duration = 3000 // 3 seconds
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3)

      const lat = startLat + (targetLat - startLat) * ease
      const lon = startLon + (targetLon - startLon) * ease

      setDisplayPos([lat, lon])

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon])
      }

      if (t < 1) {
        animFrame.current = requestAnimationFrame(animate)
      }
    }

    animFrame.current = requestAnimationFrame(animate)

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
    // Only trigger animation when bus position changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus.lat, bus.lon])

  return (
    <Marker
      ref={markerRef}
      position={displayPos}
      icon={busIcon(bus.bearing, true, '#FF9100', isDark)}
    />
  )
}

export default function FavoriteMapView({ stop, nextBus, routeLive, tileStyle }: Props) {
  const isDark = isTileDark(tileStyle)
  const dirColors = getDirColors(isDark)

  // Find the best matching shape segment and trim it between bus and stop
  const trimmedSegment = useMemo(() => {
    if (!routeLive?.shapeSegments?.length) return null

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

  const fitPositions = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [...polyPositions]
    if (stop) pts.push([stop.stop_lat, stop.stop_lon])
    if (nextBus) pts.push([nextBus.lat, nextBus.lon])
    return pts
  }, [polyPositions, stop, nextBus])

  const routeColor = dirColors['0'] ?? '#00D4FF'

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

      {/* Animated dashed route polyline */}
      {polyPositions.length > 1 && (
        <AnimatedRoute positions={polyPositions} color={routeColor} isDark={isDark} />
      )}

      {/* Stop marker */}
      {stop && (
        <Marker
          position={[stop.stop_lat, stop.stop_lon]}
          icon={stopMarkerIcon(routeColor, true, isDark)}
        />
      )}

      {/* Animated bus marker */}
      {nextBus && (
        <AnimatedBusMarker bus={nextBus} isDark={isDark} />
      )}
    </MapContainer>
  )
}
