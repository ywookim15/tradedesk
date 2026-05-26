import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// 30 well-known S&P 500 stocks available for default scanning
const SP500_DEFAULTS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'NFLX',
  'JPM', 'V', 'MA', 'BAC', 'GS',
  'JNJ', 'UNH', 'PFE', 'MRK',
  'XOM', 'CVX',
  'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE',
  'WMT', 'COST', 'HD',
  'DIS', 'T', 'CMCSA',
]

// ── Math utilities ─────────────────────────────────────────────────────────────

function smaArr(data: number[], n: number): number[] {
  return data.map((_, i) => {
    if (i < n - 1) return NaN
    return data.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n
  })
}

function emaArr(data: number[], n: number): (number | null)[] {
  const k = 2 / (n + 1)
  const out: (number | null)[] = Array(data.length).fill(null)
  if (data.length < n) return out
  let val = data.slice(0, n).reduce((a, b) => a + b, 0) / n
  out[n - 1] = val
  for (let i = n; i < data.length; i++) {
    val = data[i] * k + val * (1 - k)
    out[i] = val
  }
  return out
}

function calcRSI(closes: number[], n = 14): number | null {
  if (closes.length <= n) return null
  const ch = closes.slice(1).map((c, i) => c - closes[i])
  let ag = ch.slice(0, n).reduce((a, c) => a + Math.max(c, 0), 0) / n
  let al = ch.slice(0, n).reduce((a, c) => a + Math.max(-c, 0), 0) / n
  for (let i = n; i < ch.length; i++) {
    ag = (ag * (n - 1) + Math.max(ch[i], 0)) / n
    al = (al * (n - 1) + Math.max(-ch[i], 0)) / n
  }
  return 100 - 100 / (1 + ag / (al || 1e-9))
}

function hasMACDCrossover(closes: number[], type: 'bullish' | 'bearish', lookback = 3): boolean {
  if (closes.length < 35) return false
  const eFast = emaArr(closes, 12)
  const eSlow = emaArr(closes, 26)
  const macdLine = closes.map((_, i) =>
    eFast[i] != null && eSlow[i] != null ? eFast[i]! - eSlow[i]! : null
  )
  const vi = macdLine.findIndex((v) => v != null)
  if (vi < 0) return false
  const sigFull = emaArr(macdLine.slice(vi) as number[], 9)
  const signalLine: (number | null)[] = [...Array(vi).fill(null), ...sigFull]
  const histogram = closes.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? macdLine[i]! - signalLine[i]! : null
  )
  const n = closes.length
  for (let i = Math.max(1, n - lookback); i < n; i++) {
    const h = histogram[i], hPrev = histogram[i - 1]
    if (h == null || hPrev == null) continue
    if (type === 'bullish' && h > 0 && hPrev <= 0) return true
    if (type === 'bearish' && h < 0 && hPrev >= 0) return true
  }
  return false
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type FilterType =
  | 'rsi_below' | 'rsi_above'
  | 'price_above_sma50' | 'price_below_sma50'
  | 'price_above_sma200' | 'price_below_sma200'
  | 'macd_bullish' | 'macd_bearish'
  | 'volume_spike'
  | 'near_52w_high' | 'near_52w_low'
  | 'pe_below' | 'eps_positive'

export type FilterCriterion = { type: FilterType; value?: number }

export type ScanResult = {
  ticker: string
  name: string
  price: number
  changePercent: number
  matchedFilters: string[]
  rsi: number | null
  sma50Dev: number | null
  sma200Dev: number | null
  week52High: number | null
  week52Low: number | null
  pe: number | null
  eps: number | null
  volumeRatio: number | null
}

const TECHNICAL_TYPES = new Set<FilterType>([
  'rsi_below', 'rsi_above',
  'price_above_sma50', 'price_below_sma50',
  'price_above_sma200', 'price_below_sma200',
  'macd_bullish', 'macd_bearish',
])

// ── Concurrency helper ─────────────────────────────────────────────────────────

async function chunk<T>(
  items: string[],
  size: number,
  fn: (t: string) => Promise<T>,
): Promise<(T | null)[]> {
  const out: (T | null)[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    const res = await Promise.allSettled(batch.map(fn))
    out.push(...res.map(r => r.status === 'fulfilled' ? r.value : null))
  }
  return out
}

// ── Fetch chart data for a single ticker ───────────────────────────────────────

