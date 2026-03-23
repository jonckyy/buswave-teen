'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import type { Alert } from '@buswave/shared'

const TWO_HOURS = 2 * 60 * 60

function isRecent(alert: Alert): boolean {
  if (!alert.activePeriodStart) return true // no timestamp → keep
  const nowSec = Math.floor(Date.now() / 1000)
  return nowSec - alert.activePeriodStart <= TWO_HOURS
}

function formatTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('fr-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AlertsPage() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.alerts,
    refetchInterval: 60_000,
  })

  const recent = alerts.filter(isRecent)

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Alertes réseau</h1>

      {isLoading ? (
        <p className="text-muted text-sm">Chargement…</p>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-muted">Aucune alerte ces 2 dernières heures</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recent.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 rounded-lg border border-slight-delay/30 bg-slight-delay/10 px-4 py-3"
            >
              <AlertTriangle className="h-4 w-4 text-slight-delay shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slight-delay">{alert.headerText}</p>
                  {alert.activePeriodStart && (
                    <span className="text-xs text-muted shrink-0">{formatTime(alert.activePeriodStart)}</span>
                  )}
                </div>
                {alert.descriptionText && alert.descriptionText !== alert.headerText && (
                  <p className="text-xs text-muted mt-0.5">{alert.descriptionText}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
