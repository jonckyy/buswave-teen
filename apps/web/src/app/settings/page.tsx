'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, LogOut, Shield, Star, User } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { createSupabaseClient } from '@/lib/supabase'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  editor: 'Éditeur',
  user: 'Utilisateur',
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, role, isAdmin, loading, signOut } = useUser()
  const favorites = useFavoritesStore(selectFavorites)
  const supabase = useMemo(() => createSupabaseClient(), [])

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

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
