'use client'

import { Bell } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-ink">Alertes</h1>
      <Card variant="pop">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Bell className="h-12 w-12 text-coral-400 mx-auto mb-3" strokeWidth={2} />
            <p className="text-ink2 font-bold">Alertes bientôt disponibles</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
