'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { X, Navigation, Gauge, Hash, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { VehiclePosition } from '@buswave/shared'

if (typeof window !== 'undefined') {
  // @ts-expect-error -- private Leaflet internals
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

const PRIMARY = '#A78BFA'
const CYAN = '#22D3EE'
const MAGENTA = '#EC4899'

function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

function teenBusIcon(bearing?: number, selected = false, color = PRIMARY) {
  const fill = selected ? MAGENTA : color
  const glow = selected ? 'rgba(236,72,153,0.85)' : `${color}DD`
  const size = selected ? 38 : 30
  const rotation = bearing ?? 0
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:${fill};
        border:3px solid white;
        border-radius:50%;
        box-shadow: 0 0 16px ${glow}, 0 4px 12px rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center;
        transform: rotate(${rotation}deg);
        transition: all 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-${rotation}deg)">
          <path d="M12 19l7-7-7-7"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function FitBelgium() {
  const map = useMap()
  const hasFit = useRef(false)
  useEffect(() => {
    if (hasFit.current) return
    map.fitBounds([[49.5, 2.5], [50.9, 6.4]], { padding: [16, 16] })
    hasFit.current = true
  }, [map])
  return null
}

function FitShape({ points }: { points: Array<{ lat: number; lon: number }> }) {
  const map = useMap()
  useEffect(() => {
    if (points.length < 2) return
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])),
      { padding: [40, 40] }
    )
  }, [map, points])
  return null
}

interface BusMapProps {
  routeId?: string
  height?: number
  onRouteSelect?: (routeId: string) => void
}

export function BusMap({ routeId, height = 600, onRouteSelect }: BusMapProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePosition | null>(null)

  const { data: allVehicles = [] } = useQuery({
    queryKey: ['all-vehicles-map'],
    queryFn: () => api.allVehicles(),
    refetchInterval: 10_000,
    staleTime: 5_000,
    enabled: !routeId,
  })

  const { data: routeLive } = useQuery({
    queryKey: ['route-live-map', routeId],
    queryFn: () => api.routeLive(routeId!),
    refetchInterval: 10_000,
    staleTime: 5_000,
    enabled: !!routeId,
  })

  const vehicles = routeId ? routeLive?.vehicles ?? [] : allVehicles
  const shapePoints = useMemo(() => {
    if (!routeLive?.shapeSegments) return []
    return routeLive.shapeSegments.flat()
  }, [routeLive])

  useEffect(() => {
    if (!selectedVehicle) return
    const still = vehicles.find((v) => v.vehicleId === selectedVehicle.vehicleId)
    if (!still) setSelectedVehicle(null)
    else if (still !== selectedVehicle) setSelectedVehicle(still)
  }, [vehicles, selectedVehicle])

  return (
    <div
      className="relative rounded-3xl glass shadow-glass overflow-hidden"
      style={{ isolation: 'isolate' }}
    >
      <div style={{ height }}>
        <MapContainer
          center={[50.5, 4.7]}
          zoom={9}
          scrollWheelZoom
          style={{ height: '100%', width: '100%', background: '#0B0B2E' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CartoDB"
          />

          {!routeId && <FitBelgium />}
          {routeId && shapePoints.length > 0 && <FitShape key={routeId} points={shapePoints} />}

          {/* Route polyline */}
          {routeLive?.shapeSegments?.map((seg, i) => (
            <Polyline
              key={`seg-${i}`}
              positions={seg.map((p) => [p.lat, p.lon] as [number, number])}
              pathOptions={{
                color: PRIMARY,
                weight: 5,
                opacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          ))}

          {/* Vehicle markers */}
          {vehicles.map((v) => {
            const isSelected = selectedVehicle?.vehicleId === v.vehicleId
            const color = routeId ? CYAN : PRIMARY
            return (
              <Marker
                key={v.vehicleId}
                position={[v.lat, v.lon]}
                icon={teenBusIcon(v.bearing, isSelected, color)}
                eventHandlers={{
                  click: () => setSelectedVehicle(v),
                }}
              />
            )
          })}
        </MapContainer>
      </div>

      {/* Info panel */}
      {selectedVehicle && (
        <BusInfoPanel
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          onRouteSelect={onRouteSelect}
        />
      )}

      {/* Vehicle count badge */}
      <div className="absolute top-4 left-4 z-[500]">
        <div className="rounded-pill glass-strong px-3 py-1.5 flex items-center gap-2 shadow-glow-sm">
          <div className="h-2 w-2 rounded-full bg-lime-light shadow-glow-lime animate-pulse" />
          <span className="text-xs font-extrabold text-ink tabular-nums">{vehicles.length}</span>
          <span className="text-xs font-bold text-ink2">bus</span>
        </div>
      </div>
    </div>
  )
}

function BusInfoPanel({
  vehicle,
  onClose,
  onRouteSelect,
}: {
  vehicle: VehiclePosition
  onClose: () => void
  onRouteSelect?: (routeId: string) => void
}) {
  const { data: details } = useQuery({
    queryKey: ['vehicle-details', vehicle.routeId, vehicle.tripId],
    queryFn: () => api.vehicleDetails(vehicle.routeId, vehicle.tripId, vehicle.stopId),
    staleTime: 10_000,
  })

  return (
    <div className="absolute bottom-4 left-4 right-4 z-[500] animate-fade-up">
      <div className="glass-strong gradient-border rounded-3xl shadow-glass-lg p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-btn-primary text-white shadow-glow shrink-0">
              <span className="text-base font-extrabold">
                {details?.routeShortName ?? '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-ink truncate">
                {details?.headsign ?? 'Ligne en cours'}
              </p>
              <p className="text-xs text-ink3 font-bold">Bus {vehicle.vehicleId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl glass text-rose-light hover:shadow-glow-magenta active:scale-90 transition-all shrink-0"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {vehicle.speed != null && (
            <InfoChip
              icon={<Gauge className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label="Vitesse"
              value={`${Math.round(vehicle.speed * 3.6)} km/h`}
            />
          )}
          {vehicle.bearing != null && (
            <InfoChip
              icon={<Navigation className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label="Direction"
              value={bearingToCompass(vehicle.bearing)}
            />
          )}
          {details?.nextStopName && (
            <div className="col-span-2">
              <InfoChip
                icon={<Hash className="h-3.5 w-3.5" strokeWidth={2.5} />}
                label="Prochain arrêt"
                value={details.nextStopName}
              />
            </div>
          )}
        </div>

        {onRouteSelect && (
          <button
            onClick={() => onRouteSelect(vehicle.routeId)}
            className="w-full flex items-center justify-center gap-2 rounded-pill bg-btn-primary text-white font-extrabold py-2.5 shadow-glow hover:shadow-glow-magenta active:scale-95 transition-all"
          >
            Voir cette ligne
            <ArrowRight className="h-4 w-4" strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  )
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl glass px-3 py-2">
      <div className="flex items-center gap-1.5 text-primary-light mb-0.5">
        {icon}
        <span className="text-[10px] font-extrabold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-extrabold text-ink truncate">{value}</p>
    </div>
  )
}
