'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Pill } from '@/components/ui/Pill'
import type { GtfsRoute } from '@buswave/shared'

const BusMap = dynamic(() => import('@/components/map/BusMap').then((m) => m.BusMap), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl border-2 border-line bg-primary-50 animate-pulse" style={{ height: 600 }}>
      <div className="h-full flex items-center justify-center">
        <p className="text-ink2 font-bold">Chargement de la carte...</p>
      </div>
    </div>
  ),
})

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-[600px] skeleton rounded-3xl" />}>
      <MapPageInner />
    </Suspense>
  )
}

function MapPageInner() {
  const searchParams = useSearchParams()
  const initialRouteId = searchParams.get('routeId')

  const [query, setQuery] = useState('')
  const [selectedRoute, setSelectedRoute] = useState<GtfsRoute | null>(null)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Initialize route from URL param
  const { data: initialRouteData } = useQuery({
    queryKey: ['route-live-init', initialRouteId],
    queryFn: () => api.routeLive(initialRouteId!),
    enabled: !!initialRouteId && !selectedRoute,
    staleTime: 60_000,
  })
  useEffect(() => {
    if (initialRouteData && !selectedRoute) {
      setSelectedRoute(initialRouteData.route)
      setQuery(`${initialRouteData.route.route_short_name} — ${initialRouteData.route.route_long_name}`)
    }
  }, [initialRouteData, selectedRoute])

  const { data: routes = [] } = useQuery({
    queryKey: ['map-route-search', query],
    queryFn: () => api.searchRoutes(query),
    enabled: query.length >= 1 && !selectedRoute,
    staleTime: 10_000,
  })

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectRoute = (route: GtfsRoute) => {
    setSelectedRoute(route)
    setQuery(`${route.route_short_name} — ${route.route_long_name}`)
    setOpen(false)
  }

  const clearFilter = () => {
    setSelectedRoute(null)
    setQuery('')
    setOpen(false)
  }

  const handleRouteFilter = useCallback(
    async (vehicleRouteId: string) => {
      if (selectedRoute?.route_id === vehicleRouteId) return
      try {
        const data = await api.routeLive(vehicleRouteId)
        setSelectedRoute(data.route)
        setQuery(`${data.route.route_short_name} — ${data.route.route_long_name}`)
        setOpen(false)
      } catch {
        /* ignore */
      }
    },
    [selectedRoute]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-ink leading-tight">Carte live</h1>
        {selectedRoute ? (
          <div className="flex items-center gap-2 mt-1">
            <Pill variant="primary" size="md">
              {selectedRoute.route_short_name}
            </Pill>
            <p className="text-ink2 font-medium truncate">{selectedRoute.route_long_name}</p>
          </div>
        ) : (
          <p className="text-ink2 font-medium">Tous les bus TEC en Wallonie</p>
        )}
      </div>

      {/* Search autocomplete */}
      <div className="relative" ref={wrapperRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink3"
              strokeWidth={2.5}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedRoute(null)
                setOpen(true)
              }}
              onFocus={() => {
                if (query.length >= 1 && !selectedRoute) setOpen(true)
              }}
              placeholder="Filtrer par ligne..."
              className="w-full h-14 rounded-3xl border-2 border-line bg-surface pl-12 pr-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
          </div>
          {selectedRoute && (
            <button
              onClick={clearFilter}
              className="flex h-14 w-14 items-center justify-center rounded-3xl border-2 border-line bg-surface text-ink2 hover:text-rose-600 hover:border-coral-400 active:scale-95 transition-all shrink-0"
              aria-label="Effacer le filtre"
            >
              <X className="h-5 w-5" strokeWidth={3} />
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {open && routes.length > 0 && !selectedRoute && (
          <div className="absolute z-[9999] mt-2 w-full rounded-3xl border-2 border-line bg-surface shadow-card-lg overflow-hidden max-h-64 overflow-y-auto">
            {routes.map((route) => (
              <button
                key={route.route_id}
                onClick={() => selectRoute(route)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-50 border-b-2 border-line last:border-b-0 transition-colors"
              >
                <Pill variant="primary" size="md" className="shrink-0 !w-12 !h-9">
                  {route.route_short_name}
                </Pill>
                <span className="text-sm font-semibold text-ink truncate">{route.route_long_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <BusMap
        routeId={selectedRoute?.route_id}
        height={600}
        onRouteSelect={handleRouteFilter}
      />
    </div>
  )
}
