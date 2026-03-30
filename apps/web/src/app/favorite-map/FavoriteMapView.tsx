'use client'

import { useEffect, useRef } from 'react'
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

/** Auto-fit the map to show the stop, next bus, and route segment */
function AutoFit({ stop, nextBus, routeLive }: { stop: GtfsStop | null; nextBus: VehiclePosition | null; routeLive: RouteWithLiveVehicles | null }) {
  const map = useMap()
  const hasFit = useRef(false)

  useEffect(() => {
    if (hasFit.current) return
    const points: [number, number][] = []

    if (stop) points.push([stop.stop_lat, stop.stop_lon])
    if (nextBus) points.push([nextBus.lat, nextBus.lon])

    // Add shape points between bus and stop for a fuller view
    if (routeLive?.shapeSegments?.length) {
      for (const seg of routeLive.shapeSegments) {
        for (const p of seg) {
          points.push([p.lat, p.lon])
        }
      }
    }

    if (points.length >= 2) {
      hasFit.current = true
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    } else if (points.length === 1) {
      hasFit.current = true
      map.setView(points[0], 15)
    }
  }, [map, stop, nextBus, routeLive])

  return null
}

export default function FavoriteMapView({ stop, nextBus, routeLive, tileStyle }: Props) {
  const isDark = isTileDark(tileStyle)
  const dirColors = getDirColors(isDark)

  // Determine which direction this stop is on (use bus direction or default 0)
  const busDir = nextBus?.tripId && routeLive?.vehicles
    ? routeLive.vehicles.find((v) => v.tripId === nextBus.tripId)
    : nextBus

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

      <AutoFit stop={stop} nextBus={nextBus} routeLive={routeLive} />

      {/* Route polylines */}
      {routeLive?.shapeSegments?.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.map((p) => [p.lat, p.lon] as [number, number])}
          color={dirColors[String(i)] ?? '#00D4FF'}
          weight={4}
          opacity={isDark ? 0.7 : 0.85}
        />
      ))}

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
