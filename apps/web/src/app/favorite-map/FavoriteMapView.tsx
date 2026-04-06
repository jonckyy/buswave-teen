'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
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

const PRIMARY = '#7C3AED'
const SECONDARY = '#06B6D4'
const SUN = '#FACC15'

function stopIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px; height:28px;
      background:${SUN};
      border:4px solid white;
      border-radius:50%;
      box-shadow: 0 4px 0 0 ${SUN}66, 0 2px 10px rgba(15,23,42,0.3);
      display:flex; align-items:center; justify-content:center;
    ">
      <div style="
        width:8px; height:8px;
        background:white;
        border-radius:50%;
      "></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function busIcon(bearing?: number) {
  const rot = bearing ?? 0
  return L.divIcon({
    className: '',
    html: `<div style="
      width:38px; height:38px;
      background:${PRIMARY};
      border:4px solid white;
      border-radius:50%;
      box-shadow: 0 6px 0 0 ${PRIMARY}44, 0 2px 12px rgba(15,23,42,0.3);
      display:flex; align-items:center; justify-content:center;
      transform: rotate(${rot}deg);
      animation: pulse-bus 2s ease-in-out infinite;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-${rot}deg)">
        <path d="M12 19l7-7-7-7"/>
      </svg>
    </div>
    <style>
      @keyframes pulse-bus {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    </style>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function FitBounds({
  stopLat,
  stopLon,
  busLat,
  busLon,
}: {
  stopLat: number
  stopLon: number
  busLat?: number
  busLon?: number
}) {
  const map = useMap()
  const hasFit = useRef(false)
  useEffect(() => {
    if (hasFit.current) return
    if (busLat != null && busLon != null) {
      map.fitBounds(
        [
          [stopLat, stopLon],
          [busLat, busLon],
        ],
        { padding: [50, 50] }
      )
    } else {
      map.setView([stopLat, stopLon], 15)
    }
    hasFit.current = true
  }, [map, stopLat, stopLon, busLat, busLon])
  return null
}

interface Props {
  stopLat: number
  stopLon: number
  stopName: string
  bus: VehiclePosition | null
  shapePoints: Array<{ lat: number; lon: number }>
}

export function FavoriteMapView({ stopLat, stopLon, bus, shapePoints }: Props) {
  return (
    <div
      className="rounded-3xl border-2 border-line bg-surface overflow-hidden shadow-pop-cyan"
      style={{ isolation: 'isolate' }}
    >
      <div style={{ height: 400 }}>
        <MapContainer
          center={[stopLat, stopLon]}
          zoom={15}
          scrollWheelZoom
          style={{ height: '100%', width: '100%', background: '#FAFAF9' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CartoDB"
          />

          <FitBounds
            stopLat={stopLat}
            stopLon={stopLon}
            busLat={bus?.lat}
            busLon={bus?.lon}
          />

          {/* Route polyline */}
          {shapePoints.length > 1 && (
            <Polyline
              positions={shapePoints.map((p) => [p.lat, p.lon] as [number, number])}
              pathOptions={{
                color: SECONDARY,
                weight: 5,
                opacity: 0.6,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: '10, 8',
              }}
            />
          )}

          {/* Stop marker */}
          <Marker position={[stopLat, stopLon]} icon={stopIcon()} />

          {/* Bus marker */}
          {bus && (
            <Marker position={[bus.lat, bus.lon]} icon={busIcon(bus.bearing)} />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
