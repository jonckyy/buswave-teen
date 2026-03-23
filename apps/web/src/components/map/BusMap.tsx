'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { api } from '@/lib/api'
import type { VehiclePosition } from '@buswave/shared'

// Fix Leaflet default icon in Next.js
if (typeof window !== 'undefined') {
  // @ts-expect-error -- private Leaflet internals
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

function busIcon(bearing?: number, color = '#00D4FF') {
  const rotation = (bearing ?? 0) - 45
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;
      background:${color};
      border:2px solid #0A0E17;
      border-radius:50% 50% 50% 0;
      transform:rotate(${rotation}deg);
      box-shadow:0 2px 8px rgba(0,212,255,0.4);
    "></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

/** Fits map to Belgium on first load only */
function FitBelgiumOnce() {
  const map = useMap()
  const hasFit = useRef(false)
  useEffect(() => {
    if (hasFit.current) return
    map.fitBounds([[49.5, 2.5], [50.9, 6.4]], { padding: [16, 16] })
    hasFit.current = true
  }, [map])
  return null
}

/** Fits map to given points on first load only */
function FitPointsOnce({ points }: { points: Array<{ lat: number; lon: number }> }) {
  const map = useMap()
  const hasFit = useRef(false)
  useEffect(() => {
    if (hasFit.current || points.length === 0) return
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [32, 32] })
    hasFit.current = true
  }, [map, points])
  return null
}

interface BusMapProps {
  /** When undefined, shows ALL active TEC buses */
  routeId?: string
  height?: number
}

export function BusMap({ routeId, height = 480 }: BusMapProps) {
  // All-vehicles mode
  const allQuery = useQuery({
    queryKey: ['all-vehicles'],
    queryFn: () => api.allVehicles(),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
    enabled: !routeId,
  })

  // Per-route mode
  const routeQuery = useQuery({
    queryKey: ['route-live', routeId],
    queryFn: () => api.routeLive(routeId!),
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
    enabled: !!routeId,
  })

  const vehicles: VehiclePosition[] = routeId
    ? (routeQuery.data?.vehicles ?? [])
    : (allQuery.data ?? [])

  const shapePoints = routeQuery.data?.shapePoints ?? []
  const updatedAt = routeId ? routeQuery.dataUpdatedAt : allQuery.dataUpdatedAt

  return (
    <div className="relative rounded-xl overflow-hidden border border-border" style={{ height }}>
      <MapContainer
        center={[50.4, 4.5]}
        zoom={9}
        style={{ height: '100%', width: '100%', background: '#0A0E17' }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Route polyline (per-route mode only) — uses shapes.txt, never stop coords */}
        {shapePoints.length > 0 && (
          <Polyline
            positions={shapePoints.map((p) => [p.lat, p.lon])}
            color="#00D4FF"
            weight={3}
            opacity={0.8}
          />
        )}

        {/* Bus markers */}
        {vehicles.map((v) => (
          <Marker key={v.vehicleId} position={[v.lat, v.lon]} icon={busIcon(v.bearing)}>
            <Popup>
              <div className="text-sm space-y-0.5">
                <p className="font-bold text-white">Bus {v.vehicleId}</p>
                {v.routeId && <p className="text-muted">Ligne {v.routeId}</p>}
                {v.speed != null && <p className="text-muted">{Math.round(v.speed)} km/h</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Auto-fit: Belgium for all-vehicles, route bounds for per-route */}
        {!routeId && <FitBelgiumOnce />}
        {routeId && shapePoints.length > 0 && <FitPointsOnce points={shapePoints} />}
      </MapContainer>

      {/* Status bar */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-3 py-1 text-xs text-muted">
        <span className="inline-block w-2 h-2 rounded-full bg-on-time animate-pulse" />
        {vehicles.length} bus actifs · {new Date(updatedAt).toLocaleTimeString('fr-BE')}
      </div>
    </div>
  )
}
