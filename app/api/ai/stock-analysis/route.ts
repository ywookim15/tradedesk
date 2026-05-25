import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geminiJSON } from '@/lib/gemini'
import { METRIC_DEFS } from '@/lib/analysisMetrics'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'

const FREE_DAILY_LIMIT = 10

// ── Period config ──────────────────────────────────────────────────────────────

const PERIOD_CONFIG = {
  '1mo': { days: 35,   interval: '1d'  as const },
  '3mo': { days: 95,   interval: '1d'  as const },
  '6mo': { days: 185,  interval: '1d'  as const },
  '1y':  { days: 370,  interval: '1d'  as const },
  '2y':  { days: 730,  interval: '1d'  as const },
  '5y':  { days: 1830, interval: '1wk' as const },
}
type Period = keyof typeof PERIOD_CONFIG

// ── Types ──────────────────────────────────────────────────────────────────────

type Candle = { high: number; low: number; close: number; volume: number }

type FundamentalsInput = {
  symbol: string
  name: string
  sector?: string | null
  industry?: string | null
  price: number
  peRatio?: number | null
  forwardPE?: number | null
  eps?: number | null
  profitMargin?: number | null
  roe?: number | null
  debtToEquity?: number | null
  beta?: number | null
  dividendYield?: number | null
  marketCap?: number | null
  enterpriseValue?: number | null
  week52High?: number | null
  week52Low?: number | null
  revenue?: number | null
  sharesOutstanding?: number | null
  analystRating?: {
    consensus: string
    buy: number; hold: number; sell: number
    strongBuy: number; strongSell: number
    total: number
  } | null
  analystPriceTarget?: number | null
}

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

function calcMACD(closes: number[]): { histogram: number | null; crossover: 'bullish' | 'bearish' | 'none' } {
  const n = closes.length
  if (n < 35) return { histogram: null, crossover: 'none' }
  const eFast = emaArr(closes, 12)
  const eSlow = emaArr(closes, 26)
  const macdLine = closes.map((_, i) =>
    eFast[i] != null && eSlow[i] != null ? eFast[i]! - eSlow[i]! : null,
  )
  const vi = macdLine.findIndex((v) => v != null)
  if (vi < 0) return { histogram: null, crossover: 'none' }
  const sigFull = emaArr(macdLine.slice(vi) as number[], 9)
  const signalLine: (number | null)[] = [...Array(vi).fill(null), ...sigFull]
  const histogram = closes.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? macdLine[i]! - signalLine[i]! : null,
  )
  const h = histogram[n - 1]
  const hPrev = histogram[n - 2]
  const crossover =
    h != null && hPrev != null && h > 0 && hPrev <= 0 ? 'bullish'
    : h != null && hPrev != null && h < 0 && hPrev >= 0 ? 'bearish'
    : 'none'
  return { histogram: h, crossover }
}

function calcBBPercentile(closes: number[], n = 20): number | null {
  if (closes.length < n) return null
  const slice = closes.slice(-n)
  const mean = slice.reduce((a, b) => a + b, 0) / n
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  const upper = mean + 2 * std
  const lower = mean - 2 * std
  const range = upper - lower
  if (range <= 0) return 50
  const last = closes[closes.length - 1]
  return Math.min(100, Math.max(0, ((last - lower) / range) * 100))
}

function calcATR(candles: Candle[], n = 14): number | null {
  if (candles.length < n + 1) return null
  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i].close
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev))
  })
  return trs.slice(-n).reduce((a, b) => a + b, 0) / n
}

