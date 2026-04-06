'use client'

import { User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function AuthPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-ink">Connexion</h1>
      <Card variant="pop">
        <div className="flex flex-col items-center justify-center py-6 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-600 text-white shadow-pop">
            <User className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <p className="text-ink2 font-bold text-center">Connexion bientôt disponible</p>
          <Button variant="primary" size="md" disabled>
            Se connecter
          </Button>
        </div>
      </Card>
    </div>
  )
}
