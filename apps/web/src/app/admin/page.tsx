'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Users, Settings, Shield, Loader2, Save, Check, ChevronDown, ChevronUp, Bell, Star, Smartphone, Clock, Palette, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useUser } from '@/hooks/useUser'
import { createSupabaseClient } from '@/lib/supabase'
import { ROLE_LABELS, MAP_TILE_OPTIONS } from '@buswave/shared'
import type { RoleConfig, RoleConfigUpdate, AdminUserRow, AdminUserDetail, UserRole, Theme } from '@buswave/shared'

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
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted hover:text-white transition-colors">
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

/** Section 1: Users table with role management + expandable detail */
function UsersSection() {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const queryClient = useQueryClient()
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

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
    <section className="rounded-xl border border-white/10 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-accent-cyan" />
        <h2 className="text-lg font-semibold text-white">Utilisateurs</h2>
        <span className="ml-auto text-sm text-muted">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : (
        <div className="space-y-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-muted">
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4" title="Medium = acces etendu, Standard = acces basique">Role</th>
                  <th className="pb-2 pr-4 text-center" title="Nombre d'arrets enregistres en favoris">Favoris</th>
                  <th className="pb-2 pr-4 text-center" title="Nombre d'appareils abonnes aux notifications push">Push</th>
                  <th className="pb-2 pr-4 text-center" title="Nombre total de notifications push recues">Notifs</th>
                  <th className="pb-2 pr-4" title="Date d'inscription">Inscrit</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    expanded={expandedUserId === u.id}
                    onToggle={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                    updatingId={updatingId}
                    onRoleChange={handleRoleChange}
                    getToken={getToken}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function UserRow({ user: u, expanded, onToggle, updatingId, onRoleChange, getToken }: {
  user: AdminUserRow
  expanded: boolean
  onToggle: () => void
  updatingId: string | null
  onRoleChange: (userId: string, newRole: string) => void
  getToken: () => Promise<string | null>
}) {
  return (
    <>
      <tr
        className="border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        <td className="py-2.5 pr-4 text-white truncate max-w-[200px]">{u.email}</td>
        <td className="py-2.5 pr-4" onClick={(e) => e.stopPropagation()}>
          {u.role === 'admin' ? (
            <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-medium">
              <Shield className="h-3 w-3" />
              {ROLE_LABELS.admin}
            </span>
          ) : (
            <div className="relative">
              <select
                value={u.role}
                onChange={(e) => onRoleChange(u.id, e.target.value)}
                disabled={updatingId === u.id}
                className="appearance-none bg-background border border-white/10 rounded px-2 py-1 text-xs text-white cursor-pointer disabled:opacity-50"
              >
                <option value="editor">{ROLE_LABELS.editor}</option>
                <option value="user">{ROLE_LABELS.user}</option>
              </select>
              {updatingId === u.id && (
                <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-accent-cyan" />
              )}
            </div>
          )}
        </td>
        <td className="py-2.5 pr-4 text-center text-muted">{u.favoritesCount}</td>
        <td className="py-2.5 pr-4 text-center text-muted">{u.pushSubscriptionsCount}</td>
        <td className="py-2.5 pr-4 text-center text-muted">{u.notificationsReceivedCount}</td>
        <td className="py-2.5 pr-4 text-muted text-xs">
          {new Date(u.createdAt).toLocaleDateString('fr-BE')}
        </td>
        <td className="py-2.5 text-muted">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <UserDetailPanel userId={u.id} getToken={getToken} />
          </td>
        </tr>
      )}
    </>
  )
}

/** Expandable detail panel for a single user */
function UserDetailPanel({ userId, getToken }: { userId: string; getToken: () => Promise<string | null> }) {
  const queryClient = useQueryClient()
  const [clearing, setClearing] = useState(false)

  async function handleClearNotifications() {
    if (!confirm('Supprimer tous les abonnements push et parametres de notifications pour cet utilisateur ?')) return
    setClearing(true)
    try {
      const token = await getToken()
      if (!token) return
      await api.clearUserNotifications(userId, token)
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (err) {
      console.error('[admin] clear notifications error:', err)
    } finally {
      setClearing(false)
    }
  }

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return api.getAdminUserDetails(userId, token)
    },
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-6 bg-background border-b border-white/5">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    )
  }

  if (isError || !detail) {
    return (
      <div className="py-4 px-6 bg-background border-b border-white/5 text-sm text-large-delay">
        Erreur lors du chargement des details
      </div>
    )
  }

  // Aggregate push subscriptions by browser
  const browserCounts = new Map<string, number>()
  for (const sub of detail.pushSubscriptions) {
    browserCounts.set(sub.browser, (browserCounts.get(sub.browser) ?? 0) + 1)
  }
  const browserSummary = [...browserCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([browser, count]) => `${count} ${browser}`)
    .join(', ')

  // Count today's notifications
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayNotifs = detail.recentNotifications.filter(
    (n) => new Date(n.sentAt) >= todayStart
  ).length

  return (
    <div className="bg-background border-b border-white/5 p-4 space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          <Clock className="h-3.5 w-3.5" />
          Heures calmes: <span className="text-white">{detail.quietStart} - {detail.quietEnd}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <Bell className="h-3.5 w-3.5" />
          Notifs aujourd&apos;hui: <span className="text-white">{todayNotifs}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <Smartphone className="h-3.5 w-3.5" />
          Appareils: <span className="text-white">{browserSummary || 'Aucun'}</span>
        </div>
        {(detail.pushSubscriptions.length > 0 || detail.favorites.some((f) => f.notifications)) && (
          <button
            onClick={handleClearNotifications}
            disabled={clearing}
            className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50 ml-auto"
          >
            {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Reset notifs
          </button>
        )}
      </div>

      {/* Push subscriptions */}
      {detail.pushSubscriptions.length > 0 && (
        <DetailSection title="Abonnements Push" icon={<Smartphone className="h-3.5 w-3.5" />}>
          <div className="space-y-1.5">
            {detail.pushSubscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 text-xs rounded-lg border border-white/5 bg-card px-3 py-2">
                <span className="font-medium text-white min-w-[60px]">{sub.browser}</span>
                <span className="text-muted truncate flex-1 font-mono text-[10px]">
                  {sub.endpoint.replace(/^https:\/\/[^/]+/, '').slice(0, 60)}...
                </span>
                <span className="text-muted whitespace-nowrap">
                  {sub.lastUsed
                    ? `Vu ${new Date(sub.lastUsed).toLocaleDateString('fr-BE')} ${new Date(sub.lastUsed).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`
                    : `Cree ${new Date(sub.createdAt).toLocaleDateString('fr-BE')}`}
                </span>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Favorites */}
      {detail.favorites.length > 0 && (
        <DetailSection title="Favoris" icon={<Star className="h-3.5 w-3.5" />}>
          <div className="space-y-1.5">
            {detail.favorites.map((fav) => (
              <div key={fav.id} className="flex items-start gap-3 text-xs rounded-lg border border-white/5 bg-card px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {fav.routeShortName && (
                      <span className="inline-block rounded bg-accent-cyan/20 text-accent-cyan px-1.5 py-0.5 font-bold text-[10px]">
                        {fav.routeShortName}
                      </span>
                    )}
                    <span className="text-white font-medium truncate">{fav.stopName}</span>
                  </div>
                  {fav.label && <span className="text-muted text-[10px]">{fav.label}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fav.notifications ? (
                    <div className="flex items-center gap-1">
                      {fav.notifications.timeEnabled && fav.notifications.timeMinutes.map((m) => (
                        <span key={m} className="rounded bg-on-time/20 text-on-time px-1.5 py-0.5 text-[10px]" title={`Alerte temps: ${m} min`}>
                          {m}min
                        </span>
                      ))}
                      {fav.notifications.distanceEnabled && (
                        <span className="rounded bg-slight-delay/20 text-slight-delay px-1.5 py-0.5 text-[10px]" title={`Alerte distance: ${fav.notifications.distanceMeters}m`}>
                          {fav.notifications.distanceMeters}m
                        </span>
                      )}
                      {fav.notifications.offrouteEnabled && (
                        <span className="rounded bg-large-delay/20 text-large-delay px-1.5 py-0.5 text-[10px]" title={`Alerte hors route: ${fav.notifications.offrouteMeters}m`}>
                          HR {fav.notifications.offrouteMeters}m
                        </span>
                      )}
                      {!fav.notifications.timeEnabled && !fav.notifications.distanceEnabled && !fav.notifications.offrouteEnabled && (
                        <span className="text-muted text-[10px]">Notifs off</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted text-[10px]">Pas de notifs</span>
                  )}
                </div>
                <span className="text-muted text-[10px] whitespace-nowrap">
                  {new Date(fav.createdAt).toLocaleDateString('fr-BE')}
                </span>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Recent notifications */}
      {detail.recentNotifications.length > 0 && (
        <DetailSection title="Notifications recentes" icon={<Bell className="h-3.5 w-3.5" />}>
          <div className="space-y-1">
            {detail.recentNotifications.slice(0, 20).map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-xs text-muted rounded border border-white/5 bg-card px-3 py-1.5">
                <TriggerBadge type={log.triggerType} />
                <span className="text-white truncate flex-1">
                  {log.routeShortName && (
                    <span className="text-accent-cyan font-medium mr-1">{log.routeShortName}</span>
                  )}
                  {log.stopName ?? log.favoriteId.slice(0, 8)}
                </span>
                <span className="font-mono text-[10px] text-muted">{log.tripId.slice(0, 12)}</span>
                <span className="whitespace-nowrap text-[10px]">
                  {new Date(log.sentAt).toLocaleDateString('fr-BE')}{' '}
                  {new Date(log.sentAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {detail.recentNotifications.length > 20 && (
              <p className="text-[10px] text-muted text-center pt-1">
                +{detail.recentNotifications.length - 20} autres notifications
              </p>
            )}
          </div>
        </DetailSection>
      )}

      {/* Empty state */}
      {detail.favorites.length === 0 && detail.pushSubscriptions.length === 0 && detail.recentNotifications.length === 0 && (
        <p className="text-xs text-muted text-center py-2">Aucune donnee pour cet utilisateur</p>
      )}
    </div>
  )
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-accent-cyan">{icon}</span>
        <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function TriggerBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    time: { bg: 'bg-on-time/20', text: 'text-on-time', label: 'Temps' },
    distance: { bg: 'bg-slight-delay/20', text: 'text-slight-delay', label: 'Dist' },
    offroute: { bg: 'bg-large-delay/20', text: 'text-large-delay', label: 'HR' },
  }
  const s = styles[type] ?? { bg: 'bg-white/10', text: 'text-white', label: type }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
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

  const { data: themes = [] } = useQuery({
    queryKey: ['themes'],
    queryFn: () => api.getThemes(),
    staleTime: 5 * 60_000,
  })

  const config = configs.find((c) => c.role === role)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Local state mirrors config
  const [themeId, setThemeId] = useState('midnight')
  const [mapTileStyle, setMapTileStyle] = useState('osm-standard')
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
    setThemeId(config.themeId ?? 'midnight')
    setMapTileStyle(config.mapTileStyle ?? 'osm-standard')
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
        themeId,
        mapTileStyle,
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
    <section className="rounded-xl border border-white/10 bg-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-accent-cyan" />
          <h2 className="text-lg font-semibold text-white">{label}</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'OK' : 'Enregistrer'}
        </button>
      </div>

      {/* Theme */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          <span className="inline-flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Theme</span>
        </h3>
        <select
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
          className="appearance-none bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white cursor-pointer w-full sm:w-auto"
        >
          {themes.map((t: Theme) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Map tile style */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          <span className="inline-flex items-center gap-1.5">Style de carte</span>
        </h3>
        <select
          value={mapTileStyle}
          onChange={(e) => setMapTileStyle(e.target.value)}
          className="appearance-none bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white cursor-pointer w-full sm:w-auto"
        >
          {MAP_TILE_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}{t.dark ? ' (sombre)' : ''}</option>
          ))}
        </select>
      </div>

      {/* Limits */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Limites</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumberInput label="Max favoris" value={maxFavorites} onChange={setMaxFavorites} min={1} max={999} tooltip="Nombre maximum d'arrets favoris que l'utilisateur peut enregistrer" />
          <NumberInput label="Max push favoris" value={maxPushFavorites} onChange={setMaxPushFavorites} min={0} max={100} tooltip="Nombre maximum de favoris pouvant avoir des notifications push actives" />
          <NumberInput label="Max notifications" value={maxPushNotifications} onChange={setMaxPushNotifications} min={0} max={999} tooltip="Nombre maximum de notifications push envoyees par jour (reset a minuit, heure de Bruxelles)" />
        </div>
      </div>

      {/* Feature visibility */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Visibilite</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Toggle label="Debug panel" checked={showDebugPanel} onChange={setShowDebugPanel} tooltip="Affiche le panneau de statut systeme (Railway API, GTFS-RT, bus actifs) sur la page d'accueil" />
          <Toggle label="Donnees techniques" checked={showTechnicalData} onChange={setShowTechnicalData} tooltip="Affiche les identifiants techniques (trip ID, coordonnees GPS) dans les panneaux d'info sur la carte" />
          <Toggle label="Metriques distance" checked={showDistanceMetrics} onChange={setShowDistanceMetrics} tooltip="Affiche la distance route/vol d'oiseau entre le bus et l'arret dans les panneaux de la carte" />
          <Toggle label="Badges retard" checked={showDelayBadges} onChange={setShowDelayBadges} tooltip="Affiche les badges de retard/avance (ex: +2min, -1min) sur les cartes de favoris" />
          <Toggle label="Page Live" checked={showLivePage} onChange={setShowLivePage} tooltip="Donne acces a la page 'En temps reel' listant tous les bus et lignes actifs" />
          <Toggle label="Page Alertes" checked={showAlertsPage} onChange={setShowAlertsPage} tooltip="Donne acces a la page 'Alertes' affichant les perturbations TEC en cours" />
        </div>
      </div>

      {/* Arrivals per card */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Affichage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumberInput label="Arrivees par carte" value={arrivalsPerCard} onChange={setArrivalsPerCard} min={1} max={10} tooltip="Nombre de prochains passages affiches par carte de favori (1 a 10)" />
        </div>
      </div>

      {/* Trigger types */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Types de notifications</h3>
        <div className="grid grid-cols-3 gap-2">
          <Toggle label="Temps" checked={triggerTime} onChange={setTriggerTime} tooltip="Permet de configurer des alertes basees sur le temps d'arrivee estime (ex: notifier quand le bus arrive dans 5 min)" />
          <Toggle label="Distance" checked={triggerDistance} onChange={setTriggerDistance} tooltip="Permet de configurer des alertes basees sur la distance du bus par rapport a l'arret (ex: notifier quand le bus est a 500m)" />
          <Toggle label="Hors route" checked={triggerOffroute} onChange={setTriggerOffroute} tooltip="Permet de configurer des alertes quand un bus devie de son itineraire prevu au-dela d'un seuil configurable" />
        </div>
      </div>
    </section>
  )
}

function NumberInput({ label, value, onChange, min, max, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; tooltip?: string
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-background px-3 py-2" title={tooltip}>
      <span className="text-xs text-muted">{label}</span>
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
    <label className="flex items-center gap-2 rounded-lg border border-white/5 bg-background px-3 py-2 cursor-pointer" title={tooltip}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-accent-cyan"
      />
      <span className="text-xs text-white">{label}</span>
    </label>
  )
}
