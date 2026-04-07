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
import { Card } from '@/components/ui/Card'
import { GradientText } from '@/components/ui/GradientText'
import type { VehiclePosition } from '@buswave/shared'

const FavoriteMapView = dynamic(() => import('./FavoriteMapView').then((m) => m.FavoriteMapView), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-3xl glass shadow-glass animate-pulse flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
})

export default function FavoriteMapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

function delayColorClass(sec: number): string {
  const abs = Math.abs(sec)
  if (abs <= 60) return 'text-lime-light'
  if (sec > 300) return 'text-rose-light'
  if (sec > 0) return 'text-orange'
  return 'text-cyan-light'
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
      {/* Back */}
      <Link href="/" className="inline-block">
        <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="h-4 w-4" strokeWidth={2.5} />}>
          Retour
        </Button>
      </Link>

      {/* Hero card */}
      <Card variant="glow" className="!p-5 shadow-glow animate-fade-up">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-btn-primary text-white shadow-glow shrink-0">
            <MapPin className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <GradientText as="h1" className="text-xl font-extrabold leading-tight block truncate">
              {stopData?.stop_name ?? stopId}
            </GradientText>
            {nextArrival && (
              <p className="text-sm text-ink3 font-medium truncate">
                Ligne {nextArrival.routeShortName} → {nextArrival.headsign}
              </p>
            )}
          </div>
        </div>

        {nextArrival && (
          <div className="rounded-2xl glass p-4">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span
                className={cn(
                  'text-5xl font-extrabold tabular-nums tracking-tight',
                  delayColorClass(nextArrival.delaySeconds)
                )}
              >
                {formatClockTime(nextArrival.predictedArrivalUnix)}
              </span>
              {Math.abs(nextArrival.delaySeconds) > 60 && (
                <Pill
                  variant={nextArrival.delaySeconds > 300 ? 'rose' : 'magenta'}
                  size="md"
                >
                  {nextArrival.delaySeconds > 0 ? '+' : ''}
                  {Math.round(nextArrival.delaySeconds / 60)} min
                </Pill>
              )}
            </div>
            <p className="text-base font-bold text-ink2 mt-1">{formatRemaining(countdown)}</p>
          </div>
        )}
      </Card>

      {/* Map */}
      {stopData && (
        <div className="animate-fade-up">
          <FavoriteMapView
            stopLat={stopData.stop_lat}
            stopLon={stopData.stop_lon}
            stopName={stopData.stop_name}
            bus={nextBus}
            shapePoints={shapePoints}
          />
        </div>
      )}

      {/* Upcoming */}
      {arrivals.length > 1 && (
        <Card variant="glass" className="animate-fade-up">
          <h3 className="text-xs font-extrabold text-cyan-light uppercase mb-2 tracking-wider">
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
                    <span className={cn('text-xs font-bold', delayColorClass(a.delaySeconds))}>
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
        </Card>
      )}
    </div>
  )
}
