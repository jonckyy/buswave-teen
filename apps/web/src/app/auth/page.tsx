'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type View = 'signin' | 'signup' | 'forgot'

function mapError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect'
  if (msg.includes('Email not confirmed')) return 'Vérifie ton email pour confirmer'
  if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet email'
  if (msg.includes('Password should be at least')) return 'Minimum 8 caractères'
  if (msg.includes('rate limit')) return 'Trop de tentatives, patiente un peu'
  return 'Une erreur est survenue'
}

export default function AuthPage() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)

    if (!email || (view !== 'forgot' && !password)) {
      setBanner({ type: 'error', message: 'Remplis tous les champs' })
      return
    }

    setLoading(true)
    try {
      if (view === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
      } else if (view === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        setBanner({ type: 'success', message: 'Vérifie ton email pour confirmer !' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        })
        if (error) throw error
        setBanner({ type: 'success', message: 'Lien envoyé ! Vérifie ton email' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      setBanner({ type: 'error', message: mapError(msg) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-600 text-white shadow-pop">
            <span className="text-4xl">🚌</span>
          </div>
          <h1 className="text-3xl font-extrabold text-ink">
            {view === 'signin' ? 'Re-bonjour !' : view === 'signup' ? 'Salut !' : 'Mot de passe oublié'}
          </h1>
          <p className="text-ink2 font-medium mt-1">
            {view === 'signin'
              ? 'Connecte-toi pour retrouver tes favoris'
              : view === 'signup'
                ? 'Crée un compte en 10 secondes'
                : 'Pas de stress, on va arranger ça'}
          </p>
        </div>

        {/* Form */}
        <Card variant="pop">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Banner */}
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

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-ink mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink3" strokeWidth={2.5} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@email.com"
                  autoComplete="email"
                  className="w-full h-14 rounded-2xl border-2 border-line bg-surface pl-12 pr-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                />
              </div>
            </div>

            {/* Password */}
            {view !== 'forgot' && (
              <div>
                <label className="block text-sm font-bold text-ink mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink3" strokeWidth={2.5} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                    className="w-full h-14 rounded-2xl border-2 border-line bg-surface pl-12 pr-12 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-ink2 hover:text-ink"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
              iconRight={loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" strokeWidth={2.5} />}
            >
              {view === 'signin' ? 'Se connecter' : view === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
            </Button>

            {/* Switch view */}
            <div className="text-center text-sm pt-1">
              {view === 'signin' && (
                <>
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-primary-600 font-bold hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                  <p className="text-ink2 font-medium mt-2">
                    Pas encore de compte ?{' '}
                    <button
                      type="button"
                      onClick={() => setView('signup')}
                      className="text-primary-600 font-extrabold hover:underline"
                    >
                      Inscris-toi
                    </button>
                  </p>
                </>
              )}
              {view === 'signup' && (
                <p className="text-ink2 font-medium">
                  Déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => setView('signin')}
                    className="text-primary-600 font-extrabold hover:underline"
                  >
                    Connecte-toi
                  </button>
                </p>
              )}
              {view === 'forgot' && (
                <button
                  type="button"
                  onClick={() => setView('signin')}
                  className="text-primary-600 font-bold hover:underline"
                >
                  ← Retour
                </button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
