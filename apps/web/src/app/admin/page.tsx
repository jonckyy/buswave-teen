'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Users, Settings, Shield, Loader2, Save, Check } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useUser } from '@/hooks/useUser'
import { createSupabaseClient } from '@/lib/supabase'
import { ROLE_LABELS } from '@buswave/shared'
import type { RoleConfig, RoleConfigUpdate, AdminUserRow, UserRole } from '@buswave/shared'

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useUser()
  const router = useRouter()

  if (!authLoading && !isAdmin) {
    router.replace('/')
    return null
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#8892B0]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#8892B0] hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Administration</h1>
        </div>
      </div>

      <UsersSection />
      <RoleConfigSection role="editor" />
      <RoleConfigSection role="user" />
    </div>
  )
}

/** Section 1: Users table with role management */
function UsersSection() {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const queryClient = useQueryClient()

  const getToken = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [supabase])

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return api.getAdminUsers(token)
    },
    staleTime: 30_000,
  })

  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingId(userId)
    try {
      const token = await getToken()
      if (!token) return
      await api.updateUserRole(userId, newRole, token)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (err) {
      console.error('[admin] role change error:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#131A2B] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-[#00D4FF]" />
        <h2 className="text-lg font-semibold text-white">Utilisateurs</h2>
        <span className="ml-auto text-sm text-[#8892B0]">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#8892B0]" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-[#8892B0]">
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4" title="Medium = accès étendu, Standard = accès basique">Role</th>
                <th className="pb-2 pr-4 text-center" title="Nombre d'arrêts enregistrés en favoris">Favoris</th>
                <th className="pb-2 pr-4 text-center" title="Nombre d'appareils abonnés aux notifications push">Push</th>
                <th className="pb-2 pr-4 text-center" title="Nombre total de notifications push reçues">Notifs</th>
                <th className="pb-2" title="Date d'inscription">Inscrit</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="py-2.5 pr-4 text-white truncate max-w-[200px]">{u.email}</td>
                  <td className="py-2.5 pr-4">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-medium">
                        <Shield className="h-3 w-3" />
                        {ROLE_LABELS.admin}
                      </span>
                    ) : (
                      <div className="relative">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={updatingId === u.id}
                          className="appearance-none bg-[#0A0E17] border border-white/10 rounded px-2 py-1 text-xs text-white cursor-pointer disabled:opacity-50"
                        >
                          <option value="editor">{ROLE_LABELS.editor}</option>
                          <option value="user">{ROLE_LABELS.user}</option>
                        </select>
                        {updatingId === u.id && (
                          <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-[#00D4FF]" />
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-center text-[#8892B0]">{u.favoritesCount}</td>
                  <td className="py-2.5 pr-4 text-center text-[#8892B0]">{u.pushSubscriptionsCount}</td>
                  <td className="py-2.5 pr-4 text-center text-[#8892B0]">{u.notificationsReceivedCount}</td>
                  <td className="py-2.5 text-[#8892B0] text-xs">
                    {new Date(u.createdAt).toLocaleDateString('fr-BE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Section 2+3: Role limits & feature visibility for a single role */
function RoleConfigSection({ role }: { role: 'editor' | 'user' }) {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const queryClient = useQueryClient()

  const getToken = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [supabase])

  const { data: configs = [] } = useQuery({
    queryKey: ['role-config'],
    queryFn: () => api.getRoleConfig(),
    staleTime: 5 * 60_000,
  })

  const config = configs.find((c) => c.role === role)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Local state mirrors config
  const [maxFavorites, setMaxFavorites] = useState(0)
  const [maxPushFavorites, setMaxPushFavorites] = useState(0)
  const [maxPushNotifications, setMaxPushNotifications] = useState(0)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [showTechnicalData, setShowTechnicalData] = useState(false)
  const [showDistanceMetrics, setShowDistanceMetrics] = useState(false)
  const [showDelayBadges, setShowDelayBadges] = useState(true)
  const [showLivePage, setShowLivePage] = useState(false)
  const [showAlertsPage, setShowAlertsPage] = useState(true)
  const [arrivalsPerCard, setArrivalsPerCard] = useState(3)
  const [triggerTime, setTriggerTime] = useState(true)
  const [triggerDistance, setTriggerDistance] = useState(false)
  const [triggerOffroute, setTriggerOffroute] = useState(false)

  // Sync from fetched config
  useEffect(() => {
    if (!config) return
    setMaxFavorites(config.maxFavorites)
    setMaxPushFavorites(config.maxPushFavorites)
    setMaxPushNotifications(config.maxPushNotifications)
    setShowDebugPanel(config.showDebugPanel)
    setShowTechnicalData(config.showTechnicalData)
    setShowDistanceMetrics(config.showDistanceMetrics)
    setShowDelayBadges(config.showDelayBadges)
    setShowLivePage(config.showLivePage)
    setShowAlertsPage(config.showAlertsPage)
    setArrivalsPerCard(config.arrivalsPerCard)
    setTriggerTime(config.allowedTriggerTypes.includes('time'))
    setTriggerDistance(config.allowedTriggerTypes.includes('distance'))
    setTriggerOffroute(config.allowedTriggerTypes.includes('offroute'))
  }, [config])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const token = await getToken()
      if (!token) return

      const allowedTriggerTypes: string[] = []
      if (triggerTime) allowedTriggerTypes.push('time')
      if (triggerDistance) allowedTriggerTypes.push('distance')
      if (triggerOffroute) allowedTriggerTypes.push('offroute')

      const update: RoleConfigUpdate = {
        maxFavorites,
        maxPushFavorites,
        maxPushNotifications,
        showDebugPanel,
        showTechnicalData,
        showDistanceMetrics,
        showDelayBadges,
        showLivePage,
        showAlertsPage,
        arrivalsPerCard,
        allowedTriggerTypes,
      }

      await api.updateRoleConfig(role, update, token)
      queryClient.invalidateQueries({ queryKey: ['role-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('[admin] save config error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!config) return null

  const label = ROLE_LABELS[role as UserRole]

  return (
    <section className="rounded-xl border border-white/10 bg-[#131A2B] p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#00D4FF]" />
          <h2 className="text-lg font-semibold text-white">{label}</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#00D4FF] px-4 py-2 text-sm font-semibold text-[#0A0E17] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'OK' : 'Enregistrer'}
        </button>
      </div>

      {/* Limits */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-[#8892B0] uppercase tracking-wider mb-3">Limites</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumberInput label="Max favoris" value={maxFavorites} onChange={setMaxFavorites} min={1} max={999} tooltip="Nombre maximum d'arrêts favoris que l'utilisateur peut enregistrer" />
          <NumberInput label="Max push favoris" value={maxPushFavorites} onChange={setMaxPushFavorites} min={0} max={100} tooltip="Nombre maximum de favoris pouvant avoir des notifications push actives" />
          <NumberInput label="Max notifications" value={maxPushNotifications} onChange={setMaxPushNotifications} min={0} max={999} tooltip="Nombre total maximum de notifications push envoyées à l'utilisateur" />
        </div>
      </div>

      {/* Feature visibility */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-[#8892B0] uppercase tracking-wider mb-3">Visibilite</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Toggle label="Debug panel" checked={showDebugPanel} onChange={setShowDebugPanel} tooltip="Affiche le panneau de statut système (Railway API, GTFS-RT, bus actifs) sur la page d'accueil" />
          <Toggle label="Donnees techniques" checked={showTechnicalData} onChange={setShowTechnicalData} tooltip="Affiche les identifiants techniques (trip ID, coordonnees GPS) dans les panneaux d'info sur la carte" />
          <Toggle label="Metriques distance" checked={showDistanceMetrics} onChange={setShowDistanceMetrics} tooltip="Affiche la distance route/vol d'oiseau entre le bus et l'arrêt dans les panneaux de la carte" />
          <Toggle label="Badges retard" checked={showDelayBadges} onChange={setShowDelayBadges} tooltip="Affiche les badges de retard/avance (ex: +2min, -1min) sur les cartes de favoris" />
          <Toggle label="Page Live" checked={showLivePage} onChange={setShowLivePage} tooltip="Donne accès à la page 'En temps réel' listant tous les bus et lignes actifs" />
          <Toggle label="Page Alertes" checked={showAlertsPage} onChange={setShowAlertsPage} tooltip="Donne accès à la page 'Alertes' affichant les perturbations TEC en cours" />
        </div>
      </div>

      {/* Arrivals per card */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-[#8892B0] uppercase tracking-wider mb-3">Affichage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumberInput label="Arrivees par carte" value={arrivalsPerCard} onChange={setArrivalsPerCard} min={1} max={10} tooltip="Nombre de prochains passages affiches par carte de favori (1 à 10)" />
        </div>
      </div>

      {/* Trigger types */}
      <div>
        <h3 className="text-xs font-semibold text-[#8892B0] uppercase tracking-wider mb-3">Types de notifications</h3>
        <div className="grid grid-cols-3 gap-2">
          <Toggle label="Temps" checked={triggerTime} onChange={setTriggerTime} tooltip="Permet de configurer des alertes basées sur le temps d'arrivée estimé (ex: notifier quand le bus arrive dans 5 min)" />
          <Toggle label="Distance" checked={triggerDistance} onChange={setTriggerDistance} tooltip="Permet de configurer des alertes basées sur la distance du bus par rapport à l'arrêt (ex: notifier quand le bus est à 500m)" />
          <Toggle label="Hors route" checked={triggerOffroute} onChange={setTriggerOffroute} tooltip="Permet de configurer des alertes quand un bus dévie de son itinéraire prévu au-delà d'un seuil configurable" />
        </div>
      </div>
    </section>
  )
}

function NumberInput({ label, value, onChange, min, max, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; tooltip?: string
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#0A0E17] px-3 py-2" title={tooltip}>
      <span className="text-xs text-[#8892B0]">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        min={min}
        max={max}
        className="w-16 bg-transparent text-right text-sm font-semibold text-white outline-none"
      />
    </label>
  )
}

function Toggle({ label, checked, onChange, tooltip }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; tooltip?: string
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#0A0E17] px-3 py-2 cursor-pointer" title={tooltip}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#00D4FF]"
      />
      <span className="text-xs text-white">{label}</span>
    </label>
  )
}
