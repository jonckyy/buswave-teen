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

const PRIMARY = '#A78BFA'
const CYAN = '#22D3EE'
const SUN = '#FACC15'

function stopIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px; height:30px;
      background:${SUN};
      border:3px solid white;
      border-radius:50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 0 18px rgba(250, 204, 21, 0.8), 0 4px 12px rgba(0,0,0,0.5);
    ">
      <div style="
        width:10px; height:10px;
        background:white;
        border-radius:50%;
        position:absolute;
        top:7px; left:7px;
      "></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  })
}

function busIcon(bearing?: number) {
  const rot = bearing ?? 0
  return L.divIcon({
    className: '',
    html: `<div style="
      width:40px; height:40px;
      background:${PRIMARY};
      border:3px solid white;
      border-radius:50%;
      box-shadow: 0 0 24px rgba(168, 139, 250, 0.9), 0 4px 12px rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center;
      transform: rotate(${rot}deg);
      animation: pulse-bus 2s ease-in-out infinite;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-${rot}deg)">
        <path d="M12 19l7-7-7-7"/>
      </svg>
    </div>
    <style>
      @keyframes pulse-bus {
        0%, 100% { transform: rotate(${rot}deg) scale(1); }
        50% { transform: rotate(${rot}deg) scale(1.08); }
      }
    </style>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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
      className="rounded-3xl glass shadow-glass overflow-hidden"
      style={{ isolation: 'isolate' }}
    >
      <div style={{ height: 400 }}>
        <MapContainer
          center={[stopLat, stopLon]}
          zoom={15}
          scrollWheelZoom
          style={{ height: '100%', width: '100%', background: '#0B0B2E' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CartoDB"
          />

          <FitBounds stopLat={stopLat} stopLon={stopLon} busLat={bus?.lat} busLon={bus?.lon} />

          {shapePoints.length > 1 && (
            <Polyline
              positions={shapePoints.map((p) => [p.lat, p.lon] as [number, number])}
              pathOptions={{
                color: CYAN,
                weight: 5,
                opacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: '10, 8',
              }}
            />
          )}

          <Marker position={[stopLat, stopLon]} icon={stopIcon()} />

          {bus && <Marker position={[bus.lat, bus.lon]} icon={busIcon(bus.bearing)} />}
        </MapContainer>
      </div>
    </div>
  )
}
