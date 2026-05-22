import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

export const dynamic = 'force-dynamic'

// Curated large-cap pool — ranked by % change each request
const POOL = [
  'AAPL','MSFT','NVDA','TSLA','META','AMZN','GOOGL','NFLX',
  'AMD','INTC','COIN','PLTR','SOFI','UBER','BABA','JPM',
  'BAC','GS','XOM','CVX','JNJ','WMT','COST','DIS','PYPL',
  'SMCI','MU','ARM','AVGO','QCOM',
]

export async function GET() {
  try {
    type Q = {
      symbol?: string; shortName?: string; longName?: string
      regularMarketPrice?: number; regularMarketChange?: number
      regularMarketChangePercent?: number
    }
    const quotes = await yahooFinance.quote(POOL) as unknown as Q[]

    const valid = (Array.isArray(quotes) ? quotes : [quotes]).filter(
      (q) =>
        q &&
        typeof q.regularMarketChangePercent === 'number' &&
        typeof q.regularMarketPrice === 'number',
    )

    const sorted = [...valid].sort(
      (a, b) =>
        (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0),
    )

    const format = (q: Q) => ({
      symbol:        q.symbol                    ?? '',
      name:          q.shortName ?? q.longName   ?? q.symbol ?? '',
      price:         q.regularMarketPrice        ?? 0,
      change:        q.regularMarketChange       ?? 0,
      changePercent: q.regularMarketChangePercent?? 0,
    })

    return NextResponse.json({
      gainers: sorted.slice(0, 5).map(format),
      losers:  sorted.slice(-5).reverse().map(format),
    })
  } catch (err) {
    console.error('[/api/market/movers]', err)
    return NextResponse.json({ error: 'Failed to fetch movers' }, { status: 500 })
  }
}
