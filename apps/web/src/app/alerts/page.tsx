'use client'

import { Bell } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { GradientText } from '@/components/ui/GradientText'

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <GradientText as="h1" className="text-3xl font-extrabold tracking-tight block animate-fade-up">
        Alertes
      </GradientText>
      <Card variant="glow" className="text-center py-12 animate-fade-up">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-btn-rose shadow-glow-magenta">
          <Bell className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>
        <p className="text-ink2 font-bold">Alertes bientôt disponibles</p>
      </Card>
    </div>
  )
}
