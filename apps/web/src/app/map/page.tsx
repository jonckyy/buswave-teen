'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { GtfsRoute } from '@buswave/shared'

const BusMap = dynamic(() => import('@/components/map/BusMap').then((m) => m.BusMap), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border border-border bg-card"
      style={{ height: 600 }}
    >
      <p className="text-muted text-sm">Chargement de la carte…</p>
    </div>
  ),
})

export default function MapPage() {
  const [query, setQuery] = useState('')
  const [selectedRoute, setSelectedRoute] = useState<GtfsRoute | null>(null)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: routes = [] } = useQuery({
    queryKey: ['map-route-search', query],
    queryFn: () => api.searchRoutes(query),
    enabled: query.length >= 1 && !selectedRoute,
    staleTime: 10_000,
  })

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function selectRoute(route: GtfsRoute) {
    setSelectedRoute(route)
    setQuery(`${route.route_short_name} — ${route.route_long_name}`)
    setOpen(false)
  }

  function clearFilter() {
    setSelectedRoute(null)
    setQuery('')
    setOpen(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Carte en direct</h1>
      <p className="text-muted text-sm mb-4">
        {selectedRoute
          ? `Ligne ${selectedRoute.route_short_name} — ${selectedRoute.route_long_name}`
          : 'Tous les bus TEC actifs en Wallonie'}
      </p>

      {/* Route autocomplete filter */}
      <div className="relative mb-4" ref={wrapperRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedRoute(null)
                setOpen(true)
              }}
              onFocus={() => { if (query.length >= 1 && !selectedRoute) setOpen(true) }}
              placeholder="Filtrer par numéro ou nom de ligne…"
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-white placeholder:text-muted focus:border-accent-cyan focus:outline-none"
            />
          </div>
          {selectedRoute && (
            <button
              onClick={clearFilter}
              className="rounded-xl border border-border bg-card px-4 py-3 text-muted hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && routes.length > 0 && !selectedRoute && (
          <ul className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden max-h-56 overflow-y-auto">
            {routes.map((route) => (
              <li key={route.route_id}>
                <button
                  onClick={() => selectRoute(route)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-sm font-bold text-accent-cyan">
                    {route.route_short_name}
                  </span>
                  <span className="text-sm text-white truncate">{route.route_long_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BusMap routeId={selectedRoute?.route_id} height={600} />
    </div>
  )
}
