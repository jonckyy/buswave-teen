'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, ArrowRight } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)

    if (password.length < 8) {
      setBanner({ type: 'error', message: 'Minimum 8 caractères' })
      return
    }
    if (password !== confirm) {
      setBanner({ type: 'error', message: 'Les mots de passe ne correspondent pas' })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setBanner({ type: 'error', message: error.message })
    } else {
      setBanner({ type: 'success', message: 'Mot de passe mis à jour !' })
      setTimeout(() => router.push('/'), 1500)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-600 text-white shadow-pop">
            <Lock className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold text-ink">Nouveau mot de passe</h1>
          <p className="text-ink2 font-medium mt-1">Choisis un mot de passe sécurisé</p>
        </div>

        <Card variant="pop">
          <form onSubmit={handleSubmit} className="space-y-4">
            {banner && (
              <div
                className={cn(
                  'rounded-2xl border-2 p-3 text-sm font-bold text-center',
                  banner.type === 'error'
                    ? 'bg-coral-50 border-coral-400 text-rose-600'
                    : 'bg-lime-50 border-lime-400 text-lime-600'
                )}
              >
                {banner.message}
              </div>
            )}

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              autoComplete="new-password"
              className="w-full h-14 rounded-2xl border-2 border-line bg-surface px-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmer"
              autoComplete="new-password"
              className="w-full h-14 rounded-2xl border-2 border-line bg-surface px-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
              iconRight={loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" strokeWidth={2.5} />}
            >
              Mettre à jour
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