async function fetchChart(ticker: string, days: number): Promise<number[]> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const result = await yf.chart(ticker, {
    period1: from.toISOString().split('T')[0],
    interval: '1d',
  })
  return (result.quotes ?? [])
    .filter((q) => q != null && typeof q.close === 'number' && q.close != null && q.close > 0)
    .map((q) => q.close as number)
}

// ── Apply filters to a ticker's data ──────────────────────────────────────────

function applyFilters(
  filters: FilterCriterion[],
  quoteData: {
    price: number; name: string; week52High: number | null; week52Low: number | null
    todayVolume: number; avgVolume: number; pe: number | null; eps: number | null
  },
  techData: {
    closes: number[]
    rsi: number | null; sma50Dev: number | null; sma200Dev: number | null
  },
): { matched: string[]; allPass: boolean } {
  const matched: string[] = []

  for (const f of filters) {
    let passes = false
    let label = ''

    const { price, week52High, week52Low, todayVolume, avgVolume, pe, eps } = quoteData
    const { rsi, sma50Dev, sma200Dev, closes } = techData

    switch (f.type) {
      case 'rsi_below': {
        const thr = f.value ?? 30
        if (rsi != null && rsi < thr) { passes = true; label = `RSI ${rsi.toFixed(1)} < ${thr}` }
        break
      }
      case 'rsi_above': {
        const thr = f.value ?? 70
        if (rsi != null && rsi > thr) { passes = true; label = `RSI ${rsi.toFixed(1)} > ${thr}` }
        break
      }
      case 'price_above_sma50':
        if (sma50Dev != null && sma50Dev > 0) { passes = true; label = `Price +${sma50Dev.toFixed(1)}% above SMA 50` }
        break
      case 'price_below_sma50':
        if (sma50Dev != null && sma50Dev < 0) { passes = true; label = `Price ${sma50Dev.toFixed(1)}% below SMA 50` }
        break
      case 'price_above_sma200':
        if (sma200Dev != null && sma200Dev > 0) { passes = true; label = `Price +${sma200Dev.toFixed(1)}% above SMA 200` }
        break
      case 'price_below_sma200':
        if (sma200Dev != null && sma200Dev < 0) { passes = true; label = `Price ${sma200Dev.toFixed(1)}% below SMA 200` }
        break
      case 'macd_bullish':
        if (hasMACDCrossover(closes, 'bullish', 3)) { passes = true; label = 'MACD bullish crossover (last 3 days)' }
        break
      case 'macd_bearish':
        if (hasMACDCrossover(closes, 'bearish', 3)) { passes = true; label = 'MACD bearish crossover (last 3 days)' }
        break
      case 'volume_spike': {
        const pctThresh = f.value ?? 50
        if (avgVolume > 0 && todayVolume > avgVolume * (1 + pctThresh / 100)) {
          const pct = ((todayVolume / avgVolume - 1) * 100).toFixed(0)
          passes = true; label = `Volume +${pct}% above 3-month avg`
        }
        break
      }
      case 'near_52w_high': {
        const thr = f.value ?? 2
        if (week52High != null && price >= week52High * (1 - thr / 100)) {
          passes = true; label = `Within ${thr}% of 52W High ($${week52High.toFixed(2)})`
        }
        break
      }
      case 'near_52w_low': {
        const thr = f.value ?? 5
        if (week52Low != null && price <= week52Low * (1 + thr / 100)) {
          passes = true; label = `Within ${thr}% of 52W Low ($${week52Low.toFixed(2)})`
        }
        break
      }
      case 'pe_below': {
        const thr = f.value ?? 20
        if (pe != null && pe > 0 && pe < thr) { passes = true; label = `P/E ${pe.toFixed(1)}x < ${thr}x` }
        break
      }
      case 'eps_positive':
        if (eps != null && eps > 0) { passes = true; label = `EPS $${eps.toFixed(2)} (profitable)` }
        break
    }

    if (!passes) return { matched, allPass: false }
    matched.push(label)
  }

  return { matched, allPass: matched.length > 0 }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { filters, includeDefaults } = await req.json() as {
      filters: FilterCriterion[]
      includeDefaults: boolean
    }

    if (!filters?.length) {
      return NextResponse.json({ error: 'At least one filter required' }, { status: 400 })
    }

    // ── 1. Get user watchlist ──────────────────────────────────────────────
    const { data: watchlistRows } = await supabase
      .from('watchlist').select('ticker').eq('user_id', user.id)
    const watchlistTickers = (watchlistRows ?? []).map((r: { ticker: string }) => r.ticker)

    // ── 2. Build ticker universe ───────────────────────────────────────────
    const tickerSet = new Set<string>(watchlistTickers)
    if (includeDefaults) SP500_DEFAULTS.forEach(t => tickerSet.add(t))
    const tickers = [...tickerSet].slice(0, 50) // cap at 50 total

    if (!tickers.length) {
      return NextResponse.json({ results: [], tickerCount: 0, watchlistCount: 0 })
    }

    // ── 3. Bulk fetch quotes ───────────────────────────────────────────────
    type RawQ = {
      symbol?: string; shortName?: string; longName?: string
      regularMarketPrice?: number; regularMarketChangePercent?: number
      fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number
      regularMarketVolume?: number; averageDailyVolume3Month?: number
      trailingPE?: number; epsTrailingTwelveMonths?: number
    }

    const rawQuotes = await yf.quote(tickers) as unknown as RawQ | RawQ[]
    const quoteList = Array.isArray(rawQuotes) ? rawQuotes : [rawQuotes]
    const quoteMap: Record<string, RawQ> = {}
    for (const q of quoteList) {
      if (q.symbol) quoteMap[q.symbol] = q
    }

    // ── 4. Determine chart requirements ────────────────────────────────────
    const needsChart = filters.some(f => TECHNICAL_TYPES.has(f.type))
    const needsSMA200 = filters.some(f =>
      f.type === 'price_above_sma200' || f.type === 'price_below_sma200'
    )
    const chartDays = needsSMA200 ? 260 : 70

    const chartMap: Record<string, number[]> = {}
    if (needsChart) {
      // Fetch charts concurrently (5 at a time to avoid rate limits)
      const chartResults = await chunk(tickers, 5, async (ticker) => {
        const closes = await fetchChart(ticker, chartDays)
        return { ticker, closes }
      })
      for (const r of chartResults) {
        if (r) chartMap[r.ticker] = r.closes
      }
    }

    // ── 5. Apply filters to each ticker ────────────────────────────────────
    const results: ScanResult[] = []

    for (const ticker of tickers) {
      const q = quoteMap[ticker]
      if (!q) continue

      const price = q.regularMarketPrice ?? 0
      if (!price) continue

      const closes = chartMap[ticker] ?? []
      const n = closes.length

      // Compute technical indicators from chart data
      const rsi = n > 14 ? calcRSI(closes) : null
      let sma50Dev: number | null = null
      let sma200Dev: number | null = null

      if (n >= 50) {
        const arr = smaArr(closes, 50)
        const last = arr[n - 1]
        if (!isNaN(last)) sma50Dev = ((price - last) / last) * 100
      }
      if (n >= 200) {
        const arr = smaArr(closes, 200)
        const last = arr[n - 1]
        if (!isNaN(last)) sma200Dev = ((price - last) / last) * 100
      }

      const todayVolume = q.regularMarketVolume ?? 0
      const avgVolume = q.averageDailyVolume3Month ?? 0
      const pe = q.trailingPE ?? null
      const eps = q.epsTrailingTwelveMonths ?? null
      const week52High = q.fiftyTwoWeekHigh ?? null
      const week52Low = q.fiftyTwoWeekLow ?? null

      const { matched, allPass } = applyFilters(
        filters,
        { price, name: q.shortName ?? q.longName ?? ticker, week52High, week52Low, todayVolume, avgVolume, pe, eps },
        { closes, rsi, sma50Dev, sma200Dev },
      )

      if (!allPass) continue

      results.push({
        ticker,
        name: q.shortName ?? q.longName ?? ticker,
        price,
        changePercent: q.regularMarketChangePercent ?? 0,
        matchedFilters: matched,
        rsi,
        sma50Dev,
        sma200Dev,
        week52High,
        week52Low,
        pe,
        eps,
        volumeRatio: avgVolume > 0 ? todayVolume / avgVolume : null,
      })
    }

    // Sort by absolute % change desc (biggest movers first)
    results.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))

    return NextResponse.json({
      results,
      tickerCount: tickers.length,
      watchlistCount: watchlistTickers.length,
    })
  } catch (err) {
    console.error('[/api/scanner]', err)
    return NextResponse.json({ error: 'Scanner failed' }, { status: 500 })
  }
}
