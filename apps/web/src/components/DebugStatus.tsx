'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function DebugStatus() {
  const { data: health, isLoading: loadingHealth, isError: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
    retry: 1,
  })

  const { data: vehicles, isLoading: loadingVehicles, isError: vehiclesError } = useQuery({
    queryKey: ['all-vehicles-debug'],
    queryFn: api.allVehicles,
    refetchInterval: 15_000,
    retry: 1,
  })

  const apiOnline = !healthError && health?.ok === true
  const gtfsOk = !vehiclesError && vehicles !== undefined

  return (
    <div className="mb-6 rounded-lg border border-white/10 bg-background px-4 py-3 font-mono text-xs">
      <p className="text-muted mb-2 uppercase tracking-widest text-[10px]">System status</p>
      <div className="space-y-1">
        <StatusRow
          label="Railway API"
          loading={loadingHealth}
          ok={apiOnline}
          value={health ? `commit ${health.commit}` : undefined}
        />
        <StatusRow
          label="GTFS-RT feed"
          loading={loadingVehicles}
          ok={gtfsOk}
        />
        <StatusRow
          label="Live buses"
          loading={loadingVehicles}
          ok={gtfsOk}
          value={vehicles ? String(vehicles.length) : undefined}
          href="/live"
        />
      </div>
    </div>
  )
}

function StatusRow({
  label,
  loading,
  ok,
  value,
  href,
}: {
  label: string
  loading: boolean
  ok: boolean
  value?: string
  href?: string
}) {
  const dot = loading ? '…' : ok ? '●' : '●'
  const dotColor = loading ? 'text-muted' : ok ? 'text-on-time' : 'text-large-delay'
  const status = loading ? 'checking' : ok ? 'ok' : 'error'

  const valueEl = value !== undefined && (
    href
      ? <Link href={href} className="text-accent-cyan ml-1 hover:underline">{value}</Link>
      : <span className="text-accent-cyan ml-1">{value}</span>
  )

  return (
    <div className="flex items-center gap-2">
      <span className={`${dotColor} text-[10px]`}>{dot}</span>
      <span className="text-muted w-28">{label}</span>
      <span className={ok && !loading ? 'text-white/70' : 'text-muted'}>{status}</span>
      {valueEl}
    </div>
  )
}
