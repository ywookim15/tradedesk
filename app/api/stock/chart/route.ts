import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'

const PERIOD_CONFIG = {
  '1d':  { days: 2,    interval: '5m'  as const },
  '5d':  { days: 7,    interval: '30m' as const },
  '1mo': { days: 35,   interval: '1d'  as const },
  '3mo': { days: 95,   interval: '1d'  as const },
  '6mo': { days: 185,  interval: '1d'  as const },
  '1y':  { days: 370,  interval: '1d'  as const },
  '5y':  { days: 1830, interval: '1wk' as const },
}

type Period = keyof typeof PERIOD_CONFIG

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  const period = (req.nextUrl.searchParams.get('period') ?? '1y') as Period

  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  const config = PERIOD_CONFIG[period] ?? PERIOD_CONFIG['1y']
  const intraday = period === '1d' || period === '5d'
  const to = new Date()
  const from = new Date(to.getTime() - config.days * 24 * 60 * 60 * 1000)

  try {
    const result = await yf.chart(symbol, {
      period1: from.toISOString().split('T')[0],
      interval: config.interval,
    })

    type Quote = { date: Date; open: number; high: number; low: number; close: number; volume: number | null }
    const quotes = (result.quotes ?? []).filter(
      (q): q is Quote => q != null && q.close != null && q.open != null,
    )

    const data = quotes.map((q) => ({
      time: intraday
        ? Math.floor(q.date.getTime() / 1000)
        : q.date.toISOString().split('T')[0],
      open:   q.open   ?? 0,
      high:   q.high   ?? 0,
      low:    q.low    ?? 0,
      close:  q.close  ?? 0,
      volume: q.volume ?? 0,
    }))

    return NextResponse.json({ symbol, period, intraday, data })
  } catch (err) {
    console.error('[/api/stock/chart]', err)
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 })
  }
}
