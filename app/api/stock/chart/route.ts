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

    // Require all four OHLC fields to be present and positive — null/zero values
    // cause wicks that spike to zero on the chart.
    const quotes = (result.quotes ?? []).filter(
      (q): q is Quote =>
        q != null &&
        q.open  != null && q.open  > 0 &&
        q.high  != null && q.high  > 0 &&
        q.low   != null && q.low   > 0 &&
        q.close != null && q.close > 0,
    )

    let data = quotes.map((q) => {
      const o = q.open, c = q.close
      return {
        time: intraday
          ? Math.floor(q.date.getTime() / 1000)
          : q.date.toISOString().split('T')[0],
        open:   o,
        high:   Math.max(q.high, o, c),  // high ≥ body top
        low:    Math.min(q.low,  o, c),  // low  ≤ body bottom
        close:  c,
        volume: q.volume ?? 0,
      }
    })

    // ── Fix 1 (intraday): strip extended-hours bars ───────────────────────────
    // Yahoo Finance includes pre-market and after-hours bars in intraday data.
    // These bars routinely carry stale high/low values from other sessions
    // (e.g. the same `low: 297.46` appears across every after-hours bar even
    // though the stock never traded there during that bar).
    // Keep only NYSE/NASDAQ regular session: 9:30 AM – 4:00 PM Eastern.
    if (intraday) {
      data = data.filter((d) => {
        const ts   = d.time as number
        const date = new Date(ts * 1000)
        // Approximate DST: EDT (UTC−4) April–October, EST (UTC−5) otherwise
        const mo     = date.getUTCMonth()          // 0 = Jan
        const offset = mo >= 3 && mo <= 9 ? -4 : -5
        const localMin =
          ((date.getUTCHours() + 24 + offset) % 24) * 60 +
          date.getUTCMinutes()
        // 9:30 AM = 570 min, 4:00 PM = 960 min
        return localMin >= 570 && localMin < 960
      })
    }

    // ── Fix 2 (all timeframes): rolling-median wick clamp ────────────────────
    // Catches split-price inconsistencies (e.g. unadjusted high/low against
    // adjusted open/close) and any other outlier values that survive Fix 1.
    // Uses a ±10-bar rolling median so the cap adapts to trending prices.
    if (data.length >= 3) {
      const closes = data.map((d) => d.close)
      data = data.map((d, i) => {
        const start = Math.max(0, i - 10)
        const end   = Math.min(closes.length, i + 11)
        const s     = closes.slice(start, end).sort((a, b) => a - b)
        const med   = s[Math.floor(s.length / 2)] || d.close || 1
        return {
          ...d,
          high: Math.min(d.high, med * 2.0),   // high ≤ 2× local median
          low:  Math.max(d.low,  med * 0.5),   // low  ≥ 50% of local median
        }
      })
    }

    return NextResponse.json({ symbol, period, intraday, data })
  } catch (err) {
    console.error('[/api/stock/chart]', err)
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 })
  }
}
