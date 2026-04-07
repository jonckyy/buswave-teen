'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Shield,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings as SettingsIcon,
  Bell,
  Star,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useUser } from '@/hooks/useUser'
import { createSupabaseClient } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { GradientText } from '@/components/ui/GradientText'
import { cn } from '@/lib/utils'
import type { AdminUserRow, RoleConfigUpdate } from '@buswave/shared'

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useUser()
  const router = useRouter()

  if (!authLoading && !isAdmin) {
    router.replace('/')
    return null
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <div className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-sun glow-purple" strokeWidth={2.5} />
          <GradientText as="h1" className="text-3xl font-extrabold tracking-tight">
            Admin
          </GradientText>
        </div>
        <p className="text-ink2 font-medium">Gestion des utilisateurs et rôles</p>
      </div>

      <UsersSection />
      <RoleConfigSection role="user" />
      <RoleConfigSection role="editor" />
    </div>
  )
}

// ── Users section ────────────────────────────────────────────────────────

function UsersSection() {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

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

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingId(userId)
    try {
      const token = await getToken()
      if (!token) return
      await api.updateUserRole(userId, newRole, token)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card variant="glass" className="animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-btn-primary text-white shadow-glow">
          <Users className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <h2 className="font-extrabold text-ink">Utilisateurs</h2>
          <p className="text-xs text-ink3 font-bold">{users.length} compte{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              expanded={expandedId === u.id}
              onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)}
              updatingId={updatingId}
              onRoleChange={handleRoleChange}
              getToken={getToken}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

function UserRow({
  user: u,
  expanded,
  onToggle,
  updatingId,
  onRoleChange,
  getToken,
}: {
  user: AdminUserRow
  expanded: boolean
  onToggle: () => void
  updatingId: string | null
  onRoleChange: (userId: string, role: string) => void
  getToken: () => Promise<string | null>
}) {
  return (
    <div
      className={cn(
        'rounded-2xl glass transition-all',
        expanded && 'shadow-glow-sm'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left pressable"
      >
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-ink truncate text-sm">{u.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <Pill variant={u.role === 'admin' ? 'sun' : u.role === 'editor' ? 'cyan' : 'ink'} size="sm">
              {u.role}
            </Pill>
            <span className="text-[10px] text-ink3 font-bold">
              ⭐ {u.favoritesCount} · 🔔 {u.pushSubscriptionsCount}
            </span>
          </div>
        </div>
        <div className="text-ink3">
          {expanded ? <ChevronUp className="h-5 w-5" strokeWidth={2.5} /> : <ChevronDown className="h-5 w-5" strokeWidth={2.5} />}
        </div>
      </button>

      {expanded && u.role !== 'admin' && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink2">Rôle :</span>
            <select
              value={u.role}
              onChange={(e) => onRoleChange(u.id, e.target.value)}
              disabled={updatingId === u.id}
              className="rounded-xl glass px-3 py-1.5 text-sm font-bold text-ink"
            >
              <option value="user" className="bg-bg-deep">user</option>
              <option value="editor" className="bg-bg-deep">editor</option>
            </select>
            {updatingId === u.id && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </div>
          <ClearNotificationsButton userId={u.id} getToken={getToken} />
        </div>
      )}
    </div>
  )
}

function ClearNotificationsButton({
  userId,
  getToken,
}: {
  userId: string
  getToken: () => Promise<string | null>
}) {
  const queryClient = useQueryClient()
  const [clearing, setClearing] = useState(false)

  async function handleClear() {
    if (!confirm('Supprimer tous les abonnements et paramètres notifications ?')) return
    setClearing(true)
    try {
      const token = await getToken()
      if (!token) return
      await api.clearUserNotifications(userId, token)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } finally {
      setClearing(false)
    }
  }

  return (
    <Button
      variant="danger"
      size="sm"
      onClick={handleClear}
      disabled={clearing}
      iconLeft={clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" strokeWidth={2.5} />}
    >
      Reset notifs
    </Button>
  )
}

// ── Role config section ─────────────────────────────────────────────────

function RoleConfigSection({ role }: { role: 'user' | 'editor' }) {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const queryClient = useQueryClient()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['role-config'],
    queryFn: () => api.getRoleConfig(),
    staleTime: 30_000,
  })

  const config = configs.find((c) => c.role === role)

  const [maxFavorites, setMaxFavorites] = useState<number>(0)
  const [maxPushFavorites, setMaxPushFavorites] = useState<number>(0)
  const [maxPushNotifications, setMaxPushNotifications] = useState<number>(0)
  const [showAlertsPage, setShowAlertsPage] = useState(false)
  const [showLivePage, setShowLivePage] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) {
      setMaxFavorites(config.maxFavorites)
      setMaxPushFavorites(config.maxPushFavorites)
      setMaxPushNotifications(config.maxPushNotifications)
      setShowAlertsPage(config.showAlertsPage)
      setShowLivePage(config.showLivePage)
    }
  }, [config])

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const update: RoleConfigUpdate = {
        maxFavorites,
        maxPushFavorites,
        maxPushNotifications,
        showAlertsPage,
        showLivePage,
      }
      await api.updateRoleConfig(role, update, session.access_token)
      queryClient.invalidateQueries({ queryKey: ['role-config'] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant="glass" className="animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-btn-cyan text-white shadow-glow-cyan">
          <SettingsIcon className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="font-extrabold text-ink">Config "{role}"</h2>
          <p className="text-xs text-ink3 font-bold">Limites et fonctionnalités</p>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
      ) : !config ? (
        <p className="text-sm text-ink2">Aucune config</p>
      ) : (
        <div className="space-y-3">
          <NumField label="Max favoris" value={maxFavorites} onChange={setMaxFavorites} icon={<Star className="h-4 w-4" />} />
          <NumField label="Max favoris avec notifs" value={maxPushFavorites} onChange={setMaxPushFavorites} icon={<Bell className="h-4 w-4" />} />
          <NumField label="Max notifs / jour" value={maxPushNotifications} onChange={setMaxPushNotifications} icon={<Bell className="h-4 w-4" />} />
          <ToggleField label="Page Alertes" value={showAlertsPage} onChange={setShowAlertsPage} />
          <ToggleField label="Page Live" value={showLivePage} onChange={setShowLivePage} />
          <Button
            variant="primary"
            size="md"
            disabled={saving}
            onClick={handleSave}
            className="w-full"
            iconLeft={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Enregistrer
          </Button>
        </div>
      )}
    </Card>
  )
}

function NumField({
  label,
  value,
  onChange,
  icon,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl glass p-3">
      <div className="flex items-center gap-2 text-ink2">
        {icon}
        <span className="text-sm font-bold">{label}</span>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-xl glass-strong px-3 py-1.5 text-sm font-extrabold text-ink text-center focus:outline-none focus:shadow-glow-sm"
      />
    </div>
  )
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl glass p-3 cursor-pointer">
      <span className="text-sm font-bold text-ink">{label}</span>
      <div
        className={cn(
          'relative h-7 w-12 rounded-pill transition-colors shrink-0',
          value ? 'bg-btn-primary shadow-glow-sm' : 'bg-line'
        )}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </div>
    </label>
  )
}
