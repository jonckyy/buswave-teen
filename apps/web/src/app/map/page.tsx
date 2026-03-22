'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'

// Leaflet must be dynamically imported — no SSR
const BusMap = dynamic(() => import('@/components/map/BusMap').then((m) => m.BusMap), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border border-border bg-card"
      style={{ height: 480 }}
    >
      <p className="text-muted text-sm">Chargement de la carte…</p>
    </div>
  ),
})

export default function MapPage() {
  const [routeId, setRouteId] = useState('')
  const [activeRouteId, setActiveRouteId] = useState('')

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Carte en direct</h1>

      {/* Route selector */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setActiveRouteId(routeId)}
            placeholder="Numéro de ligne (ex: 15)"
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-white placeholder:text-muted focus:border-accent-cyan focus:outline-none"
          />
        </div>
        <button
          onClick={() => setActiveRouteId(routeId)}
          className="rounded-xl bg-accent-cyan/10 px-5 py-3 text-sm font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
        >
          Afficher
        </button>
      </div>

      {activeRouteId ? (
        <BusMap routeId={activeRouteId} />
      ) : (
        <div
          className="flex items-center justify-center rounded-xl border border-border bg-card"
          style={{ height: 480 }}
        >
          <p className="text-muted text-sm">Entrez un numéro de ligne pour afficher la carte</p>
        </div>
      )}
    </div>
  )
}
