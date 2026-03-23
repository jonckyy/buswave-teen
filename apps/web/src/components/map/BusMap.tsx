'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { X, Bus, Navigation, Gauge, Clock, MapPin, Hash, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { VehicleDetails, VehiclePosition } from '@buswave/shared'

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

function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

function busIcon(bearing?: number, selected = false) {
  const color = selected ? '#FF9100' : '#00D4FF'
  const rotation = (bearing ?? 0) - 45
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;
      background:${color};
      border:2px solid #0A0E17;
      border-radius:50% 50% 50% 0;
      transform:rotate(${rotation}deg);
      box-shadow:0 2px 8px ${selected ? 'rgba(255,145,0,0.6)' : 'rgba(0,212,255,0.4)'};
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

interface BusInfoPanelProps {
  vehicle: VehiclePosition
  details: VehicleDetails | undefined
  loadingDetails: boolean
  onClose: () => void
}

function BusInfoPanel({ vehicle: v, details, loadingDetails, onClose }: BusInfoPanelProps) {
  const updatedAt = new Date(v.timestamp * 1000).toLocaleTimeString('fr-BE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const routeShortName = details?.routeShortName
  const headsign = details?.headsign
  const nextStopName = details?.nextStopName

  return (
    <div className="absolute top-3 left-3 z-[1000] w-72 rounded-xl border border-border bg-[#131A2B]/95 backdrop-blur shadow-xl text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
          <span className="font-bold text-white">Bus {v.vehicleId}</span>
          {loadingDetails && <span className="text-xs text-muted">…</span>}
        </div>
        <button onClick={onClose} className="text-muted hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <Row icon={<Bus className="h-3.5 w-3.5" />} label="Ligne">
          {routeShortName
            ? <><span className="font-bold text-accent-cyan">{routeShortName}</span><span className="text-muted text-xs ml-1">({v.routeId})</span></>
            : <span className="text-accent-cyan font-bold">{v.routeId}</span>
          }
        </Row>

        {headsign && (
          <Row icon={<ArrowRight className="h-3.5 w-3.5" />} label="Direction">
            <span className="text-white">→ {headsign}</span>
          </Row>
        )}

        {(v.stopId || nextStopName) && (
          <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Prochain arrêt">
            <span className="text-white">{nextStopName ?? v.stopId}</span>
            {v.currentStopSequence != null && (
              <span className="text-muted text-xs ml-1">#{v.currentStopSequence}</span>
            )}
          </Row>
        )}

        {v.speed != null && (
          <Row icon={<Gauge className="h-3.5 w-3.5" />} label="Vitesse">
            <span className="text-white">{Math.round(v.speed * 3.6)} km/h</span>
          </Row>
        )}

        {v.bearing != null && (
          <Row icon={<Navigation className="h-3.5 w-3.5" />} label="Cap">
            <span className="text-white">{Math.round(v.bearing)}° <span className="text-muted">({bearingToCompass(v.bearing)})</span></span>
          </Row>
        )}

        <Row icon={<Hash className="h-3.5 w-3.5" />} label="Trip">
          <span className="text-muted font-mono text-xs truncate max-w-[150px]">{v.tripId || '—'}</span>
        </Row>

        <Row icon={<MapPin className="h-3.5 w-3.5 opacity-50" />} label="GPS">
          <span className="text-muted font-mono text-xs">{v.lat.toFixed(5)}, {v.lon.toFixed(5)}</span>
        </Row>

        <Row icon={<Clock className="h-3.5 w-3.5" />} label="MàJ">
          <span className="text-muted">{updatedAt}</span>
        </Row>
      </div>
    </div>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted mt-0.5 shrink-0">{icon}</span>
      <span className="text-muted w-20 shrink-0">{label}</span>
      <span className="flex items-center gap-1 min-w-0">{children}</span>
    </div>
  )
}

interface BusMapProps {
  /** When undefined, shows ALL active TEC buses */
  routeId?: string
  height?: number
}

export function BusMap({ routeId, height = 480 }: BusMapProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePosition | null>(null)

  // Details for the selected bus (line name, headsign, next stop name)
  const detailsQuery = useQuery({
    queryKey: ['vehicle-details', selectedVehicle?.routeId, selectedVehicle?.tripId, selectedVehicle?.stopId],
    queryFn: () => api.vehicleDetails(
      selectedVehicle!.routeId,
      selectedVehicle!.tripId,
      selectedVehicle!.stopId,
    ),
    enabled: !!selectedVehicle,
    staleTime: 30_000,
  })

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

  // Keep selectedVehicle data fresh after refetch
  useEffect(() => {
    if (!selectedVehicle) return
    const updated = vehicles.find((v) => v.vehicleId === selectedVehicle.vehicleId)
    if (updated) setSelectedVehicle(updated)
  }, [vehicles]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-border [isolation:isolate]" style={{ height }}>
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
          <Marker
            key={v.vehicleId}
            position={[v.lat, v.lon]}
            icon={busIcon(v.bearing, selectedVehicle?.vehicleId === v.vehicleId)}
            eventHandlers={{ click: () => setSelectedVehicle(v) }}
          />
        ))}

        {/* Auto-fit: Belgium for all-vehicles, route bounds for per-route */}
        {!routeId && <FitBelgiumOnce />}
        {routeId && shapePoints.length > 0 && <FitPointsOnce points={shapePoints} />}
      </MapContainer>

      {/* Bus info panel */}
      {selectedVehicle && (
        <BusInfoPanel
          vehicle={selectedVehicle}
          details={detailsQuery.data}
          loadingDetails={detailsQuery.isLoading}
          onClose={() => setSelectedVehicle(null)}
        />
      )}

      {/* Status bar */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-3 py-1 text-xs text-muted">
        <span className="inline-block w-2 h-2 rounded-full bg-on-time animate-pulse" />
        {vehicles.length} bus actifs · {new Date(updatedAt).toLocaleTimeString('fr-BE')}
      </div>
    </div>
  )
}
