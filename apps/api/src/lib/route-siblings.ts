/**
 * Route sibling resolver — TEC GTFS creates multiple route_ids for the same
 * physical line (one per calendar period). This module resolves all siblings
 * sharing the same (route_short_name, route_long_name) so that arrivals,
 * vehicles, and notifications match regardless of which period variant is active.
 *
 * Cache is in-memory and never expires (routes table is static, only changes on GTFS reimport).
 */

import { supabase } from './supabase.js'

const siblingCache = new Map<string, Set<string>>()

/**
 * Returns the set of all route_ids that share the same short_name + long_name
 * as the given routeId (including itself).
 */
export async function getRouteSiblings(routeId: string): Promise<Set<string>> {
  const cached = siblingCache.get(routeId)
  if (cached) return cached

  // Step 1: get the short_name + long_name for this route
  const { data: route } = await supabase
    .from('routes')
    .select('route_short_name, route_long_name')
    .eq('route_id', routeId)
    .single()

  if (!route) {
    const fallback = new Set([routeId])
    siblingCache.set(routeId, fallback)
    return fallback
  }

  // Step 2: find all routes with the same name pair
  const { data: siblings } = await supabase
    .from('routes')
    .select('route_id')
    .eq('route_short_name', (route as { route_short_name: string }).route_short_name)
    .eq('route_long_name', (route as { route_long_name: string }).route_long_name)

  const set = new Set((siblings ?? []).map((r) => (r as { route_id: string }).route_id))
  if (set.size === 0) set.add(routeId)

  // Cache for all siblings so any lookup hits the same set
  for (const id of set) siblingCache.set(id, set)

  return set
}
