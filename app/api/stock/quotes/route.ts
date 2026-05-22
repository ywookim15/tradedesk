import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

export const dynamic = 'force-dynamic'

// GET /api/stock/quotes?symbols=AAPL,MSFT,TSLA
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('symbols') ?? ''
  const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

  if (!symbols.length) {
    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 })
  }

  try {
    type Q = {
      symbol?: string; shortName?: string; longName?: string
      regularMarketPrice?: number; regularMarketChange?: number
      regularMarketChangePercent?: number; regularMarketVolume?: number; marketCap?: number
    }
    const rawResult = await yahooFinance.quote(symbols) as unknown as Q[]
    const list = Array.isArray(rawResult) ? rawResult : [rawResult]

    const result = list.map((q) => ({
      ticker:        q.symbol                     ?? '',
      name:          q.shortName ?? q.longName    ?? q.symbol ?? '',
      price:         q.regularMarketPrice         ?? 0,
      change:        q.regularMarketChange        ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      volume:        q.regularMarketVolume        ?? 0,
      marketCap:     q.marketCap                  ?? 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/stock/quotes]', err)
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}
