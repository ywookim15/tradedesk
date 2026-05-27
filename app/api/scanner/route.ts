import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Scan universes ─────────────────────────────────────────────────────────────

/** Top 30 S&P 500 by market cap */
const SP500_TOP30 = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'NFLX',
  'JPM', 'V', 'MA', 'BAC', 'GS',
  'JNJ', 'UNH', 'PFE', 'MRK',
  'XOM', 'CVX',
  'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE',
  'WMT', 'COST', 'HD',
  'DIS', 'T', 'CMCSA',
]

/** Full S&P 500 constituent list (503 tickers as of 2025) */
const SP500_ALL = [
  'MMM','AOS','ABT','ABBV','ACN','ADBE','AMD','AES','AFL','A',
  'APD','ABNB','AKAM','ALB','ARE','ALGN','ALLE','LNT','ALL','GOOGL',
  'GOOG','MO','AMZN','AMCR','AEE','AEP','AXP','AIG','AMT','AWK',
  'AMP','AME','AMGN','APH','ADI','ANSS','AON','APA','AAPL','AMAT',
  'APTV','ACGL','ADM','ANET','AJG','AIZ','T','ATO','ADSK','ADP',
  'AZO','AVB','AVY','AXON','BKR','BALL','BAC','BK','BBWI','BAX',
  'BDX','WRB','BBY','TECH','BIIB','BLK','BX','BK','BA','BKNG',
  'BWA','BSX','BMY','AVGO','BR','BRO','BF.B','BLDR','BG','CDNS',
  'CZR','CPT','CPB','COF','CAH','KMX','CCL','CARR','CAT','CBOE',
  'CBRE','CDW','CE','COR','CNC','CNP','CF','CHRW','CRL','SCHW',
  'CHTR','CVX','CMG','CB','CHD','CI','CINF','CTAS','CSCO','C',
  'CFG','CLX','CME','CMS','KO','CTSH','CL','CMCSA','CMA','CAG',
  'COP','ED','STZ','CEG','COO','CPRT','GLW','CTVA','CSGP','COST',
  'CTRA','CCI','CSX','CMI','CVS','DHI','DHR','DRI','DVA','DE',
  'DAL','XRAY','DVN','DXCM','FANG','DLR','DFS','DG','DLTR','D',
  'DPZ','DOV','DOW','DTE','DUK','DD','EMN','ETN','EBAY','ECL',
  'EIX','EW','EA','ELV','LLY','EMR','ENPH','ETR','EOG','EPAM',
  'EQT','EFX','EQIX','EQR','ESS','EL','ETSY','EG','EVRG','ES',
  'EXC','EXPD','EXPE','EXR','XOM','FFIV','FDS','FICO','FAST','FRT',
  'FDX','FITB','FSLR','FE','FIS','FI','FLT','FMC','F','FTNT',
  'FTV','FOXA','FOX','BEN','FCX','GRMN','IT','GEHC','GEN','GNRC',
  'GD','GE','GIS','GM','GPC','GILD','GPN','GL','GS','HAL',
  'HIG','HAS','HCA','DOC','HSIC','HSY','HES','HPE','HLT','HOLX',
  'HD','HON','HRL','HST','HWM','HPQ','HUBB','HUM','HBAN','HII',
  'IBM','IEX','IDXX','ITW','ILMN','INCY','IR','PODD','INTC','ICE',
  'IFF','IP','IPG','INTU','ISRG','IVZ','INVH','IQV','IRM','JBHT',
  'JBL','JKHY','J','JNJ','JCI','JPM','JNPR','K','KVUE','KDP',
  'KEY','KEYS','KMB','KIM','KMI','KLAC','KHC','KR','LHX','LH',
  'LRCX','LW','LVS','LDOS','LEN','LIN','LYV','LKQ','LMT','L',
  'LOW','LULU','LYB','MTB','MRO','MPC','MKTX','MAR','MMC','MLM',
  'MAS','MA','MTCH','MKC','MCD','MCK','MDT','MRK','META','MET',
  'MTD','MGM','MCHP','MU','MSFT','MAA','MRNA','MHK','MOH','TAP',
  'MDLZ','MPWR','MNST','MCO','MS','MOS','MSI','MSCI','NDAQ','NTAP',
  'NFLX','NWL','NEM','NWSA','NWS','NEE','NKE','NI','NDSN','NSC',
  'NTRS','NOC','NCLH','NRG','NUE','NVDA','NVR','NXPI','ORLY','OXY',
  'ODFL','OMC','ON','OKE','ORCL','PCAR','PKG','PANW','PARA','PH',
  'PAYX','PAYC','PYPL','PNR','PEP','PFE','PCG','PM','PSX','PNW',
  'PXD','PNC','POOL','PPG','PPL','PFG','PG','PGR','PRU','PLD',
  'QCOM','PWR','QRVO','RJF','RTX','O','REG','REGN','RF','RSG',
  'RMD','RVTY','ROK','ROL','ROP','ROST','RCL','SPGI','CRM','SBAC',
  'SLB','STX','SRE','NOW','SHW','SBUX','STT','SMCI','STE','SYK',
  'SOLV','SWK','SWKS','SJM','SNA','SEDG','SO','LUV','SWN','SPG',
  'SNPS','SYY','TMUS','TROW','TTWO','TPR','TRGP','TGT','TEL','TDY',
  'TFX','TER','TSLA','TXN','TXT','TMO','TJX','TSCO','TT','TDG',
  'TRV','TRMB','TFC','TYL','TSN','USB','UDR','ULTA','UNP','UAL',
  'UPS','URI','UNH','UHS','VLO','VTR','VRSN','VRSK','VZ','VRTX',
  'VLTO','VFC','VTRS','VICI','V','VST','VNO','VMC','WRK','WAB',
  'WMT','WBD','WM','WAT','WEC','WFC','WELL','WST','WDC','WRK',
  'WY','WHR','WMB','WTW','GWW','WYNN','XEL','XYL','YUM','ZBRA',
  'ZBH','ZTS',
]

