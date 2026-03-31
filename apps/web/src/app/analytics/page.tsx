'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, BarChart3, Table2, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import { useUser } from '@/hooks/useUser'
import { createSupabaseClient } from '@/lib/supabase'

const TARGET_LINES = ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '50', '366']
const VEHICLE_COLORS = ['#00D4FF', '#FF9100', '#00E676', '#A78BFA', '#FF3D71', '#FFD600', '#18FFFF', '#FF80AB', '#B388FF', '#69F0AE']

interface PositionRow {
  id: number
  vehicle_id: string
  route_short: string
  trip_id: string
  direction_id: number | null
  lat: number
  lon: number
  speed: number | null
  bearing: number | null
  delay_seconds: number | null
  stop_id: string | null
  stop_sequence: number | null
  vehicle_timestamp: number | null
  recorded_at: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDelay(seconds: number): string {
  const abs = Math.abs(seconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  const sign = seconds >= 0 ? '+' : '-'
  return m > 0 ? `${sign}${m}m${s.toString().padStart(2, '0')}s` : `${sign}${s}s`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AnalyticsPage() {
  const { user, isAdmin, loading: authLoading } = useUser()
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseClient(), [])

  // Filters
  const [line, setLine] = useState('38')
  const [date, setDate] = useState(todayStr())
  const [timeFrom, setTimeFrom] = useState('07:00')
  const [timeTo, setTimeTo] = useState('09:00')
  const [vehicleFilter, setVehicleFilter] = useState('')

  // Data
  const [data, setData] = useState<PositionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sort
  const [sortCol, setSortCol] = useState<keyof PositionRow>('recorded_at')
  const [sortAsc, setSortAsc] = useState(true)

  const getToken = useCallback(async (): Promise<string> => {
    const { data: { user: u }, error: e } = await supabase.auth.getUser()
    if (e || !u) throw new Error('Not authenticated')
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }, [supabase])

  async function handleFetch() {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const from = `${date}T${timeFrom}:00`
      const to = `${date}T${timeTo}:00`
      const result = await api.getAnalytics(
        { route_short: line, from, to, vehicle_id: vehicleFilter || undefined },
        token
      )
      setData(result as unknown as PositionRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // Sorted data for table
  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return sorted
  }, [data, sortCol, sortAsc])

  function handleSort(col: keyof PositionRow) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  // Chart data: group by vehicle_id, X=time, Y=delay
  const uniqueVehicles = useMemo(() => [...new Set(data.map((d) => d.vehicle_id))].sort(), [data])

  const delayChartData = useMemo(() => {
    // Build time series: one entry per unique recorded_at, with delay per vehicle
    const timeMap = new Map<string, Record<string, unknown>>()
    for (const row of data) {
      const t = formatTime(row.recorded_at)
      if (!timeMap.has(t)) timeMap.set(t, { time: t })
      const entry = timeMap.get(t)!
      entry[`delay_${row.vehicle_id}`] = row.delay_seconds
    }
    return [...timeMap.values()]
  }, [data])

  const speedChartData = useMemo(() => {
    const timeMap = new Map<string, Record<string, unknown>>()
    for (const row of data) {
      if (row.speed == null) continue
      const t = formatTime(row.recorded_at)
      if (!timeMap.has(t)) timeMap.set(t, { time: t })
      const entry = timeMap.get(t)!
      entry[`speed_${row.vehicle_id}`] = row.speed
    }
    return [...timeMap.values()]
  }, [data])

  // CSV export
  function exportCSV() {
    const headers = ['recorded_at', 'vehicle_id', 'route_short', 'direction_id', 'lat', 'lon', 'speed', 'bearing', 'delay_seconds', 'stop_id', 'stop_sequence']
    const csv = [headers.join(','), ...data.map((r) => headers.map((h) => r[h as keyof PositionRow] ?? '').join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics_${line}_${date}_${timeFrom}-${timeTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Auth guard
  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted" /></div>
  if (!user || !isAdmin) { router.push('/'); return null }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-accent-cyan" />
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/10 bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Ligne</label>
            <select
              value={line}
              onChange={(e) => setLine(e.target.value)}
              className="appearance-none bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              {TARGET_LINES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">De</label>
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">À</label>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Bus ID (optionnel)</label>
            <input
              type="text"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              placeholder="ex: 7807"
              className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted w-28"
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Charger
          </button>
          {data.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        {data.length > 0 && <p className="text-xs text-muted mt-2">{data.length} enregistrements</p>}
      </div>

      {/* Delay chart */}
      {delayChartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent-cyan" /> Évolution des retards
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={delayChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#8892B0' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#8892B0' }} label={{ value: 'Retard (s)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#8892B0' } }} />
              <Tooltip
                contentStyle={{ background: '#131A2B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fff' }}
                formatter={(value) => [`${formatDelay(Number(value))}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {uniqueVehicles.map((vid, i) => (
                <Line
                  key={vid}
                  type="monotone"
                  dataKey={`delay_${vid}`}
                  name={`Bus ${vid}`}
                  stroke={VEHICLE_COLORS[i % VEHICLE_COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Speed chart */}
      {speedChartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-on-time" /> Vitesse
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={speedChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#8892B0' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#8892B0' }} label={{ value: 'km/h', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#8892B0' } }} />
              <Tooltip
                contentStyle={{ background: '#131A2B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {uniqueVehicles.map((vid, i) => (
                <Line
                  key={vid}
                  type="monotone"
                  dataKey={`speed_${vid}`}
                  name={`Bus ${vid}`}
                  stroke={VEHICLE_COLORS[i % VEHICLE_COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data table */}
      {data.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-card p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Table2 className="h-4 w-4 text-accent-cyan" /> Données brutes
          </h2>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-white/10 text-left text-muted">
                  {([
                    ['recorded_at', 'Heure'],
                    ['vehicle_id', 'Bus'],
                    ['direction_id', 'Dir'],
                    ['delay_seconds', 'Retard'],
                    ['speed', 'Vitesse'],
                    ['bearing', 'Cap'],
                    ['lat', 'Lat'],
                    ['lon', 'Lon'],
                    ['stop_id', 'Arrêt'],
                    ['stop_sequence', 'Seq'],
                  ] as [keyof PositionRow, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      className="pb-2 pr-3 cursor-pointer hover:text-white whitespace-nowrap"
                      onClick={() => handleSort(col)}
                    >
                      {label} {sortCol === col ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.slice(0, 2000).map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-1.5 pr-3 text-white whitespace-nowrap">{formatTime(row.recorded_at)}</td>
                    <td className="py-1.5 pr-3 text-accent-cyan font-mono">{row.vehicle_id}</td>
                    <td className="py-1.5 pr-3">{row.direction_id ?? '—'}</td>
                    <td className={`py-1.5 pr-3 font-mono ${row.delay_seconds && row.delay_seconds > 60 ? 'text-slight-delay' : row.delay_seconds && row.delay_seconds < -60 ? 'text-on-time' : 'text-white'}`}>
                      {row.delay_seconds != null ? formatDelay(row.delay_seconds) : '—'}
                    </td>
                    <td className="py-1.5 pr-3">{row.speed ?? '—'}</td>
                    <td className="py-1.5 pr-3">{row.bearing ?? '—'}</td>
                    <td className="py-1.5 pr-3 font-mono">{row.lat.toFixed(4)}</td>
                    <td className="py-1.5 pr-3 font-mono">{row.lon.toFixed(4)}</td>
                    <td className="py-1.5 pr-3 text-muted">{row.stop_id ?? '—'}</td>
                    <td className="py-1.5 pr-3">{row.stop_sequence ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedData.length > 2000 && (
              <p className="text-xs text-muted text-center py-2">Affichage limité à 2000 lignes. Exportez en CSV pour voir tout.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
