'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { api } from '@/lib/api'

export function AlertsBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.alerts,
    refetchInterval: 60_000,
  })

  const visible = alerts.filter((a) => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-6">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 rounded-lg border border-slight-delay/30 bg-slight-delay/10 px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 text-slight-delay shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slight-delay">{alert.headerText}</p>
            {alert.descriptionText && alert.descriptionText !== alert.headerText && (
              <p className="text-xs text-muted mt-0.5">{alert.descriptionText}</p>
            )}
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
            className="text-muted hover:text-white transition-colors shrink-0"
            aria-label="Fermer l'alerte"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
