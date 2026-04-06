'use client'

import Link from 'next/link'
import { ArrowLeft, Map } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function FavoriteMapPage() {
  return (
    <div className="space-y-4">
      <Link href="/">
        <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="h-4 w-4" strokeWidth={2.5} />}>
          Retour
        </Button>
      </Link>
      <Card variant="pop" className="text-center py-10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary-100 text-secondary-600">
          <Map className="h-8 w-8" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-extrabold text-ink mb-2">Carte live</h2>
        <p className="text-ink2 font-medium">
          Bientôt disponible — la carte affichera le bus en direct avec son trajet
        </p>
      </Card>
    </div>
  )
}
