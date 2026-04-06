'use client'

import { useUser } from '@/hooks/useUser'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LogOut, User } from 'lucide-react'

export default function SettingsPage() {
  const { user, signOut } = useUser()

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-ink">Mon compte</h1>
      <Card variant="pop">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-600 text-white shadow-pop shrink-0">
            <User className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-ink truncate">{user?.email ?? 'Invité'}</p>
            <p className="text-sm text-ink2 font-medium">Compte BusWave</p>
          </div>
        </div>
        {user && (
          <Button
            variant="danger"
            size="lg"
            iconLeft={<LogOut className="h-5 w-5" strokeWidth={2.5} />}
            onClick={signOut}
            className="w-full"
          >
            Se déconnecter
          </Button>
        )}
      </Card>
    </div>
  )
}
