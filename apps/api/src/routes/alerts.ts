import { Hono } from 'hono'
import { getAlerts } from '../lib/gtfs-rt.js'
import { supabase } from '../lib/supabase.js'
import type { Alert, ApiResponse } from '@buswave/shared'

export const alertsRouter = new Hono()

/** GET /api/realtime/alerts */
alertsRouter.get('/', async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feed: any = await getAlerts()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = entities
    .filter((e: any) => e.alert)
    .map((e: any) => {
      const a = e.alert
      const header =
        a.headerText?.translation?.find((t: any) => t.language === 'fr')?.text ??
        a.headerText?.translation?.[0]?.text ??
        ''
      const description =
        a.descriptionText?.translation?.find((t: any) => t.language === 'fr')?.text ??
        a.descriptionText?.translation?.[0]?.text ??
        ''

      const routeIds: string[] = (a.informedEntity ?? [])
        .filter((ie: any) => ie.routeId)
        .map((ie: any) => ie.routeId as string)

      const stopIds: string[] = (a.informedEntity ?? [])
        .filter((ie: any) => ie.stopId)
        .map((ie: any) => ie.stopId as string)

      const period = a.activePeriod?.[0]

      return {
        id: e.id,
        cause: a.cause,
        effect: a.effect,
        headerText: header,
        descriptionText: description,
        activePeriodStart: period?.start ?? undefined,
        activePeriodEnd: period?.end ?? undefined,
        routeIds,
        stopIds,
      }
    })

  // Resolve route_short_names for all routeIds
  const allRouteIds = [...new Set(parsed.flatMap((a) => a.routeIds))]
  const routeNameMap = new Map<string, string>()
  if (allRouteIds.length > 0) {
    const { data } = await supabase
      .from('routes')
      .select('route_id, route_short_name')
      .in('route_id', allRouteIds)
    for (const r of (data ?? []) as { route_id: string; route_short_name: string }[]) {
      routeNameMap.set(r.route_id, r.route_short_name)
    }
  }

  const alerts: Alert[] = parsed.map((a) => ({
    ...a,
    routeShortNames: [...new Set(a.routeIds.map((id) => routeNameMap.get(id)).filter(Boolean) as string[])],
  }))

  return c.json({ data: alerts } satisfies ApiResponse<Alert[]>)
})
