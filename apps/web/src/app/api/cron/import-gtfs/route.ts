import { NextResponse } from 'next/server'

/**
 * Vercel cron job — triggers weekly GTFS import.
 * Secured by CRON_SECRET env var (set in Vercel dashboard).
 * Schedule: every Monday at 03:00 UTC (see vercel.json).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Trigger the import on the API service
  const apiUrl = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL']
  if (!apiUrl) {
    return NextResponse.json({ error: 'API URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${apiUrl}/internal/import-gtfs`, {
      method: 'POST',
      headers: { 'x-internal-secret': process.env['INTERNAL_SECRET'] ?? '' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Import trigger failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, triggered: new Date().toISOString() })
  } catch (err) {
    console.error('GTFS cron error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
