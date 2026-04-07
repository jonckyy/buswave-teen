'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useQueries } from '@tanstack/react-query'
import L from 'leaflet'
import { api } from '@/lib/api'
import { getRemainingShape } from '@/lib/route-segment'
import type { Favorite } from '@buswave/shared'

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

function stopPin() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px; height:30px;
      background: ${SUN};
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 0 16px rgba(250, 204, 21, 0.7), 0 4px 12px rgba(0,0,0,0.4);
    ">
      <div style="
        width: 10px; height: 10px;
        background: white;
        border-radius: 50%;
        position: absolute;
        top: 6px; left: 7px;
      "></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  })
}

function busDot(bearing?: number) {
  const rot = bearing ?? 0
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 32px; height: 32px;
      background: ${PRIMARY};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 18px rgba(168, 139, 250, 0.85), 0 4px 12px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      transform: rotate(${rot}deg);
      animation: pulse-bus 2s ease-in-out infinite;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-${rot}deg)">
        <path d="M12 19l7-7-7-7"/>
      </svg>
    </div>
    <style>
      @keyframes pulse-bus {
        0%, 100% { transform: rotate(${rot}deg) scale(1); }
        50% { transform: rotate(${rot}deg) scale(1.08); }
      }
    </style>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

interface FavoriteWithData {
  favorite: Favorite
  stopLat: number
  stopLon: number
  busLat?: number
  busLon?: number
  busBearing?: number
  remainingShape: Array<{ lat: number; lon: number }>
}

function FitAll({ items }: { items: FavoriteWithData[] }) {
  const map = useMap()
  const lastSig = useRef('')

  useEffect(() => {
    if (items.length === 0) return
    const points: [number, number][] = []
    for (const it of items) {
      points.push([it.stopLat, it.stopLon])
      if (it.busLat != null && it.busLon != null) {
        points.push([it.busLat, it.busLon])
      }
    }
    if (points.length === 0) return
    const sig = points.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join('|')
    if (sig === lastSig.current) return
    lastSig.current = sig
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
  }, [map, items])

  return null
}

interface Props {
  favorites: Favorite[]
  height?: number
}

/**
 * Mini-map for the landing page.
 * For each favorite (stop+route), show:
 *  - the favorite stop pin
 *  - the next bus heading there (with bearing)
 *  - the remaining polyline from the bus to the stop
 * Auto-fits to all favorites + their buses.
 */
export function FavoritesMiniMap({ favorites, height = 280 }: Props) {
  // Limit to 5 most recent favorites for performance
  const visibleFavs = useMemo(() => favorites.slice(0, 5), [favorites])

  // Fetch arrivals + stop info + route live for each favorite
  const queries = useQueries({
    queries: visibleFavs.flatMap((fav) => [
      {
        queryKey: ['stop', fav.stopId],
        queryFn: () => api.stopInfo(fav.stopId),
        staleTime: 60_000,
      },
      {
        queryKey: ['arrivals', fav.stopId, fav.routeId ?? null],
        queryFn: () => api.arrivals(fav.stopId, fav.routeId ?? undefined),
        refetchInterval: 15_000,
        staleTime: 10_000,
      },
      {
        queryKey: ['route-live', fav.routeId],
        queryFn: () => api.routeLive(fav.routeId!),
        enabled: !!fav.routeId,
        refetchInterval: 15_000,
        staleTime: 10_000,
      },
    ]),
  })

  const items: FavoriteWithData[] = useMemo(() => {
    const out: FavoriteWithData[] = []
    visibleFavs.forEach((fav, i) => {
      const stopRes = queries[i * 3]
      const arrivalsRes = queries[i * 3 + 1]
      const routeLiveRes = queries[i * 3 + 2]

      const stopData = stopRes?.data as { stop_lat: number; stop_lon: number } | undefined
      if (!stopData) return

      const arrivals = (arrivalsRes?.data as Array<{ tripId: string }> | undefined) ?? []
      const routeLive = routeLiveRes?.data as
        | { vehicles: Array<{ tripId: string; lat: number; lon: number; bearing?: number }>; shapeSegments: Array<Array<{ lat: number; lon: number }>> }
        | undefined

      let busLat: number | undefined
      let busLon: number | undefined
      let busBearing: number | undefined
      let remainingShape: Array<{ lat: number; lon: number }> = []

      const firstTripId = arrivals[0]?.tripId
      if (firstTripId && routeLive) {
        const bus = routeLive.vehicles.find((v) => v.tripId === firstTripId)
        if (bus) {
          busLat = bus.lat
          busLon = bus.lon
          busBearing = bus.bearing
          const fullShape = routeLive.shapeSegments.flat()
          remainingShape = getRemainingShape(
            fullShape,
            bus.lat,
            bus.lon,
            stopData.stop_lat,
            stopData.stop_lon
          )
        }
      }

      out.push({
        favorite: fav,
        stopLat: stopData.stop_lat,
        stopLon: stopData.stop_lon,
        busLat,
        busLon,
        busBearing,
        remainingShape,
      })
    })
    return out
  }, [visibleFavs, queries])

  if (favorites.length === 0) return null

  // Default center on Belgium if nothing computed yet
  const initialCenter: [number, number] =
    items.length > 0 ? [items[0].stopLat, items[0].stopLon] : [50.5, 4.7]

  return (
    <div
      className="rounded-3xl glass shadow-glass overflow-hidden animate-fade-up"
      style={{ isolation: 'isolate' }}
    >
      <div style={{ height }}>
        <MapContainer
          center={initialCenter}
          zoom={12}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#0B0B2E' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CartoDB"
          />

          <FitAll items={items} />

          {/* Polylines: remaining trip from bus to stop */}
          {items.map(
            (it, i) =>
              it.remainingShape.length > 1 && (
                <Polyline
                  key={`poly-${i}`}
                  positions={it.remainingShape.map((p) => [p.lat, p.lon] as [number, number])}
                  pathOptions={{
                    color: CYAN,
                    weight: 4,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: '8 6',
                  }}
                />
              )
          )}

          {/* Stop pins */}
          {items.map((it, i) => (
            <Marker
              key={`stop-${i}`}
              position={[it.stopLat, it.stopLon]}
              icon={stopPin()}
            />
          ))}

          {/* Bus markers */}
          {items.map(
            (it, i) =>
              it.busLat != null &&
              it.busLon != null && (
                <Marker
                  key={`bus-${i}`}
                  position={[it.busLat, it.busLon]}
                  icon={busDot(it.busBearing)}
                />
              )
          )}
        </MapContainer>
      </div>
    </div>
  )
}
