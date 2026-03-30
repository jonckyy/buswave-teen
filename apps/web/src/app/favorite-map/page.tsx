'use client'

import { Suspense, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { MapPin, ArrowLeft, Loader2, Map } from 'lucide-react'
import { api } from '@/lib/api'
import { useCountdown, formatCountdown } from '@/hooks/useCountdown'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { cn, delayColor, formatDelay } from '@/lib/utils'
import { getTileUrl, isTileDark } from '@buswave/shared'
import type { StopArrival, VehiclePosition } from '@buswave/shared'

const FavoriteMapView = dynamic(() => import('./FavoriteMapView'), { ssr: false })

export default function FavoriteMapPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted" /></div>}>
      <FavoriteMapInner />
    </Suspense>
  )
}

function formatClockTime(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function FavoriteMapInner() {
  const searchParams = useSearchParams()
  const stopId = searchParams.get('stopId') ?? ''
  const routeId = searchParams.get('routeId') ?? undefined
  const flags = useFeatureFlags()

  const { data: stopData } = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => api.stopInfo(stopId),
    staleTime: 60_000,
    enabled: !!stopId,
  })

  const { data: arrivals = [] } = useQuery({
    queryKey: ['arrivals', stopId, routeId],
    queryFn: () => api.arrivals(stopId, routeId),
    refetchInterval: 10_000,
    enabled: !!stopId,
  })

  const { data: routeLive } = useQuery({
    queryKey: ['route-live', routeId],
    queryFn: () => api.routeLive(routeId!),
    refetchInterval: 15_000,
    enabled: !!routeId,
  })

  const { data: allVehicles = [] } = useQuery({
    queryKey: ['all-vehicles'],
    queryFn: () => api.allVehicles(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  // Find the next bus by matching tripId from first arrival
  const nextBus = useMemo<VehiclePosition | null>(() => {
    const firstTripId = arrivals[0]?.tripId
    if (!firstTripId) return null
    const vehicles = routeLive?.vehicles ?? allVehicles
    return vehicles.find((v) => v.tripId === firstTripId) ?? null
  }, [arrivals, routeLive?.vehicles, allVehicles])

  const next3 = arrivals.slice(0, flags.arrivalsPerCard)
  const mapHref = `/map?stopId=${stopId}${routeId ? `&routeId=${routeId}` : ''}`

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Map */}
      <div className="flex-1 relative">
        <FavoriteMapView
          stop={stopData ?? null}
          nextBus={nextBus}
          routeLive={routeLive ?? null}
          tileStyle={flags.mapTileStyle}
        />
      </div>

      {/* Bottom panel */}
      <div className="border-t border-border bg-card p-4 space-y-3 max-h-[45vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-accent-cyan shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-white leading-tight truncate">
                {stopData?.stop_name ?? stopId}
              </p>
              {next3[0]?.headsign && (
                <p className="text-xs text-muted">→ {next3[0].headsign}</p>
              )}
            </div>
          </div>
          <Link
            href={mapHref}
            className="flex items-center gap-1.5 text-xs text-accent-cyan hover:underline shrink-0"
          >
            <Map className="h-3.5 w-3.5" /> Carte complète
          </Link>
        </div>

        {/* Arrivals */}
        {next3.length > 0 ? (
          <div>
            {next3.map((a) => (
              <ArrivalRow key={`${a.tripId}-${a.stopSequence}`} arrival={a} showDelayBadges={flags.showDelayBadges} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-2">Aucun passage prévu</p>
        )}

        {/* Back link */}
        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour aux favoris
        </Link>
      </div>
    </div>
  )
}

function ArrivalRow({ arrival, showDelayBadges = true }: { arrival: StopArrival; showDelayBadges?: boolean }) {
  const countdown = useCountdown(arrival.predictedArrivalUnix)
  const color = delayColor(arrival.delaySeconds)

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0 min-w-0">
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        <span className="shrink-0 min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-sm font-bold text-accent-cyan">
          {arrival.routeShortName}
        </span>
        <span className="text-sm text-white truncate">{arrival.headsign}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showDelayBadges && Math.abs(arrival.delaySeconds) > 30 && (
          <span className={cn('flex items-center gap-1 text-xs', color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot')} />
            {formatDelay(arrival.delaySeconds)}
          </span>
        )}
        <span className="text-xs text-muted tabular-nums">
          {formatClockTime(arrival.predictedArrivalUnix)}
        </span>
        <span className="text-sm font-semibold text-white tabular-nums">
          {formatCountdown(countdown)}
        </span>
      </div>
    </div>
  )
}