export type ScanUniverse = 'watchlist' | 'sp500_30' | 'sp500_all' | 'gainers'

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

// ── Fetch chart data ───────────────────────────────────────────────────────────

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

// ── Fetch top gainers ──────────────────────────────────────────────────────────

async function fetchTopGainers(): Promise<string[]> {
  try {
    // Use Yahoo Finance screener for day gainers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (yf as any).screener('day_gainers', { count: 100 })
    const quotes = result?.quotes ?? []
    return quotes
      .filter((q: { symbol?: string }) => q.symbol)
      .map((q: { symbol: string }) => q.symbol)
      .slice(0, 100)
  } catch {
    // Fallback: return a broad active-stock list
    return [
      'TSLA','NVDA','AMD','AAPL','AMZN','META','GOOGL','MSFT',
      'NFLX','PLTR','SOFI','RIVN','LCID','NIO','COIN','HOOD',
      'MARA','RIOT','CLSK','BITO','GME','AMC','BBBY','BB',
      'SPY','QQQ','ARKK','SQQQ','TQQQ','SPXU',
    ]
  }
}

// ── Apply filters ──────────────────────────────────────────────────────────────

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

    const { filters, universe = 'watchlist' } = await req.json() as {
      filters: FilterCriterion[]
      universe: ScanUniverse
    }

    if (!filters?.length) {
      return NextResponse.json({ error: 'At least one filter required' }, { status: 400 })
    }

    // ── 1. Get user watchlist ──────────────────────────────────────────────
    const { data: watchlistRows } = await supabase
      .from('watchlist').select('ticker').eq('user_id', user.id)
    const watchlistTickers = (watchlistRows ?? []).map((r: { ticker: string }) => r.ticker)

    // ── 2. Build ticker universe ───────────────────────────────────────────
    let tickerPool: string[] = []

    switch (universe) {
      case 'watchlist':
        tickerPool = watchlistTickers
        break
      case 'sp500_30':
        tickerPool = [...new Set([...watchlistTickers, ...SP500_TOP30])]
        break
      case 'sp500_all':
        tickerPool = [...new Set([...watchlistTickers, ...SP500_ALL])]
        break
      case 'gainers': {
        const gainers = await fetchTopGainers()
        tickerPool = [...new Set([...watchlistTickers, ...gainers])]
        break
      }
    }

    // Cap at 60 to avoid timeout — sp500_all will still scan a broad list
    const tickers = tickerPool.slice(0, 60)

    if (!tickers.length) {
      return NextResponse.json({
        results: [],
        tickerCount: 0,
        watchlistCount: watchlistTickers.length,
        universe,
        emptyWatchlist: universe === 'watchlist' && watchlistTickers.length === 0,
      })
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
      const chartResults = await chunk(tickers, 5, async (ticker) => {
        const closes = await fetchChart(ticker, chartDays)
        return { ticker, closes }
      })
      for (const r of chartResults) {
        if (r) chartMap[r.ticker] = r.closes
      }
    }

    // ── 5. Apply filters ───────────────────────────────────────────────────
    const results: ScanResult[] = []

    for (const ticker of tickers) {
      const q = quoteMap[ticker]
      if (!q) continue

      const price = q.regularMarketPrice ?? 0
      if (!price) continue

      const closes = chartMap[ticker] ?? []
      const n = closes.length

      const rsi = n > 14 ? calcRSI(closes) : null
      let sma50Dev: number | null = null
      let sma200Dev: number | null = null

      if (n >= 50) {
        const arr  = smaArr(closes, 50)
        const last = arr[n - 1]
        if (!isNaN(last)) sma50Dev = ((price - last) / last) * 100
      }
      if (n >= 200) {
        const arr  = smaArr(closes, 200)
        const last = arr[n - 1]
        if (!isNaN(last)) sma200Dev = ((price - last) / last) * 100
      }

      const todayVolume = q.regularMarketVolume ?? 0
      const avgVolume   = q.averageDailyVolume3Month ?? 0
      const pe          = q.trailingPE ?? null
      const eps         = q.epsTrailingTwelveMonths ?? null
      const week52High  = q.fiftyTwoWeekHigh ?? null
      const week52Low   = q.fiftyTwoWeekLow ?? null

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

    results.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))

    return NextResponse.json({
      results,
      tickerCount: tickers.length,
      watchlistCount: watchlistTickers.length,
      universe,
      emptyWatchlist: false,
    })
  } catch (err) {
    console.error('[/api/scanner]', err)
    return NextResponse.json({ error: 'Scanner failed' }, { status: 500 })
  }
}
