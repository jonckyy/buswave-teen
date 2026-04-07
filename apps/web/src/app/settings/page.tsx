'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  LogOut,
  User,
  Bell,
  BellOff,
  Moon,
  Trash2,
  Shield,
  Star,
  Lock,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { createSupabaseClient } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { GradientText } from '@/components/ui/GradientText'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const router = useRouter()
  const { user, role, isAdmin, loading, signOut } = useUser()
  const favorites = useFavoritesStore(selectFavorites)
  const supabase = useMemo(() => createSupabaseClient(), [])
  const { supported: pushSupported, permission: pushPermission, isSubscribed, subscribe, unsubscribe } =
    usePushNotifications()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [quietLoading, setQuietLoading] = useState(false)
  const [quietSaving, setQuietSaving] = useState(false)

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
        /* ignore */
      } finally {
        if (!cancelled) setQuietLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      setBanner({ type: 'error', message: 'Minimum 8 caractères' })
      return
    }
    if (newPassword !== confirmPassword) {
      setBanner({ type: 'error', message: 'Les mots de passe ne correspondent pas' })
      return
    }
    setSaving(true)
    setBanner(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      setBanner({ type: 'error', message: 'Erreur lors du changement' })
    } else {
      setBanner({ type: 'success', message: 'Mot de passe mis à jour' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function handleClearNotifications() {
    if (!confirm('Supprimer tous tes abonnements et paramètres de notifications ?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await api.clearAllNotifications(session.access_token)
        setBanner({ type: 'success', message: 'Notifications réinitialisées' })
      }
    } catch {
      setBanner({ type: 'error', message: 'Erreur lors de la réinitialisation' })
    }
  }

  return (
    <div className="space-y-4">
      <GradientText as="h1" className="text-3xl font-extrabold tracking-tight block animate-fade-up">
        Mon compte
      </GradientText>

      {/* Profile card */}
      <Card variant="glow" className="animate-fade-up">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-btn-primary shadow-glow shrink-0">
            <User className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isAdmin && <Shield className="h-3.5 w-3.5 text-sun glow-purple" strokeWidth={2.5} />}
              <span className="text-sm text-ink2 font-bold uppercase">{role ?? 'user'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-line">
          <div className="rounded-2xl glass p-3">
            <p className="text-[10px] font-extrabold text-primary-light uppercase mb-1">Favoris</p>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-sun" strokeWidth={2.5} />
              <span className="text-xl font-extrabold text-ink">{favorites.length}</span>
            </div>
          </div>
          {joinedAt && (
            <div className="rounded-2xl glass p-3">
              <p className="text-[10px] font-extrabold text-cyan-light uppercase mb-1">Membre depuis</p>
              <p className="text-sm font-extrabold text-ink truncate">{joinedAt}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card variant="glass" className="animate-fade-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-btn-lime shadow-glow-lime">
            <Bell className="h-5 w-5 text-bg-deep" strokeWidth={2.5} />
          </div>
          <h2 className="text-lg font-extrabold text-ink">Notifications push</h2>
        </div>

        {!pushSupported ? (
          <p className="text-sm font-bold text-ink2">Non supporté sur ce navigateur</p>
        ) : pushPermission === 'denied' ? (
          <div className="rounded-2xl glass-strong p-3 flex items-center gap-2">
            <BellOff className="h-4 w-4 text-rose-light" strokeWidth={2.5} />
            <span className="text-sm font-bold text-rose-light">
              Notifications bloquées — autorise-les dans les paramètres
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-ink">
                  {isSubscribed ? 'Activées' : 'Désactivées'}
                </p>
                <p className="text-xs text-ink3 font-medium">
                  {isSubscribed ? 'Tu reçois des alertes pour tes favoris' : 'Active pour recevoir les alertes'}
                </p>
              </div>
              <Button
                variant={isSubscribed ? 'danger' : 'lime'}
                size="md"
                onClick={async () => {
                  try {
                    if (isSubscribed) await unsubscribe()
                    else await subscribe()
                  } catch { /* */ }
                }}
              >
                {isSubscribed ? 'Désactiver' : 'Activer'}
              </Button>
            </div>

            <div className="rounded-2xl glass p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-primary-light" strokeWidth={2.5} />
                <span className="font-extrabold text-ink text-sm">Heures silencieuses</span>
              </div>
              <p className="text-xs text-ink3 font-medium">Aucune notif pendant cette période</p>
              {quietLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-ink3 font-bold">De</label>
                    <input
                      type="time"
                      value={quietStart}
                      onChange={(e) => setQuietStart(e.target.value)}
                      className="rounded-xl glass-strong px-3 py-1.5 text-sm font-bold text-ink focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-ink3 font-bold">à</label>
                    <input
                      type="time"
                      value={quietEnd}
                      onChange={(e) => setQuietEnd(e.target.value)}
                      className="rounded-xl glass-strong px-3 py-1.5 text-sm font-bold text-ink focus:outline-none"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={quietSaving}
                    onClick={async () => {
                      setQuietSaving(true)
                      try {
                        const { data: { session } } = await supabase.auth.getSession()
                        if (session?.access_token) {
                          await api.updateQuietHours(quietStart, quietEnd, session.access_token)
                        }
                      } catch { /* */ }
                      setQuietSaving(false)
                    }}
                  >
                    {quietSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sauver'}
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-2xl glass-strong p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-rose-light text-sm">Réinitialiser</p>
                  <p className="text-xs text-ink3 font-medium">Supprime tous les abonnements et paramètres</p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClearNotifications}
                  iconLeft={<Trash2 className="h-4 w-4" strokeWidth={2.5} />}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Password */}
      <Card variant="glass" className="animate-fade-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-btn-cyan shadow-glow-cyan">
            <Lock className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-lg font-extrabold text-ink">Mot de passe</h2>
        </div>

        {banner && (
          <div
            className={cn(
              'mb-3 rounded-2xl glass-strong p-3 text-sm font-bold',
              banner.type === 'error' ? 'text-rose-light' : 'text-lime-light'
            )}
          >
            {banner.message}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full h-12 rounded-2xl glass px-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:shadow-glow"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer"
            className="w-full h-12 rounded-2xl glass px-4 text-base font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:shadow-glow"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={saving || !newPassword}
            className="w-full"
            iconLeft={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Mettre à jour
          </Button>
        </form>
      </Card>

      {/* Sign out */}
      <Button
        variant="danger"
        size="lg"
        onClick={signOut}
        className="w-full"
        iconLeft={<LogOut className="h-5 w-5" strokeWidth={2.5} />}
      >
        Se déconnecter
      </Button>
    </div>
  )
}
