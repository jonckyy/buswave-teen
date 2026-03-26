'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bus, Navigation, Gauge } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

type Tab = 'bus' | 'lignes'

export default function LivePage() {
  const flags = useFeatureFlags()
  const router = useRouter()

  if (!flags.loading && !flags.showLivePage) {
    router.replace('/')
    return null
  }
  const [tab, setTab] = useState<Tab>('lignes')

  const { data: vehicles = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['all-vehicles-live'],
    queryFn: () => api.allVehicles(),
    refetchInterval: 10_000,
  })

  // Tab 1 — individual buses sorted by routeId then vehicleId
  const sortedVehicles = useMemo(() =>
    [...vehicles].sort((a, b) =>
      a.routeId.localeCompare(b.routeId, undefined, { numeric: true }) ||
      a.vehicleId.localeCompare(b.vehicleId, undefined, { numeric: true })
    ), [vehicles])

  // Tab 2 — lines grouped by routeId, sorted by bus count desc
  const lines = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of vehicles) map.set(v.routeId, (map.get(v.routeId) ?? 0) + 1)
    return [...map.entries()]
      .map(([routeId, count]) => ({ routeId, count }))
      .sort((a, b) => b.count - a.count || a.routeId.localeCompare(b.routeId, undefined, { numeric: true }))
  }, [vehicles])

  const activeRouteIds = useMemo(() => lines.map((l) => l.routeId), [lines])

  const { data: routeNames = [] } = useQuery({
    queryKey: ['route-names-live', activeRouteIds.join(',')],
    queryFn: () => api.routeNames(activeRouteIds),
    enabled: activeRouteIds.length > 0,
    staleTime: 60_000,
  })

  const nameMap = useMemo(() => {
    const m = new Map<string, { short: string; long: string }>()
    for (const r of routeNames) m.set(r.route_id, { short: r.route_short_name, long: r.route_long_name })
    return m
  }, [routeNames])

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-muted hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">En temps réel</h1>
          {updatedAt && <p className="text-xs text-muted mt-0.5">MàJ {updatedAt}</p>}
        </div>
        <span className="ml-auto rounded-full bg-accent-cyan/10 px-3 py-1 text-sm font-bold text-accent-cyan shrink-0">
          {vehicles.length} bus · {lines.length} lignes
        </span>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border bg-card p-1 mb-4">
        {(['lignes', 'bus'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              tab === t ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-muted hover:text-white'
            )}
          >
            {t === 'lignes' ? `Lignes actives (${lines.length})` : `Bus actifs (${vehicles.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : tab === 'lignes' ? (
        <div className="space-y-2">
          {lines.map(({ routeId, count }) => {
            const name = nameMap.get(routeId)
            return (
              <Link
                key={routeId}
                href={`/map?routeId=${encodeURIComponent(routeId)}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-accent-cyan/40 transition-colors"
              >
                <span className="min-w-[3rem] rounded bg-accent-cyan/10 px-2 py-1 text-center text-sm font-bold text-accent-cyan shrink-0">
                  {name?.short ?? routeId}
                </span>
                <span className="text-sm text-white truncate flex-1 min-w-0">
                  {name?.long ?? ''}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
                    <Bus key={i} className="h-3 w-3 text-accent-cyan/60" />
                  ))}
                  {count > 6 && <span className="text-xs text-muted">+{count - 6}</span>}
                  <span className="text-sm font-semibold text-white ml-1">{count}</span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedVehicles.map((v) => {
            const name = nameMap.get(v.routeId)
            return (
            <Link
              key={v.vehicleId}
              href={`/map?routeId=${encodeURIComponent(v.routeId)}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 hover:border-accent-cyan/40 transition-colors"
            >
              <span className="min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-xs font-bold text-accent-cyan shrink-0">
                {name?.short ?? v.routeId}
              </span>
              <span className="flex items-center gap-1.5 min-w-0 flex-1">
                <Bus className="h-3.5 w-3.5 text-muted shrink-0" />
                <span className="text-sm text-white">{v.vehicleId}</span>
                {name?.long && <span className="text-xs text-muted truncate">— {name.long}</span>}
              </span>
              <div className="ml-auto flex items-center gap-3 shrink-0">
                {v.speed != null && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Gauge className="h-3 w-3" />
                    {Math.round(v.speed * 3.6)} km/h
                  </span>
                )}
                {v.bearing != null && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Navigation className="h-3 w-3" style={{ transform: `rotate(${v.bearing}deg)` }} />
                  </span>
                )}
              </div>
            </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
