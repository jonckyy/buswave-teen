import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

/**
 * Same-origin proxy for admin API calls.
 * /api/admin/* → Railway /api/admin/*
 */

type RouteContext = { params: { path: string[] } }

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path)
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path)
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path)
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path)
}

async function proxy(req: NextRequest, path: string[]) {
  const subPath = path.join('/')
  const url = `${API_BASE}/api/admin/${subPath}`

  const headers: Record<string, string> = {}
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  const ct = req.headers.get('content-type')
  if (ct) headers['Content-Type'] = ct

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    })

    const data = await upstream.text()
    if (!upstream.ok) {
      console.error(`[admin-proxy] ${req.method} ${url} → ${upstream.status}: ${data.slice(0, 200)}`)
    }

    return new NextResponse(data, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[admin-proxy] ${req.method} ${url} → fetch error: ${msg}`)
    return NextResponse.json({ error: `Proxy error: ${msg}` }, { status: 502 })
  }
}
