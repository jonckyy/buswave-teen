import { Hono } from 'hono'
import { getAlerts } from '../lib/gtfs-rt.js'
import type { Alert, ApiResponse } from '@buswave/shared'

export const alertsRouter = new Hono()

/** GET /api/realtime/alerts */
alertsRouter.get('/', async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feed: any = await getAlerts()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = feed?.entity ?? []

  const alerts: Alert[] = entities
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
      } satisfies Alert
    })

  return c.json({ data: alerts } satisfies ApiResponse<Alert[]>)
})
