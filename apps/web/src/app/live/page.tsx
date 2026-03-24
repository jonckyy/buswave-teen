'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Bus } from 'lucide-react'
import { api } from '@/lib/api'

export default function LivePage() {
  const { data: vehicles = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['all-vehicles-live'],
    queryFn: () => api.allVehicles(),
    refetchInterval: 10_000,
  })

  // Group vehicles by routeId, sorted by number of buses desc
  const lines = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const v of vehicles) {
      const arr = map.get(v.routeId) ?? []
      arr.push(v.vehicleId)
      map.set(v.routeId, arr)
    }
    return [...map.entries()]
      .map(([routeId, busIds]) => ({ routeId, busIds }))
      .sort((a, b) => b.busIds.length - a.busIds.length || a.routeId.localeCompare(b.routeId, undefined, { numeric: true }))
  }, [vehicles])

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-muted hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Bus actifs en temps réel</h1>
          {updatedAt && <p className="text-xs text-muted mt-0.5">MàJ {updatedAt}</p>}
        </div>
        <span className="ml-auto rounded-full bg-accent-cyan/10 px-3 py-1 text-sm font-bold text-accent-cyan">
          {vehicles.length} bus
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <p className="text-muted text-center py-16">Aucun bus actif en ce moment</p>
      ) : (
        <div className="space-y-2">
          {lines.map(({ routeId, busIds }) => (
            <Link
              key={routeId}
              href={`/map?routeId=${encodeURIComponent(routeId)}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 hover:border-accent-cyan/40 transition-colors"
            >
              <span className="min-w-[3rem] rounded bg-accent-cyan/10 px-2 py-1 text-center text-sm font-bold text-accent-cyan shrink-0">
                {routeId}
              </span>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {busIds.map((id) => (
                  <span key={id} className="flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-xs text-muted">
                    <Bus className="h-3 w-3" />
                    {id}
                  </span>
                ))}
              </div>
              <span className="ml-auto text-xs text-muted shrink-0">{busIds.length} bus</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
