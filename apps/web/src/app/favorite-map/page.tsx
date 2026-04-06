'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import { useCountdown } from '@/hooks/useCountdown'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import type { VehiclePosition } from '@buswave/shared'

const FavoriteMapView = dynamic(() => import('./FavoriteMapView').then((m) => m.FavoriteMapView), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-3xl border-2 border-line bg-primary-50 animate-pulse flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
    </div>
  ),
})

export default function FavoriteMapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <FavoriteMapInner />
    </Suspense>
  )
}

function formatClockTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('fr-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRemaining(sec: number): string {
  if (sec <= 0) return 'maintenant'
  const m = Math.round(sec / 60)
  if (m < 1) return 'dans < 1 min'
  if (m < 60) return `dans ${m} min`
  const h = Math.floor(m / 60)
  return `dans ${h}h ${m % 60}min`
}

function delayColor(sec: number): string {
  const abs = Math.abs(sec)
  if (abs <= 60) return 'text-lime-600'
  if (sec > 300) return 'text-rose-600'
  if (sec > 0) return 'text-coral-500'
  return 'text-secondary-600'
}

function FavoriteMapInner() {
  const searchParams = useSearchParams()
  const stopId = searchParams.get('stopId') ?? ''
  const routeId = searchParams.get('routeId') ?? undefined

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
    enabled: !routeId,
  })

  const nextArrival = arrivals[0]
  const countdown = useCountdown(nextArrival?.predictedArrivalUnix ?? 0)

  // Find the bus serving the next arrival
  const nextBus = useMemo<VehiclePosition | null>(() => {
    const firstTripId = arrivals[0]?.tripId
    if (!firstTripId) return null
    const vehicles = routeLive?.vehicles ?? allVehicles
    return vehicles.find((v) => v.tripId === firstTripId) ?? null
  }, [arrivals, routeLive?.vehicles, allVehicles])

  const shapePoints = useMemo(() => {
    if (!routeLive?.shapeSegments) return []
    return routeLive.shapeSegments.flat()
  }, [routeLive])

  if (!stopId) {
    return (
      <div className="space-y-4">
        <Link href="/">
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="h-4 w-4" strokeWidth={2.5} />}>
            Retour
          </Button>
        </Link>
        <p className="text-ink2 font-bold text-center py-10">Arrêt introuvable</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Link href="/">
        <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="h-4 w-4" strokeWidth={2.5} />}>
          Retour
        </Button>
      </Link>

      {/* Stop header card */}
      <div className="rounded-3xl bg-primary-600 text-white p-5 shadow-pop">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 shrink-0">
            <MapPin className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold truncate">{stopData?.stop_name ?? stopId}</h1>
            {nextArrival && (
              <p className="text-sm text-white/80 font-medium truncate">
                Ligne {nextArrival.routeShortName} → {nextArrival.headsign}
              </p>
            )}
          </div>
        </div>

        {nextArrival && (
          <div className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-5xl font-extrabold tabular-nums text-white">
                {formatClockTime(nextArrival.predictedArrivalUnix)}
              </span>
              {Math.abs(nextArrival.delaySeconds) > 60 && (
                <Pill
                  variant={nextArrival.delaySeconds > 300 ? 'rose' : 'coral'}
                  size="md"
                >
                  {nextArrival.delaySeconds > 0 ? '+' : ''}
                  {Math.round(nextArrival.delaySeconds / 60)} min
                </Pill>
              )}
            </div>
            <p className="text-lg font-bold text-white/90 mt-1">{formatRemaining(countdown)}</p>
          </div>
        )}
      </div>

      {/* Map */}
      {stopData && (
        <FavoriteMapView
          stopLat={stopData.stop_lat}
          stopLon={stopData.stop_lon}
          stopName={stopData.stop_name}
          bus={nextBus}
          shapePoints={shapePoints}
        />
      )}

      {/* Upcoming */}
      {arrivals.length > 1 && (
        <div className="rounded-3xl border-2 border-line bg-surface p-4 shadow-card">
          <h3 className="text-xs font-extrabold text-primary-700 uppercase mb-2 tracking-wider">
            Prochains passages
          </h3>
          <div className="space-y-2">
            {arrivals.slice(1, 4).map((a) => (
              <div
                key={`${a.tripId}-${a.stopSequence}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-ink2 font-semibold text-sm truncate">→ {a.headsign}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {Math.abs(a.delaySeconds) > 60 && (
                    <span className={cn('text-xs font-bold', delayColor(a.delaySeconds))}>
                      {a.delaySeconds > 0 ? '+' : ''}
                      {Math.round(a.delaySeconds / 60)}m
                    </span>
                  )}
                  <span className="text-base font-extrabold text-ink tabular-nums">
                    {formatClockTime(a.predictedArrivalUnix)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
