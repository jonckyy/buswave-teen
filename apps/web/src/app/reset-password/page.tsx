'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bus, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase'

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: '', color: '', width: 'w-0' }
  if (password.length < 8) return { label: 'Trop court', color: 'bg-red-500', width: 'w-1/4' }
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length
  if (score <= 2) return { label: 'Faible', color: 'bg-yellow-500', width: 'w-2/4' }
  if (score === 3) return { label: 'Bon', color: 'bg-cyan-400', width: 'w-3/4' }
  return { label: 'Fort', color: 'bg-emerald-500', width: 'w-full' }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})

  const strength = getPasswordStrength(password)
  const supabase = createSupabaseClient()

  function validatePassword(val: string) {
    if (!val) return 'Mot de passe requis.'
    if (val.length < 8) return 'Minimum 8 caractères.'
    return ''
  }

  function validateConfirm(val: string) {
    if (!val) return 'Confirmation requise.'
    if (val !== password) return 'Les mots de passe ne correspondent pas.'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const passwordErr = validatePassword(password)
    const confirmErr = validateConfirm(confirm)
    setFieldErrors({ password: passwordErr, confirm: confirmErr })
    if (passwordErr || confirmErr) return

    setLoading(true)
    setBanner(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setBanner({ type: 'error', message: 'Une erreur est survenue. Le lien est peut-être expiré.' })
    } else {
      setBanner({ type: 'success', message: 'Mot de passe mis à jour. Redirection...' })
      setTimeout(() => router.push('/auth'), 2000)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-accent-cyan">
            <Bus className="h-7 w-7" />
            <span className="text-2xl font-bold">BusWave</span>
          </div>
          <p className="text-sm text-muted">Choisissez un nouveau mot de passe</p>
        </div>

        {banner && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              banner.type === 'error'
                ? 'border-red-500/30 bg-red-900/20 text-red-400'
                : 'border-emerald-500/30 bg-emerald-900/20 text-emerald-400'
            }`}
          >
            {banner.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setFieldErrors((f) => ({ ...f, password: validatePassword(password) }))}
                className={`w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm text-white placeholder-muted/50 outline-none transition-colors focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan ${
                  fieldErrors.password ? 'border-red-500' : 'border-white/10'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full rounded-full bg-white/10">
                  <div className={`h-1.5 rounded-full transition-all ${strength.color} ${strength.width}`} />
                </div>
                <p className="mt-1 text-xs text-muted">{strength.label}</p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Confirmer le mot de passe</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={() => setFieldErrors((f) => ({ ...f, confirm: validateConfirm(confirm) }))}
                className={`w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm text-white placeholder-muted/50 outline-none transition-colors focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan ${
                  fieldErrors.confirm ? 'border-red-500' : 'border-white/10'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.confirm && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-cyan py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Mettre à jour le mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}