function detectRegime(closes: number[]): {
  label: 'Trending Up' | 'Choppy' | 'Trending Down'
  confidence: number
  daysInRegime: number
  history: { index: number; label: 'up' | 'down' | 'choppy' }[]
  distribution: { up: number; choppy: number; down: number }
} {
  const windowSize = Math.min(20, Math.floor(closes.length / 3))
  if (closes.length < windowSize + 5) {
    return {
      label: 'Choppy', confidence: 55, daysInRegime: windowSize,
      history: [], distribution: { up: 0, choppy: 100, down: 0 },
    }
  }

  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
  const n = returns.length

  const classifyWindow = (rets: number[]): 'up' | 'down' | 'choppy' => {
    if (rets.length === 0) return 'choppy'
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
    const vol = Math.sqrt(variance) || 0.001
    const sharpe = mean / vol
    if (sharpe > 0.35) return 'up'
    if (sharpe < -0.35) return 'down'
    return 'choppy'
  }

  const currentClass = classifyWindow(returns.slice(-windowSize))
  const labelMap = { up: 'Trending Up', down: 'Trending Down', choppy: 'Choppy' } as const
  const currentLabel = labelMap[currentClass]

  // Count how long the stock has been in this regime by stepping back
  let daysInRegime = windowSize
  const step = Math.max(3, Math.floor(windowSize / 4))
  for (let end = n - windowSize - step; end > windowSize; end -= step) {
    const windowRets = returns.slice(end - windowSize, end)
    if (classifyWindow(windowRets) === currentClass) {
      daysInRegime = n - (end - windowSize)
    } else {
      break
    }
  }

  // Build rolling history across full series for timeline visualization
  const history: { index: number; label: 'up' | 'down' | 'choppy' }[] = []
  const histStep = Math.max(2, Math.floor(windowSize / 4))
  for (let end = windowSize; end <= n; end += histStep) {
    history.push({ index: end, label: classifyWindow(returns.slice(end - windowSize, end)) })
  }

  // Distribution: % of time in each state across the full history
  const total = history.length || 1
  const upCount = history.filter(h => h.label === 'up').length
  const downCount = history.filter(h => h.label === 'down').length
  const choppyCount = history.filter(h => h.label === 'choppy').length
  const distribution = {
    up:     Math.round((upCount     / total) * 100),
    choppy: Math.round((choppyCount / total) * 100),
    down:   Math.round((downCount   / total) * 100),
  }

  const upDays = returns.slice(-windowSize).filter((r) => r > 0).length
  const dominance = Math.max(upDays, windowSize - upDays) / windowSize
  const confidence = Math.round(Math.min(92, Math.max(55, 50 + (dominance - 0.5) * 100)))

  return { label: currentLabel, confidence, daysInRegime: Math.min(daysInRegime, n), history, distribution }
}

function runMonteCarlo(
  closes: number[],
  horizon = 90,
  simulations = 1000,
): { percentiles: { day: number; p10: number; p25: number; p50: number; p75: number; p90: number }[]; currentPrice: number; horizon: number } | null {
  if (closes.length < 20) return null
  const S0 = closes[closes.length - 1]
  const logRets = closes.slice(1).map((c, i) => Math.log(c / closes[i]))
  const n = logRets.length
  const mu = logRets.reduce((a, b) => a + b, 0) / n
  const variance = logRets.reduce((a, b) => a + (b - mu) ** 2, 0) / n
  const sigma = Math.sqrt(variance)
  const drift = mu - 0.5 * variance

  function randn(): number {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  const checkpoints: number[] = []
  for (let d = 15; d <= horizon; d += 15) checkpoints.push(d)
  if (checkpoints[checkpoints.length - 1] !== horizon) checkpoints.push(horizon)

  const buckets: number[][] = checkpoints.map(() => [])
  for (let s = 0; s < simulations; s++) {
    let price = S0
    let cpIdx = 0
    for (let d = 1; d <= horizon; d++) {
      price *= Math.exp(drift + sigma * randn())
      if (cpIdx < checkpoints.length && d === checkpoints[cpIdx]) {
        buckets[cpIdx].push(price)
        cpIdx++
      }
    }
  }

  function pctile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = (p / 100) * (sorted.length - 1)
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }

  return {
    percentiles: checkpoints.map((day, i) => ({
      day,
      p10: pctile(buckets[i], 10),
      p25: pctile(buckets[i], 25),
      p50: pctile(buckets[i], 50),
      p75: pctile(buckets[i], 75),
      p90: pctile(buckets[i], 90),
    })),
    currentPrice: S0,
    horizon,
  }
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 2, suffix = ''): string {
  if (v == null) return 'N/A'
  return v.toFixed(decimals) + suffix
}

