'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function DebugStatus() {
  const { data: health, isLoading: loadingHealth, isError: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
    retry: 1,
  })

  const { data: debug, isLoading: loadingVehicles, isError: vehiclesError } = useQuery({
    queryKey: ['debug-vehicles'],
    queryFn: api.debugVehicles,
    refetchInterval: 15_000,
    retry: 1,
  })

  const apiOnline = !healthError && health?.ok === true
  const gtfsOk = !vehiclesError && debug?.ok === true

  return (
    <div className="mb-6 rounded-lg border border-white/10 bg-[#0d1220] px-4 py-3 font-mono text-xs">
      <p className="text-[#8892B0] mb-2 uppercase tracking-widest text-[10px]">System status</p>
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
          value={debug ? undefined : undefined}
        />
        <StatusRow
          label="Live buses"
          loading={loadingVehicles}
          ok={gtfsOk}
          value={debug?.entityCount !== undefined ? String(debug.entityCount) : undefined}
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
}: {
  label: string
  loading: boolean
  ok: boolean
  value?: string
}) {
  const dot = loading ? '…' : ok ? '●' : '●'
  const dotColor = loading ? 'text-[#8892B0]' : ok ? 'text-[#00E676]' : 'text-[#FF3D71]'
  const status = loading ? 'checking' : ok ? 'ok' : 'error'

  return (
    <div className="flex items-center gap-2">
      <span className={`${dotColor} text-[10px]`}>{dot}</span>
      <span className="text-[#8892B0] w-28">{label}</span>
      <span className={ok && !loading ? 'text-white/70' : 'text-[#8892B0]'}>{status}</span>
      {value !== undefined && (
        <span className="text-[#00D4FF] ml-1">{value}</span>
      )}
    </div>
  )
}
