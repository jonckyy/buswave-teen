'use client'

import { useState, useEffect, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, MapPin, Navigation, Loader2, ChevronDown, ChevronUp, Bus } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore } from '@/store/favorites'
import { useFavoritesActions } from '@/hooks/useFavoritesActions'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { GradientText } from '@/components/ui/GradientText'
import type { GtfsStop, StopWithHeadsigns } from '@buswave/shared'

type Mode = 'nearby' | 'stop' | 'line'

const MODES: { key: Mode; label: string; icon: typeof Search }[] = [
  { key: 'nearby', label: 'Autour', icon: Navigation },
  { key: 'stop', label: 'Arrêt', icon: MapPin },
  { key: 'line', label: 'Ligne', icon: Bus },
]

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="h-16 skeleton rounded-3xl" />}>
      <SearchPageInner />
    </Suspense>
  )
}

function SearchPageInner() {
  const [mode, setMode] = useState<Mode>('nearby')
  const [query, setQuery] = useState('')

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <GradientText as="h1" className="text-3xl font-extrabold tracking-tight block">
          Trouver
        </GradientText>
        <p className="text-ink2 font-medium">Ajoute un arrêt à tes favoris</p>
      </div>

      {/* Mode pills */}
      <div className="flex gap-2 animate-fade-up">
        {MODES.map(({ key, label, icon: Icon }) => {
          const active = mode === key
          return (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-pill py-3 font-bold text-sm pressable transition-all',
                active
                  ? 'bg-btn-primary text-white shadow-glow'
                  : 'glass text-ink2 hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} />
              {label}
            </button>
          )
        })}
      </div>

      {mode !== 'nearby' && (
        <div className="relative animate-fade-up">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink3" strokeWidth={2.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'stop' ? 'Nom de l\'arrêt...' : 'Numéro de ligne...'}
            className="w-full h-14 rounded-3xl glass pl-12 pr-5 text-lg font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:shadow-glow"
            autoFocus
          />
        </div>
      )}

      {mode === 'nearby' ? <NearbyTab /> : mode === 'stop' ? <StopSearchTab query={query} /> : <LineSearchTab query={query} />}
    </div>
  )
}

function NearbyTab() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non supportée')
      setRequesting(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setRequesting(false)
      },
      (err) => {
        setGeoError(
          err.code === 1 ? 'Autorise la localisation dans ton navigateur' : 'Impossible de te localiser'
        )
        setRequesting(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['nearby-stops', coords?.lat, coords?.lon],
    queryFn: () => api.nearbyStops(coords!.lat, coords!.lon, 12),
    enabled: !!coords,
    staleTime: 30_000,
  })

  if (requesting) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-ink2 font-bold">Localisation en cours...</p>
      </div>
    )
  }

  if (geoError) {
    return (
      <Card variant="glow" className="text-center py-10">
        <Navigation className="h-12 w-12 text-rose-light mx-auto mb-3" strokeWidth={2} />
        <p className="text-ink font-bold">{geoError}</p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 skeleton rounded-3xl" />
        ))}
      </div>
    )
  }

  if (stops.length === 0) {
    return <p className="text-ink2 text-center py-8 font-bold">Aucun arrêt à proximité</p>
  }

  return (
    <div className="space-y-3 animate-fade-up">
      {stops.map((stop) => (
        <StopItem key={stop.stop_id} stop={stop} />
      ))}
    </div>
  )
}

function StopSearchTab({ query }: { query: string }) {
  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['stops-search', query],
    queryFn: () => api.searchStops(query),
    enabled: query.length >= 1,
    staleTime: 5_000,
  })

  if (query.length === 0) {
    return <EmptyHint text="Tape le nom d'un arrêt pour commencer" />
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 skeleton rounded-3xl" />
        ))}
      </div>
    )
  }

  if (stops.length === 0) {
    return <p className="text-ink2 text-center py-8 font-bold">Aucun résultat</p>
  }

  return (
    <div className="space-y-3 animate-fade-up">
      {stops.map((stop) => (
        <StopItem key={stop.stop_id} stop={stop} headsigns={stop.headsigns} />
      ))}
    </div>
  )
}

function LineSearchTab({ query }: { query: string }) {
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes-search', query],
    queryFn: () => api.searchRoutes(query),
    enabled: query.length >= 1,
    staleTime: 5_000,
  })

  if (query.length === 0) {
    return <EmptyHint text="Tape un numéro de ligne (ex: 42)" />
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 skeleton rounded-3xl" />
        ))}
      </div>
    )
  }

  if (routes.length === 0) {
    return <p className="text-ink2 text-center py-8 font-bold">Aucune ligne trouvée</p>
  }

  return (
    <div className="space-y-3 animate-fade-up">
      {routes.map((route) => (
        <LineCard key={route.route_id} route={route} />
      ))}
    </div>
  )
}

