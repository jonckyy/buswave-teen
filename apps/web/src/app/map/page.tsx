'use client'

import { Map } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export default function MapPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-ink">Carte</h1>
      <Card variant="pop">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Map className="h-12 w-12 text-secondary-500 mx-auto mb-3" strokeWidth={2} />
            <p className="text-ink2 font-bold">Carte bientôt disponible</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
