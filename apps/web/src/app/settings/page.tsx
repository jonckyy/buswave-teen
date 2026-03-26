'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, LogOut, Shield, Star, User, Bell, BellOff, Moon } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { createSupabaseClient } from '@/lib/supabase'
import { api } from '@/lib/api'
import { ROLE_LABELS } from '@buswave/shared'

export default function SettingsPage() {
  const router = useRouter()
  const { user, role, isAdmin, loading, signOut } = useUser()
  const favorites = useFavoritesStore(selectFavorites)
  const supabase = useMemo(() => createSupabaseClient(), [])

  const { supported: pushSupported, permission: pushPermission, isSubscribed, subscribe, unsubscribe } = usePushNotifications()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [quietLoading, setQuietLoading] = useState(false)
  const [quietSaving, setQuietSaving] = useState(false)

  // Fetch quiet hours
  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setQuietLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token || cancelled) return
        const qh = await api.getQuietHours(session.access_token)
        if (!cancelled) {
          setQuietStart(qh.quietStart)
          setQuietEnd(qh.quietEnd)
        }
      } catch {
        // use defaults
      } finally {
        if (!cancelled) setQuietLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-[#8892B0]" />
      </div>
    )
  }

  if (!user) {
    router.push('/auth')
    return null
  }

  const joinedAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString('fr-BE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setBanner({ type: 'error', message: 'Minimum 8 caractères.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setBanner({ type: 'error', message: 'Les mots de passe ne correspondent pas.' })
      return
    }
    setSaving(true)
    setBanner(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      setBanner({ type: 'error', message: 'Erreur lors du changement de mot de passe.' })
    } else {
      setBanner({ type: 'success', message: 'Mot de passe mis à jour.' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Mon compte</h1>

      {/* Profile info */}
      <div className="rounded-xl border border-white/10 bg-[#131A2B] p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00D4FF]/10 text-[#00D4FF]">
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-white">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isAdmin && <Shield className="h-3.5 w-3.5 text-yellow-400" />}
              <span className="text-sm text-[#8892B0]">
                {ROLE_LABELS[role ?? 'user'] ?? role}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
          <div>
            <p className="text-xs text-[#8892B0] mb-1">Favoris enregistrés</p>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-[#00D4FF]" />
              <span className="text-xl font-bold text-white">{favorites.length}</span>
            </div>
          </div>
          {joinedAt && (
            <div>
              <p className="text-xs text-[#8892B0] mb-1">Membre depuis</p>
              <p className="text-sm text-white">{joinedAt}</p>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-white/10 bg-[#131A2B] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#00D4FF]" />
          <h2 className="text-base font-semibold text-white">Notifications push</h2>
        </div>

        {!pushSupported ? (
          <p className="text-sm text-[#8892B0]">
            Les notifications push ne sont pas supportées sur ce navigateur.
          </p>
        ) : pushPermission === 'denied' ? (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <BellOff className="h-4 w-4" />
            <span>Notifications bloquées — autorisez-les dans les paramètres de votre navigateur.</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">
                  {isSubscribed ? 'Notifications activées' : 'Notifications désactivées'}
                </p>
                <p className="text-xs text-[#8892B0]">
                  {isSubscribed
                    ? 'Vous recevez des alertes pour vos favoris configurés.'
                    : 'Activez pour recevoir des alertes sur vos favoris.'}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    if (isSubscribed) await unsubscribe()
                    else await subscribe()
                  } catch { /* handled by hook */ }
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  isSubscribed
                    ? 'border border-red-500/30 text-red-400 hover:bg-red-900/20'
                    : 'bg-[#00D4FF] text-[#0A0E17]'
                }`}
              >
                {isSubscribed ? 'Désactiver' : 'Activer'}
              </button>
            </div>

            {/* Quiet hours */}
            <div className="space-y-3 rounded-xl border border-white/5 bg-[#0A0E17] p-4">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-[#8892B0]" />
                <span className="text-sm font-medium text-white">Heures silencieuses</span>
              </div>
              <p className="text-xs text-[#8892B0]">
                Aucune notification ne sera envoyée pendant cette période.
              </p>
              {quietLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#8892B0]" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#8892B0]">De</label>
                    <input
                      type="time"
                      value={quietStart}
                      onChange={(e) => setQuietStart(e.target.value)}
                      className="rounded border border-white/10 bg-[#131A2B] px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#8892B0]">à</label>
                    <input
                      type="time"
                      value={quietEnd}
                      onChange={(e) => setQuietEnd(e.target.value)}
                      className="rounded border border-white/10 bg-[#131A2B] px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      setQuietSaving(true)
                      try {
                        const { data: { session } } = await supabase.auth.getSession()
                        if (session?.access_token) {
                          await api.updateQuietHours(quietStart, quietEnd, session.access_token)
                        }
                      } catch { /* ignore */ }
                      setQuietSaving(false)
                    }}
                    disabled={quietSaving}
                    className="rounded-lg bg-[#00D4FF] px-3 py-1 text-xs font-semibold text-[#0A0E17] hover:opacity-90 disabled:opacity-50"
                  >
                    {quietSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sauver'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-white/10 bg-[#131A2B] p-6">
        <h2 className="text-base font-semibold text-white mb-4">Changer le mot de passe</h2>

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

        <form onSubmit={handlePasswordChange} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#8892B0]">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0A0E17] px-3 py-2 pr-10 text-sm text-white placeholder-[#8892B0]/50 outline-none transition-colors focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]"
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
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#8892B0]">Confirmer</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0A0E17] px-3 py-2 text-sm text-white placeholder-[#8892B0]/50 outline-none transition-colors focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !newPassword}
            className="flex items-center gap-2 rounded-lg bg-[#00D4FF] px-4 py-2 text-sm font-semibold text-[#0A0E17] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Mettre à jour
          </button>
        </form>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-900/10 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/20 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </button>
    </div>
  )
}