function StopItem({ stop, headsigns }: { stop: GtfsStop | StopWithHeadsigns; headsigns?: string[] }) {
  const [expanded, setExpanded] = useState(false)

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['stop-routes', stop.stop_id],
    queryFn: () => api.stopRoutes(stop.stop_id),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <Card variant="glass" className="!p-0 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 pressable text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-btn-primary text-white shadow-glow-sm shrink-0">
            <MapPin className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink truncate">{stop.stop_name}</p>
            {headsigns && headsigns.length > 0 && (
              <p className="text-xs text-ink3 font-medium truncate">→ {headsigns.join(', ')}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-ink3">
          {expanded ? <ChevronUp className="h-5 w-5" strokeWidth={2.5} /> : <ChevronDown className="h-5 w-5" strokeWidth={2.5} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-line bg-white/[0.03] px-3 py-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : routes.length === 0 ? (
            <p className="text-center text-ink3 font-bold py-3 text-sm">Aucune ligne</p>
          ) : (
            <div className="space-y-2">
              {routes.map((r) => (
                <ToggleFavRow
                  key={`${r.route_id}:${r.direction_id}`}
                  stopId={stop.stop_id}
                  stopName={stop.stop_name}
                  routeId={r.route_id}
                  routeShortName={r.route_short_name}
                  headsign={r.headsign || r.route_long_name}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function LineCard({ route }: { route: { route_id: string; route_short_name: string; route_long_name: string } }) {
  const [expanded, setExpanded] = useState(false)

  const { data: directions = [], isLoading } = useQuery({
    queryKey: ['route-stops', route.route_id],
    queryFn: () => api.routeStops(route.route_id),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <Card variant="glass" className="!p-0 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 pressable text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Pill variant="primary" size="lg" className="shrink-0 !min-w-[3.5rem] !h-10 !text-sm">
            {route.route_short_name}
          </Pill>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink truncate">{route.route_long_name}</p>
            <p className="text-xs text-ink3 font-medium">Ligne TEC</p>
          </div>
        </div>
        <div className="shrink-0 text-ink3">
          {expanded ? <ChevronUp className="h-5 w-5" strokeWidth={2.5} /> : <ChevronDown className="h-5 w-5" strokeWidth={2.5} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-line bg-white/[0.03] px-3 py-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : directions.length === 0 ? (
            <p className="text-center text-ink3 font-bold py-3 text-sm">Pas d'arrêts</p>
          ) : (
            <div className="space-y-3">
              {directions.map((dir) => (
                <div key={dir.directionId}>
                  <p className="text-xs font-extrabold text-cyan-light uppercase mb-1.5 px-1 tracking-wider">
                    → {dir.headsign}
                  </p>
                  <div className="space-y-1">
                    {dir.stops.map((s) => (
                      <ToggleFavRow
                        key={`${dir.directionId}:${s.stop_id}`}
                        stopId={s.stop_id}
                        stopName={s.stop_name}
                        routeId={route.route_id}
                        routeShortName={route.route_short_name}
                        headsign={dir.headsign}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ToggleFavRow({
  stopId,
  stopName,
  routeId,
  routeShortName,
  headsign,
}: {
  stopId: string
  stopName: string
  routeId: string
  routeShortName: string
  headsign: string
}) {
  const { addFavorite, removeFavorite } = useFavoritesActions()
  const isFav = useFavoritesStore((s) => s.isFavorite(stopId, routeId))

  const handleToggle = () => {
    if (isFav) {
      removeFavorite(stopId, routeId)
    } else {
      addFavorite({
        stopId,
        routeId,
        userId: null,
        label: `${routeShortName} · ${stopName}`,
      })
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'w-full flex items-center gap-3 rounded-2xl p-2.5 pressable text-left transition-all',
        isFav ? 'glass-strong shadow-glow-lime' : 'glass hover:shadow-glow-sm'
      )}
    >
      <Pill variant={isFav ? 'lime' : 'primary'} size="md" className="shrink-0 !min-w-[2.75rem] !h-9">
        {routeShortName}
      </Pill>
      <span className="text-sm text-ink truncate flex-1 min-w-0 font-semibold">{headsign}</span>
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border transition-all',
          isFav ? 'bg-btn-lime text-bg-deep border-lime shadow-glow-lime' : 'border-line text-ink3'
        )}
      >
        {isFav ? '✓' : '+'}
      </div>
    </button>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 animate-fade-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-btn-cyan shadow-glow-cyan">
        <Search className="h-8 w-8 text-white" strokeWidth={2.5} />
      </div>
      <p className="text-ink2 font-bold text-center px-4">{text}</p>
    </div>
  )
}
