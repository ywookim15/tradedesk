import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  const key = process.env.FINNHUB_API_KEY
  if (!key) return NextResponse.json({ error: 'Finnhub not configured' }, { status: 503 })

  const to   = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fmt  = (d: Date) => d.toISOString().split('T')[0]

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`,
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Finnhub request failed' }, { status: 502 })
    }

    type NewsItem = {
      datetime: number; headline: string; source: string
      url: string; summary: string; image: string
    }
    const news = (await res.json()) as NewsItem[]

    // Return latest 10, deduplicated by headline
    const seen = new Set<string>()
    const unique = news
      .filter((n) => n.headline && n.url && !seen.has(n.headline) && seen.add(n.headline))
      .slice(0, 10)

    return NextResponse.json(unique)
  } catch (err) {
    console.error('[/api/stock/news]', err)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