function fmtLarge(n: number | null): string {
  if (n == null) return 'N/A'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function formatMetricValue(
  key: string,
  value: number | null,
  ctx: Record<string, string | number | null> | undefined,
): string {
  if (value == null) {
    if (key === 'analystConsensus') return String(ctx?.analystConsensus ?? 'N/A')
    if (key === 'regimeLabel') return String(ctx?.regimeLabel ?? 'N/A')
    return 'N/A'
  }
  switch (key) {
    case 'pe':
    case 'forwardPE':       return value.toFixed(1) + 'x'
    case 'eps':             return '$' + value.toFixed(2)
    case 'profitMargin':
    case 'roe':             return (value * 100).toFixed(1) + '%'
    case 'dividendYield':   return value === 0 ? 'None' : (value * 100).toFixed(2) + '%'
    case 'debtToEquity':    return value.toFixed(2) + 'x'
    case 'beta':            return value.toFixed(2)
    case 'rsi':             return value.toFixed(1)
    case 'macdSignal':      return (value >= 0 ? '+' : '') + value.toFixed(4)
    case 'sma50Deviation':
    case 'sma200Deviation':
    case 'momentum3M':      return (value >= 0 ? '+' : '') + value.toFixed(1) + '%'
    case 'bbPercentile':    return value.toFixed(0) + 'th %ile'
    case 'volumeRatio':     return value.toFixed(2) + 'x avg'
    case 'atr':             return '$' + value.toFixed(2)
    default:                return value.toFixed(2)
  }
}

// ── Qualitative verdict (Gemini only provides verdict + confidence + summary) ──

type VerdictParsed = {
  verdict: 'BUY' | 'WAIT' | 'AVOID'
  confidence: number
  summary: string
}

function safeParseVerdict(raw: string): VerdictParsed | null {
  // Strip markdown fences
  const clean = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

  // Strategy 1: direct JSON.parse of the first {...} block
  const start = clean.indexOf('{')
  const end   = clean.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(clean.slice(start, end + 1))
      if (['BUY', 'WAIT', 'AVOID'].includes(obj.verdict) && typeof obj.confidence === 'number') {
        return {
          verdict:    obj.verdict,
          confidence: Math.min(99, Math.max(1, Math.round(obj.confidence))),
          summary:    typeof obj.summary === 'string' ? obj.summary : '',
        }
      }
    } catch { /* fall through to regex strategy */ }
  }

  // Strategy 2: per-field regex — survives unescaped characters in summary text
  const verdictM = clean.match(/"verdict"\s*:\s*"(BUY|WAIT|AVOID)"/)
  const verdict  = verdictM?.[1] as 'BUY' | 'WAIT' | 'AVOID' | undefined
  if (!verdict) return null

  const numField = (key: string, def: number) => {
    const m = clean.match(new RegExp(`"${key}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`))
    return m ? Math.round(parseFloat(m[1])) : def
  }
  const summaryM = clean.match(/"summary"\s*:\s*"([^"]{0,800})"/)

  return {
    verdict,
    confidence: Math.min(99, Math.max(1, numField('confidence', 60))),
    summary:    summaryM ? summaryM[1].replace(/\\n/g, ' ').replace(/\\"/g, '"') : '',
  }
}

