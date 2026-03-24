'use client'

import { useState } from 'react'
import { Bus, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase'

type View = 'signin' | 'signup' | 'forgot'

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

function mapError(error: { message: string }): string {
  const msg = error.message
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('Email not confirmed')) return 'Veuillez vérifier votre email avant de vous connecter.'
  if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
  if (msg.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (msg.includes('over_email_send_rate_limit') || msg.includes('rate limit')) return 'Trop de tentatives. Veuillez patienter.'
  if (msg.includes('signup_disabled')) return 'Les inscriptions sont désactivées.'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Network')) return 'Erreur de connexion. Vérifiez votre réseau.'
  return 'Une erreur est survenue. Veuillez réessayer.'
}

export default function AuthPage() {
  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirm?: string }>({})

  const supabase = createSupabaseClient()
  const strength = getPasswordStrength(password)

  function validateEmail(val: string) {
    if (!val) return 'Email requis.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Email invalide.'
    return ''
  }

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

  function validate(): boolean {
    const errors: typeof fieldErrors = {}
    errors.email = validateEmail(email)
    if (view !== 'forgot') errors.password = validatePassword(password)
    if (view === 'signup') errors.confirm = validateConfirm(confirmPassword)
    const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
    setFieldErrors(clean)
    return Object.keys(clean).length === 0
  }

  async function handleSignIn() {
    if (!validate()) return
    setLoading(true)
    setBanner(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setBanner({ type: 'error', message: mapError(error) })
    } else {
      window.location.href = '/'
    }
  }

  async function handleSignUp() {
    if (!validate()) return
    setLoading(true)
    setBanner(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setBanner({ type: 'error', message: mapError(error) })
    } else {
      setBanner({ type: 'success', message: 'Vérifiez votre email pour confirmer votre inscription.' })
    }
  }

  async function handleForgotPassword() {
    const emailErr = validateEmail(email)
    if (emailErr) { setFieldErrors({ email: emailErr }); return }
    setLoading(true)
    setBanner(null)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    setBanner({
      type: 'success',
      message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (view === 'signin') handleSignIn()
    else if (view === 'signup') handleSignUp()
    else handleForgotPassword()
  }

  function switchView(v: View) {
    setView(v)
    setBanner(null)
    setFieldErrors({})
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131A2B] p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[#00D4FF]">
            <Bus className="h-7 w-7" />
            <span className="text-2xl font-bold">BusWave</span>
          </div>
          <p className="text-sm text-[#8892B0]">
            {view === 'forgot' ? 'Réinitialiser le mot de passe' : 'Connexion à votre compte'}
          </p>
        </div>

        {/* Tabs (Sign In / Sign Up) */}
        {view !== 'forgot' && (
          <div className="mb-6 flex rounded-lg bg-[#0A0E17] p-1">
            {(['signin', 'signup'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => switchView(v)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-[#131A2B] text-white shadow'
                    : 'text-[#8892B0] hover:text-white'
                }`}
              >
                {v === 'signin' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>
        )}

        {/* Banner */}
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
          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#8892B0]">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setFieldErrors((f) => ({ ...f, email: validateEmail(email) }))}
              className={`w-full rounded-lg border bg-[#0A0E17] px-3 py-2 text-sm text-white placeholder-[#8892B0]/50 outline-none transition-colors focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] ${
                fieldErrors.email ? 'border-red-500' : 'border-white/10'
              }`}
              placeholder="vous@exemple.com"
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
          </div>

          {/* Password */}
          {view !== 'forgot' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[#8892B0]">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setFieldErrors((f) => ({ ...f, password: validatePassword(password) }))}
                  className={`w-full rounded-lg border bg-[#0A0E17] px-3 py-2 pr-10 text-sm text-white placeholder-[#8892B0]/50 outline-none transition-colors focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] ${
                    fieldErrors.password ? 'border-red-500' : 'border-white/10'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892B0] hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}

              {/* Password strength (sign up only) */}
              {view === 'signup' && password.length > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full bg-white/10">
                    <div className={`h-1.5 rounded-full transition-all ${strength.color} ${strength.width}`} />
                  </div>
                  <p className="mt-1 text-xs text-[#8892B0]">{strength.label}</p>
                </div>
              )}
            </div>
          )}

          {/* Confirm Password (sign up only) */}
          {view === 'signup' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[#8892B0]">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setFieldErrors((f) => ({ ...f, confirm: validateConfirm(confirmPassword) }))}
                  className={`w-full rounded-lg border bg-[#0A0E17] px-3 py-2 pr-10 text-sm text-white placeholder-[#8892B0]/50 outline-none transition-colors focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] ${
                    fieldErrors.confirm ? 'border-red-500' : 'border-white/10'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892B0] hover:text-white"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.confirm && <p className="mt-1 text-xs text-red-400">{fieldErrors.confirm}</p>}
            </div>
          )}

          {/* Forgot password link (sign in only) */}
          {view === 'signin' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => switchView('forgot')}
                className="text-xs text-[#8892B0] hover:text-[#00D4FF] transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D4FF] py-2.5 text-sm font-semibold text-[#0A0E17] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {view === 'signin' && 'Se connecter'}
            {view === 'signup' && "S'inscrire"}
            {view === 'forgot' && 'Envoyer le lien'}
          </button>

          {/* Back to sign in (forgot view) */}
          {view === 'forgot' && (
            <button
              type="button"
              onClick={() => switchView('signin')}
              className="w-full text-center text-sm text-[#8892B0] hover:text-white transition-colors"
            >
              ← Retour à la connexion
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
