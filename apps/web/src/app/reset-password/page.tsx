'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, ArrowRight } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { GradientText } from '@/components/ui/GradientText'
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
      <div className="w-full max-w-md space-y-5 animate-fade-up">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-btn-primary shadow-glow animate-pulse-glow">
            <Lock className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
          <GradientText as="h1" className="text-3xl font-extrabold tracking-tight block">
            Nouveau mot de passe
          </GradientText>
          <p className="text-ink2 font-medium mt-1">Choisis un mot de passe sécurisé</p>
        </div>

        <Card variant="glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            {banner && (
              <div
                className={cn(
                  'rounded-2xl glass-strong p-3 text-sm font-bold text-center',
                  banner.type === 'error' ? 'text-rose-light' : 'text-lime-light'
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
              className="w-full h-14 rounded-2xl glass px-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:shadow-glow"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmer"
              autoComplete="new-password"
              className="w-full h-14 rounded-2xl glass px-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:shadow-glow"
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