// ── Deterministic scorecard ────────────────────────────────────────────────────
//
// Each metric in METRIC_DEFS casts a vote via addSig().
// Scores are computed purely from signal tallies — never relying on Gemini for numbers.
// Gemini is used only for the qualitative verdict, confidence, and summary text.

type Tally = { bullish: number; neutral: number; bearish: number }

function addSig(tally: Tally, signal: 'bullish' | 'neutral' | 'bearish'): void {
  if (signal === 'bullish')      tally.bullish++
  else if (signal === 'bearish') tally.bearish++
  else                           tally.neutral++
}

/**
 * Convert a signal tally to a 0–10 score.
 * all-bullish → 10 | all-neutral → 5 | all-bearish → 0
 * Mixed signals land proportionally between those poles.
 */
function tallyToScore(t: Tally): number {
  const total = t.bullish + t.neutral + t.bearish
  if (total === 0) return 5
  const raw = 5 + ((t.bullish - t.bearish) / total) * 5
  return Math.min(10, Math.max(0, Math.round(raw)))
}

type Scorecard = {
  fundamentalsScore: number
  technicalsScore: number
  regimeScore: number
  fundTally: Tally
  techTally: Tally
  deterministicVerdict: 'BUY' | 'WAIT' | 'AVOID'
  deterministicConfidence: number
}

/**
 * Compute the full scorecard deterministically from metric signals + regime state.
 *
 * Regime score uses the confidence value directly (not just the binary up/down label)
 * to produce a gradient score rather than a hard 0/5/10 snap.
 *
 * Weighted composite: fundamentals 40% · technicals 40% · regime 20%
 */
