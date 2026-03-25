import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

/**
 * Same-origin proxy for authenticated notification API calls.
 * Avoids cross-origin requests that Brave Shields / Safari ITP may block.
 *
 * /api/notifications/* → Railway /api/notifications/*
 */

// Next.js 14: params is a plain object, not a Promise
type RouteContext = { params: { path: string[] } }

// Debug: test auth flow on Railway using user's real token
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 })
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  // Special debug route: /api/notifications/debug-auth
  if (ctx.params.path[0] === 'debug-auth') {
    return debugAuth(req)
  }
  return proxy(req, ctx.params.path)
}

async function debugAuth(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'No auth header' }, { status: 401 })

  const url = `${API_BASE}/debug/auth-test`
  try {
    const upstream = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      cache: 'no-store',
    })
    const data = await upstream.text()
    return new NextResponse(data, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return NextResponse.json({ error: `Debug fetch failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path)
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path)
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path)
}

async function proxy(req: NextRequest, path: string[]) {
  const subPath = path.join('/')
  const url = `${API_BASE}/api/notifications/${subPath}`

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

    // Log non-2xx for debugging — include base URL to verify env var
    if (!upstream.ok) {
      console.error(`[proxy] ${req.method} ${url} → ${upstream.status}: ${data.slice(0, 200)}`)
    }
    // Add debug header so we can verify the proxy target
    const respHeaders: Record<string, string> = {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'X-Proxy-Target': API_BASE.slice(0, 50),
      'X-Proxy-Status': String(upstream.status),
    }

    return new NextResponse(data, {
      status: upstream.status,
      headers: respHeaders,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[proxy] ${req.method} ${url} → fetch error: ${msg}`)
    return NextResponse.json(
      { error: `Proxy error: ${msg}` },
      { status: 502 }
    )
  }
}
