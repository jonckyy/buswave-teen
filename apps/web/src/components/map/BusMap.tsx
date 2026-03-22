'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { api } from '@/lib/api'
import type { VehiclePosition } from '@buswave/shared'

// Fix Leaflet default icon issue in Next.js
// Must run client-side only
if (typeof window !== 'undefined') {
  // @ts-expect-error -- private Leaflet internals
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

/** Creates a bus icon with bearing rotation */
function busIcon(bearing?: number) {
  const rotation = bearing ?? 0
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 28px; height: 28px;
      background: #00D4FF;
      border: 2px solid #0A0E17;
      border-radius: 50% 50% 50% 0;
      transform: rotate(${rotation - 45}deg);
      box-shadow: 0 2px 8px rgba(0,212,255,0.4);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

/** Fits bounds on first load only — never re-fits on refetch */
function FitBoundsOnce({ points }: { points: Array<{ lat: number; lon: number }> }) {
  const map = useMap()
  const hasFit = useRef(false)

  useEffect(() => {
    if (hasFit.current || points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]))
    map.fitBounds(bounds, { padding: [32, 32] })
    hasFit.current = true
  }, [map, points])

  return null
}

interface BusMapProps {
  routeId: string
}

export function BusMap({ routeId }: BusMapProps) {
  const { data: routeLive, dataUpdatedAt } = useQuery({
    queryKey: ['route-live', routeId],
    queryFn: () => api.routeLive(routeId),
    refetchInterval: 15_000,
    // Keep previous data to avoid map flicker
    placeholderData: (prev) => prev,
  })

  const shapePoints = routeLive?.shapePoints ?? []
  const vehicles = routeLive?.vehicles ?? []

  return (
    <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 480 }}>
      <MapContainer
        center={[50.4, 4.5]} // Belgium center
        zoom={10}
        style={{ height: '100%', width: '100%', background: '#0A0E17' }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Route polyline — uses shapes.txt points, NEVER stop coordinates */}
        {shapePoints.length > 0 && (
          <Polyline
            positions={shapePoints.map((p) => [p.lat, p.lon])}
            color="#00D4FF"
            weight={3}
            opacity={0.8}
          />
        )}

        {/* Live bus markers */}
        {vehicles.map((v) => (
          <Marker key={v.vehicleId} position={[v.lat, v.lon]} icon={busIcon(v.bearing)}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">Bus {v.vehicleId}</p>
                <p className="text-muted">Ligne {v.routeId}</p>
                {v.speed != null && <p>{Math.round(v.speed)} km/h</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Auto-fit on first load only */}
        <FitBoundsOnce points={shapePoints} />
      </MapContainer>

      {/* Refresh indicator */}
      <div className="absolute bottom-3 right-3 z-[1000] rounded-full bg-background/80 px-3 py-1 text-xs text-muted">
        {vehicles.length} bus · mis à jour {new Date(dataUpdatedAt).toLocaleTimeString('fr-BE')}
      </div>
    </div>
  )
}
