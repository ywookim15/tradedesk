'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  CrosshairMode,
  type Time,
  type LineWidth,
} from 'lightweight-charts'
import { Search, TrendingUp, Bot, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y'

type OHLCV = {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type IndicatorKey =
  | 'sma20' | 'sma50' | 'sma200'
  | 'ema12' | 'ema26'
  | 'bb' | 'vwap' | 'fib' | 'volume' | 'linreg' | 'sr'

type AnalysisKey =
  | 'macd' | 'rsi' | 'zscore' | 'meanrev'
  | 'momentum' | 'rsvsspx' | 'sharpe' | 'montecarlo' | 'volprofile'

type StockInfo = { name: string; price: number; change: number; changePercent: number }

// ── Math utilities ────────────────────────────────────────────────────────────

function sma(data: number[], n: number): (number | null)[] {
  return data.map((_, i) =>
    i < n - 1 ? null : data.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n,
  )
}

function ema(data: number[], n: number): (number | null)[] {
  const k = 2 / (n + 1)
  const out: (number | null)[] = Array(data.length).fill(null)
  if (data.length < n) return out
  let val = data.slice(0, n).reduce((a, b) => a + b, 0) / n
  out[n - 1] = val
  for (let i = n; i < data.length; i++) { val = data[i] * k + val * (1 - k); out[i] = val }
  return out
}

function bollingerBands(closes: number[], n = 20) {
  const mid = sma(closes, n)
  return closes.map((_, i) => {
    const m = mid[i]
    if (m == null) return { upper: null, middle: null, lower: null }
    const slice = closes.slice(i - n + 1, i + 1)
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / n)
    return { upper: m + 2 * std, middle: m, lower: m - 2 * std }
  })
}

function calcVWAP(candles: OHLCV[]): (number | null)[] {
  let cumVol = 0, cumTPV = 0
  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3
    cumVol += c.volume; cumTPV += tp * c.volume
    return cumVol > 0 ? cumTPV / cumVol : null
  })
}

function calcRSI(closes: number[], n = 14): (number | null)[] {
  if (closes.length <= n) return Array(closes.length).fill(null)
  const ch = closes.slice(1).map((c, i) => c - closes[i])
  let ag = ch.slice(0, n).reduce((a, c) => a + Math.max(c, 0), 0) / n
  let al = ch.slice(0, n).reduce((a, c) => a + Math.max(-c, 0), 0) / n
  const out: (number | null)[] = Array(n + 1).fill(null)
  out.push(100 - 100 / (1 + ag / (al || 1e-9)))
  for (let i = n; i < ch.length; i++) {
    ag = (ag * (n - 1) + Math.max(ch[i], 0)) / n
    al = (al * (n - 1) + Math.max(-ch[i], 0)) / n
    out.push(100 - 100 / (1 + ag / (al || 1e-9)))
  }
  return out
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const eFast = ema(closes, fast)
  const eSlow = ema(closes, slow)
  const macdLine = closes.map((_, i) =>
    eFast[i] != null && eSlow[i] != null ? eFast[i]! - eSlow[i]! : null,
  )
  const vi = macdLine.findIndex((v) => v != null)
  if (vi < 0) {
    const nullArr = closes.map(() => null as number | null)
    return { macdLine: nullArr, signalLine: nullArr, histogram: nullArr }
  }
  const sigFull = ema(macdLine.slice(vi) as number[], signal)
  const signalLine: (number | null)[] = [...Array(vi).fill(null), ...sigFull]
  const histogram = closes.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? macdLine[i]! - signalLine[i]! : null,
  )
  return { macdLine, signalLine, histogram }
}

function calcLinReg(closes: number[]): number[] {
  const n = closes.length
  if (n < 2) return closes
  const xm = (n - 1) / 2
  const ym = closes.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  closes.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2 })
  const slope = num / (den || 1), intercept = ym - slope * xm
  return closes.map((_, x) => intercept + slope * x)
}

function calcZScore(closes: number[], w = 20): (number | null)[] {
  return closes.map((_, i) => {
    if (i < w - 1) return null
    const sl = closes.slice(i - w + 1, i + 1)
    const m = sl.reduce((a, b) => a + b, 0) / w
    const sd = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / w)
    return sd > 0 ? (closes[i] - m) / sd : 0
  })
}

