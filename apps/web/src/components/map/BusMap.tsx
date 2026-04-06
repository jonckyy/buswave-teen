'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { X, Navigation, Gauge, Hash, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { VehiclePosition } from '@buswave/shared'

// Fix default Leaflet icon paths
if (typeof window !== 'undefined') {
  // @ts-expect-error -- private Leaflet internals
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

const PRIMARY = '#7C3AED'
const SECONDARY = '#06B6D4'
const LIME = '#84CC16'
const SUN = '#FACC15'
const ROSE = '#FB7185'

function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

/** Create a teen-styled bus marker icon */
function teenBusIcon(bearing?: number, selected = false, color = PRIMARY) {
  const fill = selected ? SUN : color
  const size = selected ? 36 : 30
  const rotation = bearing ?? 0
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:${fill};
        border:3px solid white;
        border-radius:50%;
        box-shadow: 0 4px 0 0 ${fill}44, 0 2px 8px rgba(15,23,42,0.25);
        display:flex; align-items:center; justify-content:center;
        transform: rotate(${rotation}deg);
        transition: all 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-${rotation}deg)">
          <path d="M12 19l7-7-7-7"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/** Round stop marker */
function teenStopIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:12px; height:12px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

/** Fit map to Belgium on mount */
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

/** Fit to shape points — key-remount to re-fit on route change */
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

  // All vehicles (no route filter) or route-specific
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

  // Clear selected vehicle if it disappears
  useEffect(() => {
    if (!selectedVehicle) return
    const still = vehicles.find((v) => v.vehicleId === selectedVehicle.vehicleId)
    if (!still) setSelectedVehicle(null)
    else if (still !== selectedVehicle) setSelectedVehicle(still)
  }, [vehicles, selectedVehicle])

  return (
    <div
      className="relative rounded-3xl border-2 border-line bg-surface overflow-hidden shadow-pop-cyan"
      style={{ isolation: 'isolate' }}
    >
      <div style={{ height }}>
        <MapContainer
          center={[50.5, 4.7]}
          zoom={9}
          scrollWheelZoom
          style={{ height: '100%', width: '100%', background: '#FAFAF9' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OSM &copy; CartoDB'
          />

          {!routeId && <FitBelgium />}
          {routeId && shapePoints.length > 0 && (
            <FitShape key={routeId} points={shapePoints} />
          )}

          {/* Route polyline */}
          {routeLive?.shapeSegments?.map((seg, i) => (
            <Polyline
              key={`seg-${i}`}
              positions={seg.map((p) => [p.lat, p.lon] as [number, number])}
              pathOptions={{
                color: PRIMARY,
                weight: 6,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          ))}

          {/* Vehicle markers */}
          {vehicles.map((v) => {
            const isSelected = selectedVehicle?.vehicleId === v.vehicleId
            const color = routeId ? SECONDARY : PRIMARY
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
        <div className="rounded-pill bg-surface border-2 border-line px-3 py-1.5 shadow-card flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-lime-500 animate-pulse" />
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
    <div className="absolute bottom-4 left-4 right-4 z-[500] animate-slide-up">
      <div className="rounded-3xl bg-surface border-2 border-line shadow-pop p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-pop-cyan shrink-0">
              <span className="text-base font-extrabold">
                {details?.routeShortName ?? '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-ink truncate">
                {details?.headsign ?? 'Ligne en cours'}
              </p>
              <p className="text-xs text-ink2 font-bold">Bus {vehicle.vehicleId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-coral-50 text-rose-600 hover:bg-coral-100 active:scale-90 transition-transform shrink-0"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        {/* Info grid */}
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

        {/* Action: filter by route */}
        {onRouteSelect && (
          <button
            onClick={() => onRouteSelect(vehicle.routeId)}
            className="w-full flex items-center justify-center gap-2 rounded-pill bg-primary-600 text-white font-extrabold py-2.5 shadow-pop active:shadow-none active:translate-y-1.5 transition-all"
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
    <div className="rounded-2xl bg-primary-50 px-3 py-2 border-2 border-primary-100">
      <div className="flex items-center gap-1.5 text-primary-700 mb-0.5">
        {icon}
        <span className="text-[10px] font-extrabold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-extrabold text-ink truncate">{value}</p>
    </div>
  )
}
