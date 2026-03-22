/**
 * GTFS import script — downloads TEC-GTFS.zip, parses all txt files,
 * and bulk-upserts into Supabase.
 *
 * Usage:
 *   bun run src/scripts/import-gtfs.ts
 *
 * Env required:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { createWriteStream, createReadStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import os from 'node:os'

const GTFS_ZIP_URL = 'https://opendata.tec-wl.be/Current%20GTFS/TEC-GTFS.zip'
const CHUNK_SIZE = 1000 // rows per upsert batch

// ── Supabase client ─────────────────────────────────────────────────────────

const supabase = createClient(
  process.env['SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_KEY'] ?? ''
)

// ── Download + Unzip ────────────────────────────────────────────────────────

async function downloadAndExtract(): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `tec-gtfs-${Date.now()}`)
  await mkdir(tmpDir, { recursive: true })

  const zipPath = path.join(tmpDir, 'TEC-GTFS.zip')
  console.log(`⬇  Downloading GTFS zip from TEC…`)

  const res = await fetch(GTFS_ZIP_URL)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const writer = createWriteStream(zipPath)
  await pipeline(res.body as unknown as NodeJS.ReadableStream, writer)
  console.log(`✓  Downloaded to ${zipPath}`)

  // Unzip using the system unzip command (available on most servers)
  const extractDir = path.join(tmpDir, 'extracted')
  await mkdir(extractDir, { recursive: true })

  const proc = Bun.spawn(['unzip', '-o', zipPath, '-d', extractDir])
  await proc.exited
  console.log(`✓  Extracted to ${extractDir}`)

  return extractDir
}

// ── CSV parser (minimal, handles quoted fields) ─────────────────────────────

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  const headers = (lines[0] ?? '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line?.trim()) continue

    // Simple CSV split — handles basic quoting
    const values: string[] = []
    let cur = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        values.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    values.push(cur.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    rows.push(row)
  }

  return rows
}

// ── Batch upsert helper ─────────────────────────────────────────────────────

async function batchUpsert(table: string, rows: Record<string, unknown>[], onConflict: string) {
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict })
    if (error) {
      console.error(`  ✗ Error upserting ${table} chunk ${i}:`, error.message)
    } else {
      inserted += chunk.length
    }
  }
  return inserted
}

// ── Importers ───────────────────────────────────────────────────────────────

async function importRoutes(dir: string) {
  console.log('→ routes.txt')
  const content = await Bun.file(path.join(dir, 'routes.txt')).text()
  const rows = parseCsv(content).map((r) => ({
    route_id: r['route_id'],
    agency_id: r['agency_id'] ?? null,
    route_short_name: r['route_short_name'] ?? '',
    route_long_name: r['route_long_name'] ?? '',
    route_type: Number(r['route_type'] ?? 3),
    route_color: r['route_color'] || null,
    route_text_color: r['route_text_color'] || null,
  }))
  const n = await batchUpsert('routes', rows, 'route_id')
  console.log(`  ✓ ${n} routes`)
}

async function importStops(dir: string) {
  console.log('→ stops.txt')
  const content = await Bun.file(path.join(dir, 'stops.txt')).text()
  const rows = parseCsv(content).map((r) => ({
    stop_id: r['stop_id'],
    stop_name: r['stop_name'] ?? '',
    stop_lat: Number(r['stop_lat']),
    stop_lon: Number(r['stop_lon']),
    stop_code: r['stop_code'] || null,
    location_type: r['location_type'] ? Number(r['location_type']) : 0,
    parent_station: r['parent_station'] || null,
  }))
  const n = await batchUpsert('stops', rows, 'stop_id')
  console.log(`  ✓ ${n} stops`)
}

async function importTrips(dir: string) {
  console.log('→ trips.txt')
  const content = await Bun.file(path.join(dir, 'trips.txt')).text()
  const rows = parseCsv(content).map((r) => ({
    trip_id: r['trip_id'],
    route_id: r['route_id'],
    service_id: r['service_id'],
    trip_headsign: r['trip_headsign'] || null,
    direction_id: r['direction_id'] !== '' ? Number(r['direction_id']) : null,
    shape_id: r['shape_id'] || null,
  }))
  const n = await batchUpsert('trips', rows, 'trip_id')
  console.log(`  ✓ ${n} trips`)
}

async function importStopTimes(dir: string) {
  console.log('→ stop_times.txt (large file — this may take a while)')
  const content = await Bun.file(path.join(dir, 'stop_times.txt')).text()
  const rows = parseCsv(content).map((r) => ({
    trip_id: r['trip_id'],
    stop_id: r['stop_id'],
    stop_sequence: Number(r['stop_sequence']),
    arrival_time: r['arrival_time'] ?? '',
    departure_time: r['departure_time'] ?? '',
    shape_dist_traveled: r['shape_dist_traveled'] ? Number(r['shape_dist_traveled']) : null,
  }))
  const n = await batchUpsert('stop_times', rows, 'trip_id,stop_sequence')
  console.log(`  ✓ ${n} stop_times`)
}

async function importShapes(dir: string) {
  console.log('→ shapes.txt')
  const content = await Bun.file(path.join(dir, 'shapes.txt')).text()
  const rows = parseCsv(content).map((r) => ({
    shape_id: r['shape_id'],
    shape_pt_lat: Number(r['shape_pt_lat']),
    shape_pt_lon: Number(r['shape_pt_lon']),
    shape_pt_sequence: Number(r['shape_pt_sequence']),
    shape_dist_traveled: r['shape_dist_traveled'] ? Number(r['shape_dist_traveled']) : null,
  }))
  const n = await batchUpsert('shapes', rows, 'shape_id,shape_pt_sequence')
  console.log(`  ✓ ${n} shapes`)
}

async function importCalendar(dir: string) {
  console.log('→ calendar.txt')
  const content = await Bun.file(path.join(dir, 'calendar.txt')).text()
  const rows = parseCsv(content).map((r) => ({
    service_id: r['service_id'],
    monday: r['monday'] === '1',
    tuesday: r['tuesday'] === '1',
    wednesday: r['wednesday'] === '1',
    thursday: r['thursday'] === '1',
    friday: r['friday'] === '1',
    saturday: r['saturday'] === '1',
    sunday: r['sunday'] === '1',
    start_date: r['start_date'] ?? '',
    end_date: r['end_date'] ?? '',
  }))
  const n = await batchUpsert('calendar', rows, 'service_id')
  console.log(`  ✓ ${n} calendar entries`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚌 BusWave GTFS Import — TEC Network\n')

  if (!process.env['SUPABASE_URL'] || !process.env['SUPABASE_SERVICE_KEY']) {
    console.error('✗ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set')
    process.exit(1)
  }

  const extractDir = await downloadAndExtract()

  try {
    // Order matters — FK constraints: routes → trips → stop_times / shapes
    await importRoutes(extractDir)
    await importStops(extractDir)
    await importTrips(extractDir)
    await importShapes(extractDir)
    await importStopTimes(extractDir)
    await importCalendar(extractDir)

    console.log('\n✅ GTFS import complete!')
  } finally {
    await rm(path.dirname(extractDir), { recursive: true, force: true })
    console.log('  Cleaned up temp files.')
  }
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