function normalRand() {
  let u = 0, v = 0
  while (!u) u = Math.random(); while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function calcMonteCarlo(closes: number[], days = 90, sims = 300, histBars = 0) {
  const src = histBars > 0 ? closes.slice(-histBars) : closes
  if (src.length < 10) return null
  const rets = src.slice(1).map((c, i) => Math.log(c / src[i]))
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length
  const sig = Math.sqrt(rets.reduce((a, b) => a + (b - mu) ** 2, 0) / rets.length)
  const last = src[src.length - 1]
  const finals: number[] = []
  for (let s = 0; s < sims; s++) {
    let p = last
    for (let d = 0; d < days; d++) p *= Math.exp(mu + sig * normalRand())
    finals.push(p)
  }
  finals.sort((a, b) => a - b)
  const pct = (p: number) => finals[Math.floor(sims * p / 100)]
  return {
    current: last,
    p10: pct(10), p25: pct(25), p50: pct(50), p75: pct(75), p90: pct(90),
    probAbove: ((finals.filter((p) => p > last).length / sims) * 100).toFixed(0),
    sims, days, histBars: histBars || src.length,
  }
}

function detectSR(candles: OHLCV[], win = 5) {
  const highs = candles.map((c) => c.high)
  const lows  = candles.map((c) => c.low)
  const raw: { price: number; type: 'resistance' | 'support' }[] = []
  for (let i = win; i < candles.length - win; i++) {
    const sh = highs.slice(i - win, i + win + 1)
    const sl = lows.slice(i - win, i + win + 1)
    if (highs[i] === Math.max(...sh)) raw.push({ price: highs[i], type: 'resistance' })
    if (lows[i]  === Math.min(...sl))  raw.push({ price: lows[i],  type: 'support'    })
  }
  const merged: typeof raw = []
  raw.forEach((l) => {
    if (!merged.find((m) => Math.abs(m.price - l.price) / l.price < 0.01)) merged.push({ ...l })
  })
  return merged.sort((a, b) => b.price - a.price).slice(0, 10)
}

function calcSharpe(closes: number[], rfr = 0.05) {
  if (closes.length < 2) return null
  const rets = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
  const m = rets.reduce((a, b) => a + b, 0) / rets.length
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length)
  return ((m * 252) - rfr) / (sd * Math.sqrt(252) || 1e-9)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: Period[] = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y']
const PERIOD_LABELS: Record<Period, string> = {
  '1d': '1D', '5d': '5D', '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', '5y': '5Y',
}

const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  sma20: 'SMA 20', sma50: 'SMA 50', sma200: 'SMA 200',
  ema12: 'EMA 12', ema26: 'EMA 26', bb: 'Bollinger Bands',
  vwap: 'VWAP', fib: 'Fibonacci', volume: 'Volume', linreg: 'Lin. Reg.', sr: 'S/R Levels',
}

const IND_COLORS: Record<string, string> = {
  sma20: '#4FA3FF', sma50: '#F59E0B', sma200: '#FF4D4D',
  ema12: '#00C896', ema26: '#8B5CF6',
  bbUpper: '#4FA3FF88', bbMid: '#4FA3FF', bbLower: '#4FA3FF88',
  vwap: '#F97316', linreg: '#EC4899',
}

