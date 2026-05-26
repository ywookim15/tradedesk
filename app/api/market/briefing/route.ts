import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'

const INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA', '^VIX']

type RawQ = {
  symbol?: string
  shortName?: string
  longName?: string
  regularMarketPrice?: number
  regularMarketChangePercent?: number
  regularMarketChange?: number
  regularMarketVolume?: number
  averageDailyVolume3Month?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
}

export type WatchlistAlert = {
  ticker: string
  name: string
  price: number
  changePercent: number
  reasons: string[]
}

export type BriefingData = {
  mood: 'risk-on' | 'mixed' | 'risk-off' | 'flat'
  moodLabel: string
  moodDescription: string
  moodColor: string
  indices: { symbol: string; name: string; changePercent: number }[]
  alerts: WatchlistAlert[]
  stockOfDay: WatchlistAlert | null
  generatedAt: string
}

function getMoodFromIndices(
  spyChg: number | null,
  qqqChg: number | null,
  vixChg: number | null,
): { mood: BriefingData['mood']; label: string; description: string; color: string } {
  const sp = spyChg ?? 0
  const qq = qqqChg ?? 0
  const vx = vixChg ?? 0

  // Risk-on: indices up, VIX down
  if (sp > 0.5 && qq > 0.5 && vx < 5) {
    return {
      mood: 'risk-on',
      label: '📈 Risk-On',
      description: `Markets are advancing broadly today — S&P 500 ${sp >= 0 ? '+' : ''}${sp.toFixed(2)}%, NASDAQ ${qq >= 0 ? '+' : ''}${qq.toFixed(2)}%. Conditions favor momentum and growth plays.`,
      color: '#00C896',
    }
  }
  // Risk-off: indices down, VIX spiking
  if (sp < -0.5 && qq < -0.5) {
    return {
      mood: 'risk-off',
      label: '📉 Risk-Off',
      description: `Markets are under pressure — S&P 500 ${sp.toFixed(2)}%, NASDAQ ${qq.toFixed(2)}%${vx > 10 ? ', VIX spiking' : ''}. Defensive positioning and cash are reasonable here.`,
      color: '#FF4D4D',
    }
  }
  // Flat: small moves in both directions
  if (Math.abs(sp) < 0.2 && Math.abs(qq) < 0.2) {
    return {
      mood: 'flat',
      label: '→ Flat / Consolidating',
      description: `Markets are largely unchanged — S&P 500 ${sp >= 0 ? '+' : ''}${sp.toFixed(2)}%. Low conviction day; wait for direction before committing size.`,
      color: '#8A99B3',
    }
  }
  // Mixed
  const leaderSign = sp >= 0 ? '+' : ''
  return {
    mood: 'mixed',
    label: '〜 Mixed Signals',
    description: `Mixed market action — S&P 500 ${leaderSign}${sp.toFixed(2)}%, NASDAQ ${qq >= 0 ? '+' : ''}${qq.toFixed(2)}%. Sector rotation is in play; focus on relative strength.`,
    color: '#F59E0B',
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── 1. Fetch index quotes ──────────────────────────────────────────────
    let spyChg: number | null = null
    let qqqChg: number | null = null
    let vixChg: number | null = null
    const indicesSummary: BriefingData['indices'] = []

    try {
      const rawIdx = await yf.quote(INDEX_SYMBOLS) as unknown as RawQ | RawQ[]
      const idxList = Array.isArray(rawIdx) ? rawIdx : [rawIdx]
      for (const q of idxList) {
        const sym = q.symbol ?? ''
        const chg = q.regularMarketChangePercent ?? 0
        if (sym === 'SPY') spyChg = chg
        if (sym === 'QQQ') qqqChg = chg
        if (sym === '^VIX') vixChg = chg
        indicesSummary.push({
          symbol: sym,
          name: sym === '^VIX' ? 'VIX' : (q.shortName ?? sym),
          changePercent: chg,
        })
      }
    } catch { /* non-fatal */ }

    const moodInfo = getMoodFromIndices(spyChg, qqqChg, vixChg)

    // ── 2. Fetch user's watchlist ──────────────────────────────────────────
    const { data: watchlistRows } = await supabase
      .from('watchlist').select('ticker').eq('user_id', user.id)
    const watchTickers = (watchlistRows ?? []).map((r: { ticker: string }) => r.ticker)

    const alerts: WatchlistAlert[] = []
    let stockOfDay: WatchlistAlert | null = null

    if (watchTickers.length > 0) {
      try {
        const rawW = await yf.quote(watchTickers) as unknown as RawQ | RawQ[]
        const wList = Array.isArray(rawW) ? rawW : [rawW]

        for (const q of wList) {
          if (!q.symbol || !q.regularMarketPrice) continue
          const ticker = q.symbol
          const price = q.regularMarketPrice
          const chgPct = q.regularMarketChangePercent ?? 0
          const volume = q.regularMarketVolume ?? 0
          const avgVol = q.averageDailyVolume3Month ?? 0
          const high52 = q.fiftyTwoWeekHigh ?? 0
          const low52  = q.fiftyTwoWeekLow  ?? 0
          const name   = q.shortName ?? q.longName ?? ticker

          const reasons: string[] = []

          // Big move
          if (Math.abs(chgPct) >= 2) {
            reasons.push(`${chgPct >= 0 ? '↑' : '↓'} ${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(1)}% today`)
          }
          // Unusual volume (>150% of average)
          if (avgVol > 0 && volume > avgVol * 1.5) {
            const ratio = (volume / avgVol).toFixed(1)
            reasons.push(`${ratio}× normal volume`)
          }
          // Near 52W high (within 2%)
          if (high52 > 0 && price >= high52 * 0.98) {
            reasons.push(`Near 52W high ($${high52.toFixed(2)})`)
          }
          // Near 52W low (within 5%)
          if (low52 > 0 && price <= low52 * 1.05) {
            reasons.push(`Near 52W low ($${low52.toFixed(2)})`)
          }

          if (reasons.length > 0) {
            alerts.push({ ticker, name, price, changePercent: chgPct, reasons })
          }
        }

        // Sort alerts by abs move then volume signal
        alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))

        // Stock of day: biggest absolute mover in watchlist
        const sortedByMove = wList
          .filter(q => q.regularMarketPrice && q.symbol)
          .sort((a, b) => Math.abs(b.regularMarketChangePercent ?? 0) - Math.abs(a.regularMarketChangePercent ?? 0))

        if (sortedByMove.length > 0) {
          const q = sortedByMove[0]
          const chgPct = q.regularMarketChangePercent ?? 0
          const volume = q.regularMarketVolume ?? 0
          const avgVol = q.averageDailyVolume3Month ?? 0
          const high52 = q.fiftyTwoWeekHigh ?? 0
          const reasons: string[] = []
          reasons.push(`${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(1)}% move today`)
          if (avgVol > 0 && volume > avgVol * 1.3) reasons.push(`${(volume / avgVol).toFixed(1)}× avg volume`)
          if (q.regularMarketPrice && high52 > 0 && q.regularMarketPrice >= high52 * 0.95) reasons.push('approaching 52W high')
          stockOfDay = {
            ticker:        q.symbol ?? '',
            name:          q.shortName ?? q.longName ?? q.symbol ?? '',
            price:         q.regularMarketPrice ?? 0,
            changePercent: chgPct,
            reasons,
          }
        }
      } catch { /* non-fatal */ }
    }

    const briefing: BriefingData = {
      mood:            moodInfo.mood,
      moodLabel:       moodInfo.label,
      moodDescription: moodInfo.description,
      moodColor:       moodInfo.color,
      indices:         indicesSummary,
      alerts,
      stockOfDay,
      generatedAt:     new Date().toISOString(),
    }

    return NextResponse.json(briefing)
  } catch (err) {
    console.error('[/api/market/briefing]', err)
    return NextResponse.json({ error: 'Briefing failed' }, { status: 500 })
  }
}
