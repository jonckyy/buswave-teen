import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

/**
 * Same-origin proxy for authenticated notification API calls.
 * Avoids cross-origin requests that Brave Shields / Safari ITP may block.
 *
 * /api/notifications/* → Railway /api/notifications/*
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params)
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params)
}

async function proxy(req: NextRequest, { path }: { path: string[] }) {
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

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
    cache: 'no-store',
  })

  const data = await upstream.text()
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  })
}