const ANALYSIS_BTNS: { key: AnalysisKey; label: string }[] = [
  { key: 'macd',       label: 'MACD'             },
  { key: 'rsi',        label: 'RSI'              },
  { key: 'zscore',     label: 'Z-Score'          },
  { key: 'meanrev',    label: 'Mean Reversion'   },
  { key: 'momentum',   label: 'Momentum Score'   },
  { key: 'rsvsspx',    label: 'RS vs S&P 500'    },
  { key: 'sharpe',     label: 'Sharpe Ratio'     },
  { key: 'montecarlo', label: 'Monte Carlo'      },
  { key: 'volprofile', label: 'Volume Profile'   },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function TechnicalClient() {
  const [searchInput,      setSearchInput]      = useState('')
  const [ticker,           setTicker]           = useState('')
  const [period,           setPeriod]           = useState<Period>('1y')
  const [chartData,        setChartData]        = useState<OHLCV[]>([])
  const [intraday,         setIntraday]         = useState(false)
  const [stockInfo,        setStockInfo]        = useState<StockInfo | null>(null)
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set(['volume']))
  const [activeAnalysis,   setActiveAnalysis]   = useState<AnalysisKey | null>(null)
  const [analysisData,     setAnalysisData]     = useState<unknown>(null)
  const [aiResponse,       setAiResponse]       = useState<string | null>(null)
  const [loading,          setLoading]          = useState(false)
  const [analysisLoading,  setAnalysisLoading]  = useState(false)
  const [aiLoading,        setAiLoading]        = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // Per-analysis configurable parameters
  const [params, setParams] = useState({
    rsiPeriod:      14,
    macdFast:       12,
    macdSlow:       26,
    macdSignal:     9,
    zWindow:        20,
    meanrevPeriod:  20,
    sharpRfr:       5,    // % risk-free rate
    volBuckets:     10,
    mcSims:         300,
    mcDays:         90,
    mcHistBars:     0,    // 0 = use all available
  })

  const setParam = useCallback(<K extends keyof typeof params>(key: K, val: number) => {
    setParams(p => ({ ...p, [key]: val }))
  }, [])

  const containerRef    = useRef<HTMLDivElement>(null)
  const chartRef        = useRef<ReturnType<typeof createChart> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleSeriesRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indSeriesRef    = useRef<Map<string, any>>(new Map())

  const searchParams = useSearchParams()

  // Load ticker from URL param on mount (e.g. from watchlist click)
  useEffect(() => {
    const sym = searchParams.get('ticker')?.toUpperCase()
    if (sym) {
      setSearchInput(sym)
      setTicker(sym)
      setActiveAnalysis(null); setAiResponse(null); setAnalysisData(null)
      fetchChart(sym, period); fetchInfo(sym)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchChart = useCallback(async (sym: string, p: Period) => {
    setLoading(true); setError(null); setChartData([])
    try {
      const res = await fetch(`/api/stock/chart?symbol=${encodeURIComponent(sym)}&period=${p}`)
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: OHLCV[]; intraday: boolean }
      setChartData(json.data ?? [])
      setIntraday(json.intraday)
    } catch {
      setError('Failed to load chart data. Check the ticker symbol and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchInfo = useCallback(async (sym: string) => {
    try {
      const res = await fetch(`/api/stock/quotes?symbols=${encodeURIComponent(sym)}`)
      if (!res.ok) return
      const json = await res.json() as { ticker: string; name: string; price: number; change: number; changePercent: number }[]
      const q = json[0]
      if (q) setStockInfo({ name: q.name, price: q.price, change: q.change, changePercent: q.changePercent })
    } catch { /* silent */ }
  }, [])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const sym = searchInput.trim().toUpperCase()
    if (!sym) return
    setTicker(sym); setActiveAnalysis(null); setAiResponse(null); setAnalysisData(null)
    fetchChart(sym, period); fetchInfo(sym)
  }, [searchInput, period, fetchChart, fetchInfo])

  const handlePeriod = useCallback((p: Period) => {
    setPeriod(p)
    if (ticker) fetchChart(ticker, p)
  }, [ticker, fetchChart])

  // ── Chart lifecycle ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout:          { background: { color: '#0A0F1E' }, textColor: '#8A99B3' },
      grid:            { vertLines: { color: '#1E2D4A' }, horzLines: { color: '#1E2D4A' } },
      crosshair:       { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: '#1E2D4A' },
      timeScale:       { borderColor: '#1E2D4A', timeVisible: true },
      width:           containerRef.current.clientWidth,
      height:          380,
    })
    chartRef.current = chart
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#00C896', downColor: '#FF4D4D',
      borderUpColor: '#00C896', borderDownColor: '#FF4D4D',
      wickUpColor: '#00C896', wickDownColor: '#FF4D4D',
    })
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 380)
    })
    ro.observe(containerRef.current)
    return () => {
      ro.disconnect(); chart.remove()
      chartRef.current = null; candleSeriesRef.current = null
      indSeriesRef.current.clear()
    }
  }, [])

  // Update candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !chartData.length) return
    candleSeriesRef.current.setData(
      chartData.map((d) => ({ ...d, time: d.time as Time })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [chartData])

  // Update indicator overlays
  useEffect(() => {
    const chart = chartRef.current
    const cs    = candleSeriesRef.current
    if (!chart || !cs || !chartData.length) return

    const closes  = chartData.map((d) => d.close)
    const existing = indSeriesRef.current

    // Remove deactivated series
    existing.forEach((s, key) => {
      if (!activeIndicators.has(key as IndicatorKey)) {
        if (Array.isArray(s)) {
          // price-line arrays (fib, sr)
          s.forEach((pl: unknown) => cs.removePriceLine(pl))
        } else {
          chart.removeSeries(s)
        }
        existing.delete(key)
      }
    })

    // Helper: add a line series once
    const addLine = (key: string, vals: (number | null)[], color: string, width: LineWidth = 1) => {
      if (existing.has(key)) return
      const series = chart.addSeries(LineSeries, {
        color, lineWidth: width, priceLineVisible: false, lastValueVisible: false,
      })
      series.setData(
        vals
          .map((v, i) => (v != null ? { time: chartData[i].time as Time, value: v } : null))
          .filter(Boolean) as { time: Time; value: number }[],
      )
      existing.set(key, series)
    }

    // Volume histogram
    if (activeIndicators.has('volume') && !existing.has('volume')) {
      const vs = chart.addSeries(HistogramSeries, {
        color: '#2F80ED44', priceFormat: { type: 'volume' }, priceScaleId: 'vol',
      })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      vs.setData(chartData.map((d) => ({
        time: d.time as Time, value: d.volume,
        color: d.close >= d.open ? '#00C89644' : '#FF4D4D44',
      })))
      existing.set('volume', vs)
    }

    // SMA
    if (activeIndicators.has('sma20'))  addLine('sma20',  sma(closes, 20),  IND_COLORS.sma20)
    if (activeIndicators.has('sma50'))  addLine('sma50',  sma(closes, 50),  IND_COLORS.sma50)
    if (activeIndicators.has('sma200')) addLine('sma200', sma(closes, 200), IND_COLORS.sma200, 2 as LineWidth)

    // EMA
    if (activeIndicators.has('ema12')) addLine('ema12', ema(closes, 12), IND_COLORS.ema12)
    if (activeIndicators.has('ema26')) addLine('ema26', ema(closes, 26), IND_COLORS.ema26)

    // Bollinger Bands (three lines grouped under one toggle)
    if (activeIndicators.has('bb')) {
      const bb = bollingerBands(closes)
      addLine('bbUpper', bb.map((b) => b.upper),  IND_COLORS.bbUpper)
      addLine('bbMid',   bb.map((b) => b.middle), IND_COLORS.bbMid)
      addLine('bbLower', bb.map((b) => b.lower),  IND_COLORS.bbLower)
    } else {
      ;['bbUpper', 'bbMid', 'bbLower'].forEach((k) => {
        if (existing.has(k)) { chart.removeSeries(existing.get(k)); existing.delete(k) }
      })
    }

    // VWAP (intraday only)
    if (activeIndicators.has('vwap') && intraday) addLine('vwap', calcVWAP(chartData), IND_COLORS.vwap)

    // Linear Regression
    if (activeIndicators.has('linreg')) addLine('linreg', calcLinReg(closes), IND_COLORS.linreg)

    // Fibonacci price lines
    if (activeIndicators.has('fib') && !existing.has('fib')) {
      const high = Math.max(...chartData.map((d) => d.high))
      const low  = Math.min(...chartData.map((d) => d.low))
      const range = high - low
      const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
      const FIB_COLORS = ['#FF4D4D', '#F59E0B', '#00C896', '#4FA3FF', '#8B5CF6', '#EC4899', '#FF4D4D']
      const lines = FIB_LEVELS.map((level, i) =>
        cs.createPriceLine({
          price: high - level * range,
          color: FIB_COLORS[i],
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${(level * 100).toFixed(1)}%`,
        }),
      )
      existing.set('fib', lines)
    }

    // Support & Resistance price lines
    if (activeIndicators.has('sr') && !existing.has('sr')) {
      const levels = detectSR(chartData)
      const lines = levels.map((l) =>
        cs.createPriceLine({
          price: l.price,
          color: l.type === 'resistance' ? '#FF4D4D88' : '#00C89688',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: l.type === 'resistance' ? 'R' : 'S',
        }),
      )
      existing.set('sr', lines)
    }
  }, [activeIndicators, chartData, intraday])

  // ── Indicator toggle ───────────────────────────────────────────────────────

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  // ── Run analysis ───────────────────────────────────────────────────────────

  const runAnalysis = useCallback(async (type: AnalysisKey, overrideParams?: typeof params) => {
    if (!chartData.length) return
    setActiveAnalysis(type); setAnalysisLoading(true); setAnalysisData(null)

    const p = overrideParams ?? params
    const closes = chartData.map((d) => d.close)
    const n = closes.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null

    switch (type) {
      case 'macd': {
        const { macdLine, signalLine, histogram } = calcMACD(closes, p.macdFast, p.macdSlow, p.macdSignal)
        const last = n - 1
        result = {
          macd: macdLine[last], signal: signalLine[last], histogram: histogram[last],
          histHist: histogram.slice(-20),
          crossover:
            (histogram[last] ?? 0) > 0 && (histogram[last - 1] ?? 0) <= 0 ? 'bullish'
            : (histogram[last] ?? 0) < 0 && (histogram[last - 1] ?? 0) >= 0 ? 'bearish'
            : 'none',
          fast: p.macdFast, slow: p.macdSlow, signalPeriod: p.macdSignal,
        }; break
      }
      case 'rsi': {
        const vals = calcRSI(closes, p.rsiPeriod)
        const cur  = vals[n - 1] ?? 50
        result = { current: cur, zone: cur > 70 ? 'overbought' : cur < 30 ? 'oversold' : 'neutral', period: p.rsiPeriod }; break
      }
      case 'zscore': {
        result = { current: calcZScore(closes, p.zWindow)[n - 1], window: p.zWindow }; break
      }
      case 'meanrev': {
        const smaN = sma(closes, p.meanrevPeriod)
        const last = closes[n - 1]
        const m    = smaN[n - 1]
        result = { price: last, sma: m, period: p.meanrevPeriod, deviation: m != null ? ((last - m) / m) * 100 : 0 }; break
      }
      case 'momentum': {
        const r3m  = n >= 63  ? ((closes[n-1] - closes[n-63])  / closes[n-63])  * 100 : null
        const r6m  = n >= 126 ? ((closes[n-1] - closes[n-126]) / closes[n-126]) * 100 : null
        const r12m = n >= 252 ? ((closes[n-1] - closes[n-252]) / closes[n-252]) * 100 : null
        const score = ((r3m ?? 0) + (r6m ?? 0) + (r12m ?? 0)) / [r3m, r6m, r12m].filter((v) => v != null).length
        result = { r3m, r6m, r12m, score }; break
      }
      case 'sharpe': {
        result = { ratio: calcSharpe(closes, p.sharpRfr / 100), rfr: p.sharpRfr }; break
      }
      case 'montecarlo': {
        result = calcMonteCarlo(closes, p.mcDays, p.mcSims, p.mcHistBars); break
      }
      case 'volprofile': {
        const buckets = p.volBuckets
        const high = Math.max(...chartData.map((d) => d.high))
        const low  = Math.min(...chartData.map((d) => d.low))
        const step = (high - low) / buckets
        const profile = Array.from({ length: buckets }, (_, i) => ({
          priceFrom: low + i * step, priceTo: low + (i + 1) * step, volume: 0,
        }))
        chartData.forEach((d) => {
          const mid = (d.high + d.low) / 2
          const idx = Math.min(Math.floor((mid - low) / step), buckets - 1)
          profile[idx].volume += d.volume
        })
        const maxVol = Math.max(...profile.map((p) => p.volume))
        result = { profile: profile.reverse(), maxVol, buckets }; break
      }
      case 'rsvsspx': {
        try {
          const res    = await fetch(`/api/stock/chart?symbol=%5EGSPC&period=${period}`)
          const spxJson = await res.json() as { data: OHLCV[] }
          const spxC   = spxJson.data.map((d) => d.close)
          const len    = Math.min(closes.length, spxC.length)
          const sr     = len > 1 ? ((closes[len-1] - closes[0]) / closes[0]) * 100 : 0
          const spxR   = len > 1 ? ((spxC[len-1]  - spxC[0])   / spxC[0])   * 100 : 0
          result = { stockReturn: sr, spxReturn: spxR, alpha: sr - spxR }
        } catch {
          result = { error: true }
        }
        break
      }
    }

    setAnalysisData(result)
    setAnalysisLoading(false)
  }, [chartData, period, params])

  // ── AI Analysis ────────────────────────────────────────────────────────────

  const runAI = useCallback(async () => {
    if (!chartData.length || !ticker) return
    setAiLoading(true); setAiResponse(null)

    const closes = chartData.map((d) => d.close)
    const last   = closes[closes.length - 1]
    const rsiV   = calcRSI(closes)
    const rsi    = rsiV[rsiV.length - 1]?.toFixed(1) ?? 'N/A'
    const s20    = (sma(closes, 20)[closes.length - 1] ?? 0).toFixed(2)
    const s50    = (sma(closes, 50)[closes.length - 1] ?? 0).toFixed(2)
    const zs     = (calcZScore(closes)[closes.length - 1] ?? 0).toFixed(2)
    const { macdLine, signalLine } = calcMACD(closes)
    const macdV  = (macdLine[closes.length - 1] ?? 0).toFixed(3)
    const sigV   = (signalLine[closes.length - 1] ?? 0).toFixed(3)
    const sharpe = calcSharpe(closes)?.toFixed(2) ?? 'N/A'

    const prompt =
      `Analyze ${ticker} (${period} chart). Price: $${last.toFixed(2)}. ` +
      `RSI(14): ${rsi}. SMA20: $${s20}, SMA50: $${s50}. ` +
      `MACD: ${macdV}, Signal: ${sigV}. Z-Score: ${zs}. Sharpe: ${sharpe}. ` +
      `Active overlays: ${Array.from(activeIndicators).join(', ')}. ` +
      `Give a concise educational summary of what these technicals indicate.`

    try {
      const res  = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      })
      const json = await res.json() as { response?: string; error?: string }
      setAiResponse(json.response ?? json.error ?? 'No response received.')
    } catch {
      setAiResponse('Failed to reach the AI. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }, [chartData, ticker, period, activeIndicators])

  // Re-run analysis when params change while a panel is open
  const prevAnalysisRef = useRef<AnalysisKey | null>(null)
  useEffect(() => {
    if (activeAnalysis && activeAnalysis === prevAnalysisRef.current && chartData.length) {
      runAnalysis(activeAnalysis)
    }
    prevAnalysisRef.current = activeAnalysis
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // ── Analysis panel ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderAnalysisPanel = (d: any) => {
    if (!d) return null
    switch (activeAnalysis) {
      case 'macd': {
        const bull = d.crossover === 'bullish', bear = d.crossover === 'bearish'
        return (
          <div>
            <ParamRow>
              <ParamSlider label="Fast EMA" value={params.macdFast}   min={3}  max={30}  onChange={v => setParam('macdFast',   v)} />
              <ParamSlider label="Slow EMA" value={params.macdSlow}   min={10} max={60}  onChange={v => setParam('macdSlow',   v)} />
              <ParamSlider label="Signal"   value={params.macdSignal} min={3}  max={20}  onChange={v => setParam('macdSignal', v)} />
            </ParamRow>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="MACD"      value={d.macd?.toFixed(4)      ?? 'N/A'} />
              <Stat label="Signal"    value={d.signal?.toFixed(4)    ?? 'N/A'} />
              <Stat label="Histogram" value={d.histogram?.toFixed(4) ?? 'N/A'}
                color={(d.histogram ?? 0) >= 0 ? '#00C896' : '#FF4D4D'} />
            </div>
            {(bull || bear) && (
              <p className={`text-sm font-semibold mb-3 ${bull ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                {bull ? '▲ Bullish crossover detected' : '▼ Bearish crossover detected'}
              </p>
            )}
            <MiniHistogram data={d.histHist} />
            <p className="text-[#8A99B3] text-xs mt-3 leading-relaxed">
              MACD above the signal line = bullish momentum building. Below = bearish. Histogram crossovers at zero signal potential trend changes.
            </p>
          </div>
        )
      }
      case 'rsi': {
        const v = d.current ?? 50
        const col = v > 70 ? '#FF4D4D' : v < 30 ? '#00C896' : '#F0F4FF'
        return (
          <div>
            <ParamRow>
              <ParamSlider label="Period" value={params.rsiPeriod} min={5} max={30} onChange={v => setParam('rsiPeriod', v)} />
            </ParamRow>
            <div className="flex items-end gap-4 mb-4">
              <span className="text-5xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: col }}>
                {v.toFixed(1)}
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: col }}>
                  {v > 70 ? 'Overbought' : v < 30 ? 'Oversold' : 'Neutral Zone'}
                </p>
                <p className="text-[#8A99B3] text-xs">RSI ({d.period}-period)</p>
              </div>
            </div>
            <div className="w-full h-2 bg-[#1E2D4A] rounded-full overflow-hidden mb-4">
              <div className="h-full rounded-full" style={{
                width: `${Math.min(v, 100)}%`,
                backgroundColor: col,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <p className="text-[#8A99B3] text-xs leading-relaxed">
              RSI &gt; 70: overbought — extended rally, watch for pullback. RSI &lt; 30: oversold — selling may be exhausted. Context (trend, volume, sector) always matters.
            </p>
          </div>
        )
      }
      case 'zscore': {
        const v = d.current ?? 0
        const abs = Math.abs(v)
        return (
          <div>
            <ParamRow>
              <ParamSlider label="Window" value={params.zWindow} min={10} max={60} onChange={v => setParam('zWindow', v)} />
            </ParamRow>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-5xl font-bold" style={{
                fontFamily: 'var(--font-syne)',
                color: abs > 2 ? '#FF4D4D' : abs > 1 ? '#F59E0B' : '#F0F4FF',
              }}>
                {v?.toFixed(2) ?? 'N/A'}
              </span>
              <p className="text-[#8A99B3] text-sm pb-1">std deviations from {d.window}-day mean</p>
            </div>
            <p className="text-[#8A99B3] text-xs leading-relaxed">
              {abs > 2
                ? `Price is ${abs.toFixed(1)}σ from its mean — statistically extreme. Mean-reversion traders look to fade the move.`
                : abs > 1
                ? 'Price is moderately stretched. Not extreme yet, worth watching.'
                : 'Price is near its statistical mean — no significant deviation.'}
              {' '}Z-score above +2 or below −2 occurs only ~5% of the time historically.
            </p>
          </div>
        )
      }
      case 'meanrev': {
        const dev = d.deviation ?? 0
        return (
          <div>
            <ParamRow>
              <ParamSlider label="SMA Period" value={params.meanrevPeriod} min={5} max={200} onChange={v => setParam('meanrevPeriod', v)} />
            </ParamRow>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Current Price"           value={`$${d.price?.toFixed(2) ?? 'N/A'}`} />
              <Stat label={`${d.period}-Day SMA`}   value={`$${d.sma?.toFixed(2)  ?? 'N/A'}`} />
              <Stat label="Deviation"
                value={`${dev >= 0 ? '+' : ''}${dev?.toFixed(2)}%`}
                color={Math.abs(dev) > 5 ? '#FF4D4D' : '#00C896'} />
            </div>
            <p className="text-[#8A99B3] text-xs leading-relaxed">
              {Math.abs(dev) > 5
                ? `Price is ${Math.abs(dev).toFixed(1)}% ${dev > 0 ? 'above' : 'below'} the ${d.period}-day SMA — statistically stretched. Watch for a reversion to the mean.`
                : `Price is close to its ${d.period}-day average — no extreme deviation.`}
            </p>
          </div>
        )
      }
      case 'momentum': {
        const { r3m, r6m, r12m, score } = d
        const fmt = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : 'N/A'
        const col = (v: number | null) => v == null ? '#8A99B3' : v >= 0 ? '#00C896' : '#FF4D4D'
        const label = score > 20 ? 'Strong Bull' : score > 0 ? 'Mild Bull' : score > -20 ? 'Mild Bear' : 'Strong Bear'
        const lCol  = score > 20 ? '#00C896' : score > 0 ? '#4FA3FF' : score > -20 ? '#F59E0B' : '#FF4D4D'
        return (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="3-Month"  value={fmt(r3m)}  color={col(r3m)} />
              <Stat label="6-Month"  value={fmt(r6m)}  color={col(r6m)} />
              <Stat label="12-Month" value={fmt(r12m)} color={col(r12m)} />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[#8A99B3] text-xs">Avg Momentum Score:</span>
              <span className="font-bold text-base" style={{ color: lCol }}>{fmt(score)}</span>
              <span className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: lCol, color: lCol }}>{label}</span>
            </div>
            <p className="text-[#8A99B3] text-xs leading-relaxed">
              Momentum investing assumes assets moving in a direction tend to continue. Positive across all three periods = strongest signal. Divergence between short and long-term may indicate a trend change.
            </p>
          </div>
        )
      }
      case 'rsvsspx': {
        if (d.error) return <p className="text-[#FF4D4D] text-sm">Could not fetch S&P 500 data for comparison.</p>
        const { stockReturn, spxReturn, alpha } = d
        const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
        return (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label={ticker}  value={fmt(stockReturn)}  color={stockReturn >= 0 ? '#00C896' : '#FF4D4D'} />
              <Stat label="S&P 500" value={fmt(spxReturn)}   color={spxReturn  >= 0 ? '#00C896' : '#FF4D4D'} />
              <Stat label="Alpha"   value={fmt(alpha)}        color={alpha      >= 0 ? '#00C896' : '#FF4D4D'} />
            </div>
            <p className="text-[#8A99B3] text-xs leading-relaxed">
              {alpha > 0
                ? `${ticker} outperformed the S&P 500 by ${alpha.toFixed(1)}% — positive relative strength.`
                : `${ticker} underperformed the S&P 500 by ${Math.abs(alpha).toFixed(1)}% — relative weakness.`}
            </p>
          </div>
        )
      }
      case 'sharpe': {
        const r = d.ratio ?? 0
        const col = r > 1 ? '#00C896' : r > 0 ? '#F59E0B' : '#FF4D4D'
        const label = r > 2 ? 'Excellent' : r > 1 ? 'Good' : r > 0 ? 'Below Average' : 'Poor'
        return (
          <div>
            <ParamRow>
              <ParamSlider label="Risk-Free Rate (%)" value={params.sharpRfr} min={0} max={10} step={0.5} onChange={v => setParam('sharpRfr', v)} />
            </ParamRow>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-5xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: col }}>
                {r.toFixed(2)}
              </span>
              <div className="pb-1">
                <p className="text-sm font-semibold" style={{ color: col }}>{label}</p>
                <p className="text-[#8A99B3] text-xs">Annualized Sharpe (RFR: {d.rfr}%)</p>
              </div>
            </div>
            <p className="text-[#8A99B3] text-xs leading-relaxed">
              Sharpe Ratio = return per unit of risk vs the risk-free rate. Above 1 = good, above 2 = excellent. Negative = underperforming T-bills. Use to compare strategies, not as a buy/sell signal.
            </p>
          </div>
        )
      }
      case 'montecarlo': {
        if (!d) return <p className="text-[#FF4D4D] text-sm">Insufficient data (need at least 10 data points).</p>
        return (
          <div>
            <ParamRow>
              <ParamSelect label="Simulations" value={params.mcSims}
                options={[{v:100,l:'100'},{v:300,l:'300'},{v:500,l:'500'},{v:1000,l:'1,000'}]}
                onChange={v => setParam('mcSims', v)} />
              <ParamSelect label="Forecast"  value={params.mcDays}
                options={[{v:30,l:'30d'},{v:60,l:'60d'},{v:90,l:'90d'},{v:180,l:'180d'},{v:365,l:'1yr'}]}
                onChange={v => setParam('mcDays', v)} />
              <ParamSelect label="Hist. Data" value={params.mcHistBars}
                options={[{v:0,l:'All'},{v:30,l:'30 bars'},{v:60,l:'60 bars'},{v:126,l:'6mo'},{v:252,l:'1yr'}]}
                onChange={v => setParam('mcHistBars', v)} />
            </ParamRow>
            <p className="text-[#8A99B3] text-[10px] mb-3">
              {d.sims} simulations · {d.days}-day horizon · {d.histBars} bars of history
            </p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {([['10th %', d.p10], ['25th %', d.p25], ['Median', d.p50], ['75th %', d.p75], ['90th %', d.p90]] as [string, number][]).map(([label, val]) => (
                <Stat key={label} label={label} value={`$${val?.toFixed(0) ?? '—'}`}
                  color={val >= d.current ? '#00C896' : '#FF4D4D'} />
              ))}
            </div>
            <p className="text-sm font-semibold mb-2" style={{ color: Number(d.probAbove) >= 50 ? '#00C896' : '#FF4D4D' }}>
              {d.probAbove}% of simulations ended above today&apos;s price
            </p>
            <p className="text-[#8A99B3] text-xs leading-relaxed">
              Monte Carlo simulates possible future price paths using historical volatility and drift. The output is a probability distribution — not a prediction.
            </p>
          </div>
        )
      }
      case 'volprofile': {
        const { profile, maxVol } = d
        const totalVol = profile.reduce((a: number, pp: { volume: number }) => a + pp.volume, 0)
        return (
          <div>
            <ParamRow>
              <ParamSlider label="Price Buckets" value={params.volBuckets} min={5} max={20} onChange={v => setParam('volBuckets', v)} />
            </ParamRow>
            <p className="text-[#8A99B3] text-xs mb-3">Price levels ranked by volume concentration ({d.buckets} buckets):</p>
            <div className="space-y-1.5">
              {profile.slice(0, Math.min(d.buckets, 10)).map((p: { priceFrom: number; volume: number }, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8A99B3] w-20 text-right shrink-0">
                    ${p.priceFrom.toFixed(2)}
                  </span>
                  <div className="flex-1 h-4 bg-[#1E2D4A] rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm transition-all" style={{
                      width: `${(p.volume / maxVol) * 100}%`,
                      backgroundColor: i === 0 ? '#2F80ED' : '#2F80ED44',
                    }} />
                  </div>
                  <span className="text-[10px] text-[#8A99B3] w-12 shrink-0">
                    {((p.volume / totalVol) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[#8A99B3] text-xs mt-3 leading-relaxed">
              The Point of Control (blue bar) is the price level with the most volume — a strong S/R magnet. High-volume nodes anchor price; low-volume zones = fast moves.
            </p>
          </div>
        )
      }
    }
    return null
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
            Technical Analysis
          </h1>
          <p className="text-[#8A99B3] text-sm mt-0.5">Charts, indicators & statistical analysis</p>
        </div>
        {stockInfo && (
          <div className="text-right">
            <p className="text-[#F0F4FF] font-semibold text-sm">{stockInfo.name}</p>
            <p>
              <span className="text-[#F0F4FF] font-bold">${stockInfo.price.toFixed(2)}</span>
              <span className={`ml-2 text-xs ${stockInfo.change >= 0 ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                {stockInfo.change >= 0 ? '+' : ''}{stockInfo.change.toFixed(2)}
                {' '}({stockInfo.changePercent >= 0 ? '+' : ''}{stockInfo.changePercent.toFixed(2)}%)
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A99B3]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Ticker symbol — e.g. AAPL"
            className="w-full bg-[#0F1729] border border-[#1E2D4A] focus:border-[#2F80ED] text-[#F0F4FF] text-sm pl-9 pr-4 py-2.5 rounded-[4px] outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          className="bg-[#2F80ED] hover:bg-[#4FA3FF] text-white text-sm font-semibold px-5 py-2.5 rounded-[4px] transition-colors"
        >
          Load
        </button>
      </form>

      {/* Empty state */}
      {!ticker && !loading && (
        <div className="flex flex-col items-center justify-center h-64 bg-[#0F1729] border border-[#1E2D4A] rounded-[6px]">
          <TrendingUp size={36} className="text-[#1E2D4A] mb-3" />
          <p className="text-[#8A99B3] text-sm">Enter a ticker symbol to load the chart</p>
          <p className="text-[#2F80ED]/40 text-xs mt-1">AAPL · TSLA · NVDA · MSFT · AMZN</p>
        </div>
      )}

      {ticker && (
        <>
          {/* Period selector */}
          <div className="flex items-center gap-1 mb-3">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => handlePeriod(p)}
                className="text-xs px-3 py-1.5 rounded-[4px] font-medium transition-colors"
                style={{
                  backgroundColor: period === p ? '#2F80ED' : 'transparent',
                  color:           period === p ? '#fff'    : '#8A99B3',
                  border:          `1px solid ${period === p ? '#2F80ED' : '#1E2D4A'}`,
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Chart container */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] overflow-hidden mb-4 relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0A0F1E]/80 z-10">
                <p className="text-[#8A99B3] text-sm">Loading chart…</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <p className="text-[#FF4D4D] text-sm">{error}</p>
              </div>
            )}
            <div ref={containerRef} className="w-full" />
          </div>

          {/* Indicator toggles */}
          <div className="mb-4">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-2 font-medium">
              Overlay Indicators
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(INDICATOR_LABELS) as [IndicatorKey, string][]).map(([key, label]) => {
                const active = activeIndicators.has(key)
                const vwapOnly = key === 'vwap' && !intraday
                return (
                  <button
                    key={key}
                    onClick={() => toggleIndicator(key)}
                    disabled={vwapOnly}
                    title={vwapOnly ? 'VWAP available on 1D and 5D only' : undefined}
                    className="text-[11px] px-3 py-1 rounded-[4px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: active ? '#2F80ED1A' : 'transparent',
                      color:           active ? '#4FA3FF'   : '#8A99B3',
                      border:          `1px solid ${active ? '#2F80ED' : '#1E2D4A'}`,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Analysis buttons */}
          <div className="mb-4">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-2 font-medium">
              Statistical Analysis
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ANALYSIS_BTNS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => runAnalysis(key)}
                  className="text-[11px] px-3 py-1 rounded-[4px] font-medium transition-colors"
                  style={{
                    backgroundColor: activeAnalysis === key ? '#2F80ED1A' : 'transparent',
                    color:           activeAnalysis === key ? '#F0F4FF'   : '#8A99B3',
                    border:          `1px solid ${activeAnalysis === key ? '#2F80ED' : '#1E2D4A'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Analysis results panel */}
          {activeAnalysis && (
            <div className="bg-[#0F1729] border border-[#1E2D4A] card-glow rounded-[6px] p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {ANALYSIS_BTNS.find((b) => b.key === activeAnalysis)?.label}
                  {ticker && <span className="text-[#8A99B3] font-normal ml-2">— {ticker}</span>}
                </h3>
                <button
                  onClick={() => { setActiveAnalysis(null); setAnalysisData(null) }}
                  className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {analysisLoading
                ? <p className="text-[#8A99B3] text-sm animate-pulse">Calculating…</p>
                : renderAnalysisPanel(analysisData)}
            </div>
          )}

          {/* AI Analysis */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-[#2F80ED]" />
                <h3 className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  AI Technical Analysis
                </h3>
              </div>
              <button
                onClick={runAI}
                disabled={aiLoading || !chartData.length}
                className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5"
              >
                {aiLoading && (
                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin inline-block" />
                )}
                {aiLoading ? 'Analyzing…' : 'Run AI Analysis'}
              </button>
            </div>
            {aiResponse ? (
              <p className="text-[#F0F4FF] text-sm leading-relaxed">{aiResponse}</p>
            ) : (
              <p className="text-[#8A99B3] text-sm">
                Load a chart, then click &quot;Run AI Analysis&quot; for an educational summary of the current technicals.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Stat({ label, value, color = '#F0F4FF' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] px-3 py-2">
      <p className="text-[10px] text-[#8A99B3] mb-0.5 truncate">{label}</p>
      <p className="text-sm font-bold truncate" style={{ color }}>{value}</p>
    </div>
  )
}

function ParamRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-[#1E2D4A]">
      {children}
    </div>
  )
}

function ParamSlider({
  label, value, min, max, step = 1, onChange,
}: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-[#8A99B3] uppercase tracking-wide">{label}</span>
        <span className="text-[11px] font-semibold text-[#4FA3FF]">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 appearance-none bg-[#1E2D4A] rounded-full cursor-pointer accent-[#2F80ED]"
      />
    </div>
  )
}

function ParamSelect({
  label, value, options, onChange,
}: { label: string; value: number; options: { v: number; l: string }[]; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-[#8A99B3] uppercase tracking-wide">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {options.map(o => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="text-[10px] px-2 py-0.5 rounded-[3px] border transition-colors"
            style={{
              backgroundColor: value === o.v ? '#2F80ED1A' : 'transparent',
              color:           value === o.v ? '#4FA3FF'   : '#8A99B3',
              borderColor:     value === o.v ? '#2F80ED'   : '#1E2D4A',
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )
}

function MiniHistogram({ data }: { data: (number | null)[] }) {
  const valid = (data ?? []).filter((v): v is number => v != null)
  if (!valid.length) return null
  const max = Math.max(...valid.map(Math.abs), 1)
  return (
    <div className="flex items-end gap-px h-8 mt-1">
      {valid.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${(Math.abs(v) / max) * 100}%`,
            minHeight: 2,
            backgroundColor: v >= 0 ? '#00C896' : '#FF4D4D',
          }}
        />
      ))}
    </div>
  )
}