function calcScorecard(
  metricResults: Array<{ category: string; signal: 'bullish' | 'neutral' | 'bearish' }>,
  regimeInfo: { label: string; confidence: number },
): Scorecard {
  const fundTally: Tally = { bullish: 0, neutral: 0, bearish: 0 }
  const techTally: Tally = { bullish: 0, neutral: 0, bearish: 0 }

  for (const m of metricResults) {
    if (m.category === 'fundamental') addSig(fundTally, m.signal)
    else if (m.category === 'technical') addSig(techTally, m.signal)
    // Regime category handled separately — one metric, so tally alone is too binary
  }

  const fundamentalsScore = tallyToScore(fundTally)
  const technicalsScore   = tallyToScore(techTally)

  // Regime: map confidence onto the 0–10 scale via the detected direction.
  // conf range is 50–92; map that to 5–10 (up) or 5–0 (down).
  const conf = regimeInfo.confidence  // 50–92
  let regimeScore: number
  if (regimeInfo.label === 'Trending Up') {
    regimeScore = Math.round(5 + ((conf - 50) / 42) * 5)   // 50% conf → 5, 92% → 10
  } else if (regimeInfo.label === 'Trending Down') {
    regimeScore = Math.round(5 - ((conf - 50) / 42) * 5)   // 50% conf → 5, 92% → 0
  } else {
    regimeScore = 5   // Choppy regime is directionally neutral
  }
  regimeScore = Math.min(10, Math.max(0, regimeScore))

  // Weighted composite
  const weightedAvg = fundamentalsScore * 0.4 + technicalsScore * 0.4 + regimeScore * 0.2

  const deterministicVerdict: 'BUY' | 'WAIT' | 'AVOID' =
    weightedAvg >= 6.5 ? 'BUY' : weightedAvg <= 4.0 ? 'AVOID' : 'WAIT'

  // Confidence: how far the composite is from neutral (5) minus a penalty for
  // disagreement between the three category scores.
  const allScores = [fundamentalsScore, technicalsScore, regimeScore]
  const spread    = Math.max(...allScores) - Math.min(...allScores)
  const distFromNeutral = Math.abs(weightedAvg - 5)
  const baseConf        = 50 + distFromNeutral * 10   // 50 at neutral → up to 100
  const spreadPenalty   = spread * 3                   // 0–27 penalty for category disagreement
  const deterministicConfidence = Math.round(
    Math.min(92, Math.max(45, baseConf - spreadPenalty)),
  )

  return {
    fundamentalsScore, technicalsScore, regimeScore,
    fundTally, techTally,
    deterministicVerdict, deterministicConfidence,
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── 2. Parse body ────────────────────────────────────────────────────────
    const { symbol, period = '1y', fundamentals } = await req.json() as {
      symbol: string
      period: Period
      fundamentals: FundamentalsInput
    }
    if (!symbol?.trim()) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

    // ── 3. Daily limit ───────────────────────────────────────────────────────
    type ProfileRow = { plan: string | null; ai_queries_today: number | null; ai_queries_reset_date: string | null }
    const { data: profile } = await supabase
      .from('profiles').select('plan, ai_queries_today, ai_queries_reset_date')
      .eq('id', user.id).single() as { data: ProfileRow | null; error: unknown }
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]
    let queriesUsed = profile.ai_queries_today ?? 0
    if (profile.ai_queries_reset_date !== today) {
      queriesUsed = 0
      await supabase.from('profiles')
        .update({ ai_queries_today: 0, ai_queries_reset_date: today } as never)
        .eq('id', user.id)
    }
    const isPro = profile.plan === 'pro'
    if (!isPro && queriesUsed >= FREE_DAILY_LIMIT) {
      return NextResponse.json({ error: 'daily_limit_reached', queriesUsed, queriesLimit: FREE_DAILY_LIMIT }, { status: 429 })
    }

    // ── 4. Fetch chart data ──────────────────────────────────────────────────
    const config = PERIOD_CONFIG[period] ?? PERIOD_CONFIG['1y']
    const to = new Date()
    const from = new Date(to.getTime() - config.days * 24 * 60 * 60 * 1000)
    let candles: Candle[] = []
    let closes: number[] = []

    try {
      const result = await yf.chart(symbol.toUpperCase(), {
        period1: from.toISOString().split('T')[0],
        interval: config.interval,
      })
      type Q = { date: Date; open: number; high: number; low: number; close: number; volume: number | null }
      const quotes = (result.quotes ?? []).filter((q): q is Q => q != null && q.close != null)
      candles = quotes.map((q) => ({
        high: q.high ?? 0, low: q.low ?? 0, close: q.close ?? 0, volume: q.volume ?? 0,
      }))
      closes = candles.map((c) => c.close)
    } catch { /* chart unavailable — continue without technicals */ }

    const n = closes.length

    // ── 5. Compute technicals ────────────────────────────────────────────────
    const rsiValue = n > 14 ? calcRSI(closes) : null
    const { histogram: macdHistogram, crossover: macdCrossover } = calcMACD(closes)

    const sma50arr = n >= 50 ? smaArr(closes, 50) : null
    const sma200arr = n >= 200 ? smaArr(closes, 200) : null
    const sma50Last = sma50arr ? sma50arr[n - 1] : null
    const sma200Last = sma200arr ? sma200arr[n - 1] : null
    const sma50Dev = sma50Last != null && !isNaN(sma50Last)
      ? ((closes[n - 1] - sma50Last) / sma50Last) * 100 : null
    const sma200Dev = sma200Last != null && !isNaN(sma200Last)
      ? ((closes[n - 1] - sma200Last) / sma200Last) * 100 : null

    let goldenDeathCross: 'golden' | 'death' | null = null
    if (sma50Last != null && sma200Last != null && !isNaN(sma50Last) && !isNaN(sma200Last)) {
      goldenDeathCross = sma50Last > sma200Last ? 'golden' : 'death'
    }

    const bbPct = calcBBPercentile(closes)
    const atrValue = candles.length > 14 ? calcATR(candles) : null

    const recentVol = n >= 5 ? candles.slice(-5).reduce((a, b) => a + b.volume, 0) / 5 : null
    const avgVol20 = n >= 20 ? candles.slice(-20).reduce((a, b) => a + b.volume, 0) / 20 : null
    const volumeRatio = recentVol != null && avgVol20 != null && avgVol20 > 0 ? recentVol / avgVol20 : null

    const momentum3M = n >= 63 ? ((closes[n - 1] - closes[n - 63]) / closes[n - 63]) * 100 : null

    const regime = closes.length >= 15
      ? detectRegime(closes)
      : { label: 'Choppy' as const, confidence: 50, daysInRegime: 0, history: [] as { index: number; label: 'up' | 'down' | 'choppy' }[], distribution: { up: 0, choppy: 100, down: 0 } }

    const monteCarlo = closes.length >= 20 ? runMonteCarlo(closes) : null

    // Expose GBM params so client can re-run Monte Carlo with different horizon/sims
    const monteCarloParams = closes.length >= 20 ? (() => {
      const lr = closes.slice(1).map((c, i) => Math.log(c / closes[i]))
      const mu = lr.reduce((a, b) => a + b, 0) / lr.length
      const variance = lr.reduce((a, b) => a + (b - mu) ** 2, 0) / lr.length
      const sigma = Math.sqrt(variance)
      return { mu, sigma, drift: mu - 0.5 * variance, currentPrice: closes[closes.length - 1] }
    })() : null

    // ── 6. Watchlist & journal context ───────────────────────────────────────
    const [watchRes, journalRes] = await Promise.allSettled([
      supabase.from('watchlist').select('id').eq('user_id', user.id).eq('ticker', symbol.toUpperCase()).maybeSingle(),
      supabase.from('journal').select('pnl').eq('user_id', user.id).eq('ticker', symbol.toUpperCase()),
    ])
    const inWatchlist = watchRes.status === 'fulfilled' && watchRes.value.data != null
    const journalEntries = journalRes.status === 'fulfilled' ? (journalRes.value.data ?? []) : []
    const journalCount = journalEntries.length
    const journalAvgPnl = journalCount > 0
      ? journalEntries.reduce((a, e: { pnl: number }) => a + (e.pnl ?? 0), 0) / journalCount
      : null

    // ── 7. Build metric results ──────────────────────────────────────────────
    const fund = fundamentals

    const metricValues: Record<string, number | null> = {
      pe:              fund.peRatio ?? null,
      forwardPE:       fund.forwardPE ?? null,
      eps:             fund.eps ?? null,
      profitMargin:    fund.profitMargin ?? null,
      roe:             fund.roe ?? null,
      debtToEquity:    fund.debtToEquity ?? null,
      beta:            fund.beta ?? null,
      dividendYield:   fund.dividendYield ?? null,
      analystConsensus: null,
      rsi:             rsiValue,
      macdSignal:      macdHistogram,
      sma50Deviation:  sma50Dev,
      sma200Deviation: sma200Dev,
      bbPercentile:    bbPct,
      volumeRatio:     volumeRatio,
      momentum3M:      momentum3M,
      atr:             atrValue,
      regimeLabel:     null,
    }

    const metricContexts: Record<string, Record<string, string | number | null>> = {
      forwardPE:        { pe: fund.peRatio ?? null },
      analystConsensus: {
        analystConsensus:   fund.analystRating?.consensus ?? null,
        analystPriceTarget: fund.analystPriceTarget ?? null,
        currentPrice:       fund.price,
      },
      sma200Deviation: { goldenDeathCross: goldenDeathCross },
      macdSignal:      { macdCrossover: macdCrossover },
      volumeRatio:     {
        volumeTrend: volumeRatio != null
          ? (volumeRatio > 1.2 ? 'increasing' : volumeRatio < 0.8 ? 'decreasing' : 'stable')
          : null,
      },
      atr:             { currentPrice: fund.price },
      regimeLabel:     {
        regimeLabel:       regime.label,
        regimeConfidence:  regime.confidence,
        regimeDays:        regime.daysInRegime,
      },
    }

    const metricResults = METRIC_DEFS.map((def) => {
      const value = metricValues[def.key] ?? null
      const ctx = metricContexts[def.key]
      return {
        key:         def.key,
        label:       def.label,
        category:    def.category,
        value:       formatMetricValue(def.key, value, ctx),
        rawValue:    value,
        signal:      def.getSignal(value, ctx),
        explanation: def.explain(value, ctx),
      }
    })

    // ── 7b. Compute deterministic scorecard from signal tallies ─────────────
    const scorecard = calcScorecard(metricResults, regime)

    // ── 8. Build Gemini prompt ───────────────────────────────────────────────
    const periodLabel: Record<Period, string> = {
      '1mo': '1 Month', '3mo': '3 Months', '6mo': '6 Months',
      '1y': '1 Year', '2y': '2 Years', '5y': '5 Years',
    }

    const { fundTally: ft, techTally: tt } = scorecard
    const fundSummary = `${ft.bullish} bullish · ${ft.neutral} neutral · ${ft.bearish} bearish (${ft.bullish + ft.neutral + ft.bearish} indicators)`
    const techSummary = `${tt.bullish} bullish · ${tt.neutral} neutral · ${tt.bearish} bearish (${tt.bullish + tt.neutral + tt.bearish} indicators)`

    const prompt = `You are TradeDesk's AI stock analysis engine. Review the data below and deliver a concise investment verdict.

STOCK: ${symbol} — ${fund.name}
SECTOR: ${fund.sector ?? 'N/A'} | INDUSTRY: ${fund.industry ?? 'N/A'}
ANALYSIS PERIOD: ${periodLabel[period] ?? period} (${n} data points)

── FUNDAMENTALS ──
Price: $${fund.price.toFixed(2)}
P/E (TTM): ${fmt(fund.peRatio ?? null, 1)}x  |  Forward P/E: ${fmt(fund.forwardPE ?? null, 1)}x
EPS (TTM): $${fmt(fund.eps ?? null, 2)}
Revenue (TTM): ${fmtLarge(fund.revenue ?? null)}
Profit Margin: ${fmt(fund.profitMargin != null ? fund.profitMargin * 100 : null, 1)}%
ROE: ${fmt(fund.roe != null ? fund.roe * 100 : null, 1)}%
Debt/Equity: ${fmt(fund.debtToEquity ?? null, 2)}x
Beta: ${fmt(fund.beta ?? null, 2)}
Market Cap: ${fmtLarge(fund.marketCap ?? null)}
52W Range: $${fmt(fund.week52Low ?? null, 2)} – $${fmt(fund.week52High ?? null, 2)}
Analyst Consensus: ${fund.analystRating?.consensus ?? 'N/A'}${fund.analystPriceTarget ? ` | Price Target: $${fund.analystPriceTarget.toFixed(2)}` : ''}

── TECHNICALS (${periodLabel[period] ?? period}) ──
RSI(14): ${rsiValue != null ? rsiValue.toFixed(1) : 'N/A'} — ${rsiValue != null ? (rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral') : 'N/A'}
MACD Histogram: ${macdHistogram != null ? (macdHistogram >= 0 ? '+' : '') + macdHistogram.toFixed(4) : 'N/A'}${macdCrossover !== 'none' ? ' (' + macdCrossover.toUpperCase() + ' CROSSOVER)' : ''}
Price vs SMA 50: ${sma50Dev != null ? (sma50Dev >= 0 ? '+' : '') + sma50Dev.toFixed(1) + '%' : 'N/A'}
Price vs SMA 200: ${sma200Dev != null ? (sma200Dev >= 0 ? '+' : '') + sma200Dev.toFixed(1) + '%' : 'N/A'}${goldenDeathCross ? ' (' + (goldenDeathCross === 'golden' ? 'Golden Cross' : 'Death Cross') + ')' : ''}
Bollinger Band Position: ${bbPct != null ? bbPct.toFixed(0) + 'th percentile of band' : 'N/A'}
Volume Trend: ${volumeRatio != null ? volumeRatio.toFixed(2) + 'x 20-day avg' : 'N/A'}
3-Month Momentum: ${momentum3M != null ? (momentum3M >= 0 ? '+' : '') + momentum3M.toFixed(1) + '%' : 'N/A'}
ATR(14): ${atrValue != null ? '$' + atrValue.toFixed(2) : 'N/A'}

── MARKET REGIME ──
State: ${regime.label} · Confidence: ${regime.confidence}% · Duration: ~${regime.daysInRegime} periods

── SIGNAL SCORECARD (computed from indicator tallies) ──
Fundamentals : ${scorecard.fundamentalsScore}/10 — ${fundSummary}
Technicals   : ${scorecard.technicalsScore}/10 — ${techSummary}
Regime       : ${scorecard.regimeScore}/10 — ${regime.label} at ${regime.confidence}% confidence
Composite    : ${(scorecard.fundamentalsScore * 0.4 + scorecard.technicalsScore * 0.4 + scorecard.regimeScore * 0.2).toFixed(1)}/10 → suggested ${scorecard.deterministicVerdict}

── USER CONTEXT ──
Watchlist: ${inWatchlist ? 'Yes' : 'No'}
Journal: ${journalCount > 0 ? `${journalCount} trade(s), avg P&L $${journalAvgPnl?.toFixed(2) ?? 'N/A'}` : 'None logged'}

────────────────────────────────────────────────────

Your task: Using the scorecard and data above, write 2–3 sentences in plain English explaining the most important factors driving the verdict. You may agree with the suggested verdict or override it if the qualitative picture clearly warrants it.

Output ONLY this JSON (no markdown, no backticks, no code fences, nothing before or after):
{"verdict":"${scorecard.deterministicVerdict}","confidence":${scorecard.deterministicConfidence},"summary":"Replace this with your 2–3 sentence analysis."}`

    // ── 9. Call Gemini ───────────────────────────────────────────────────────
    let rawResponse: string
    try {
      rawResponse = await geminiJSON(prompt)
    } catch {
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 503 })
    }

    // ── 10. Parse Gemini verdict — only verdict / confidence / summary ────────
    //   Scores always come from the deterministic scorecard, never from Gemini.
    const geminiResult = safeParseVerdict(rawResponse)

    // Gemini can override the verdict/confidence if it disagrees; scores are locked.
    const finalVerdict    = geminiResult?.verdict    ?? scorecard.deterministicVerdict
    const finalConfidence = geminiResult?.confidence ?? scorecard.deterministicConfidence
    const finalSummary    = geminiResult?.summary?.trim()
      ? geminiResult.summary
      : 'Analysis complete — see the detailed metrics below for the full breakdown.'

    // ── 11. Increment counter ────────────────────────────────────────────────
    await supabase.from('profiles')
      .update({ ai_queries_today: queriesUsed + 1 } as never)
      .eq('id', user.id)

    return NextResponse.json({
      verdict:           finalVerdict,
      confidence:        finalConfidence,
      summary:           finalSummary,
      fundamentalsScore: scorecard.fundamentalsScore,
      technicalsScore:   scorecard.technicalsScore,
      regimeScore:       scorecard.regimeScore,
      regime: {
        label:        regime.label,
        confidence:   regime.confidence,
        daysInRegime: regime.daysInRegime,
        history:      regime.history,
        distribution: regime.distribution,
      },
      metrics:           metricResults,
      monteCarlo,
      monteCarloParams,
      queriesUsed:  queriesUsed + 1,
      queriesLimit: isPro ? null : FREE_DAILY_LIMIT,
    })

  } catch (err) {
    console.error('[/api/ai/stock-analysis]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
