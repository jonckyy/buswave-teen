'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, X } from 'lucide-react'

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
  const [input, setInput] = useState('')
  const [routeId, setRouteId] = useState<string | undefined>(undefined)

  function applyFilter() {
    setRouteId(input.trim() || undefined)
  }

  function clearFilter() {
    setInput('')
    setRouteId(undefined)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Carte en direct</h1>
      <p className="text-muted text-sm mb-4">
        {routeId ? `Ligne ${routeId} filtrée` : 'Tous les bus TEC actifs en Wallonie'}
      </p>

      {/* Optional route filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            placeholder="Filtrer par numéro de ligne (optionnel)"
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-white placeholder:text-muted focus:border-accent-cyan focus:outline-none"
          />
        </div>
        <button
          onClick={applyFilter}
          className="rounded-xl bg-accent-cyan/10 px-5 py-3 text-sm font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
        >
          Filtrer
        </button>
        {routeId && (
          <button
            onClick={clearFilter}
            className="rounded-xl border border-border bg-card px-4 py-3 text-muted hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <BusMap routeId={routeId} height={600} />
    </div>
  )
}
