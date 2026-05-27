import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'

/**
 * Timeframe = the candlestick bar interval.
 * Each entry maps to a Yahoo Finance interval + a lookback window in days.
 *
 * Yahoo Finance interval availability:
 *   1m  → last 7 days
 *   2m  → last 60 days
 *   5m  → last 60 days
 *   15m → last 60 days
 *   30m → last 60 days
 *   60m → last 730 days
 *   1d  → unlimited
 *   1wk → unlimited
 *   1mo → unlimited
 */
const PERIOD_CONFIG = {
  // ── intraday ──────────────────────────────────────────────────────────────
  '1min':  { days: 5,    interval: '1m'  as const, intraday: true  },
  '3min':  { days: 5,    interval: '2m'  as const, intraday: true  },
  '5min':  { days: 30,   interval: '5m'  as const, intraday: true  },
  '15min': { days: 45,   interval: '15m' as const, intraday: true  },
  '30min': { days: 55,   interval: '30m' as const, intraday: true  },
  '1h':    { days: 180,  interval: '60m' as const, intraday: true  },
  // ── daily / weekly / monthly ──────────────────────────────────────────────
  '1d':    { days: 2,    interval: '5m'  as const, intraday: true  }, // legacy period key
  '5d':    { days: 7,    interval: '30m' as const, intraday: true  }, // legacy
  '1day':  { days: 1825, interval: '1d'  as const, intraday: false }, // 5 years of daily
  '1week': { days: 3650, interval: '1wk' as const, intraday: false }, // 10 years of weekly
  '1mo':   { days: 35,   interval: '1d'  as const, intraday: false }, // legacy period key
  '3mo':   { days: 95,   interval: '1d'  as const, intraday: false }, // legacy
  '6mo':   { days: 185,  interval: '1d'  as const, intraday: false }, // legacy
  '1y':    { days: 370,  interval: '1d'  as const, intraday: false }, // legacy
  '5y':    { days: 1830, interval: '1wk' as const, intraday: false }, // legacy
  '1month':{ days: 3650, interval: '1mo' as const, intraday: false }, // monthly bars
  'all':   { days: 7300, interval: '1mo' as const, intraday: false }, // all time
}

type Period = keyof typeof PERIOD_CONFIG

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  const period = (req.nextUrl.searchParams.get('period') ?? '1y') as Period

  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  const config  = PERIOD_CONFIG[period] ?? PERIOD_CONFIG['1y']
  const intraday = config.intraday
  const to   = new Date()
  const from = new Date(to.getTime() - config.days * 24 * 60 * 60 * 1000)

  try {
    const result = await yf.chart(symbol, {
      period1:  from.toISOString().split('T')[0],
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
