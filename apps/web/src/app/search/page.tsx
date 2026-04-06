'use client'

import { Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export default function SearchPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-ink">Trouver</h1>
      <Card variant="pop">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Search className="h-12 w-12 text-primary-400 mx-auto mb-3" strokeWidth={2} />
            <p className="text-ink2 font-bold">Recherche bientôt disponible</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
