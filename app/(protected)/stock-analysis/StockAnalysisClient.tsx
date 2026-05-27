'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Info, Bot, ExternalLink, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  CrosshairMode,
  type Time,
} from 'lightweight-charts'

// ── Types ──────────────────────────────────────────────────────────────────────

type Fundamentals = {
  symbol: string
  name: string
  sector: string | null
  industry: string | null
  country: string | null
  description: string | null
  price: number
  change: number
  changePercent: number
  peRatio: number | null
  forwardPE: number | null
  eps: number | null
  beta: number | null
  dividendYield: number | null
  marketCap: number | null
  enterpriseValue: number | null
  week52High: number | null
  week52Low: number | null
  revenue: number | null
  profitMargin: number | null
  roe: number | null
  debtToEquity: number | null
  sharesOutstanding: number | null
  nextEarningsDate: string | null
  analystRating: {
    buy: number; hold: number; sell: number
    strongBuy: number; strongSell: number
    total: number; consensus: string; period: string
  } | null
  analystPriceTarget: number | null
}

type AnalysisPeriod = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y'
type Signal = 'bullish' | 'neutral' | 'bearish'

type MCPoint = { day: number; p10: number; p25: number; p50: number; p75: number; p90: number }
type MonteCarloResult = { percentiles: MCPoint[]; currentPrice: number; horizon: number }

type MetricResult = {
  key: string
  label: string
  category: 'fundamental' | 'technical' | 'regime'
  value: string
  rawValue?: number | null
  signal: Signal
  explanation: string
}

type MCParams = { mu: number; sigma: number; drift: number; currentPrice: number }

type AIResult = {
  verdict: 'BUY' | 'WAIT' | 'AVOID'
  confidence: number
  summary: string
  fundamentalsScore: number
  technicalsScore: number
  regimeScore: number
  regime: {
    label: string
    confidence: number
    daysInRegime: number
    history?: { index: number; label: 'up' | 'down' | 'choppy' }[]
    distribution?: { up: number; choppy: number; down: number }
  }
  metrics: MetricResult[]
  monteCarlo?: MonteCarloResult | null
  monteCarloParams?: MCParams | null
  queriesUsed?: number
  queriesLimit?: number | null
  error?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PERIODS: { value: AnalysisPeriod; label: string }[] = [
  { value: '1mo', label: '1 Month' },
  { value: '3mo', label: '3 Months' },
  { value: '6mo', label: '6 Months' },
  { value: '1y',  label: '1 Year'   },
  { value: '2y',  label: '2 Years'  },
  { value: '5y',  label: '5 Years'  },
]

const VERDICT_CONFIG = {
  BUY:   { color: '#00C896', bg: 'rgba(0,200,150,0.08)',  border: 'rgba(0,200,150,0.25)',  label: 'BUY'  },
  WAIT:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: 'WAIT' },
  AVOID: { color: '#FF4D4D', bg: 'rgba(255,77,77,0.08)',  border: 'rgba(255,77,77,0.25)',  label: 'AVOID'},
}

const SIGNAL_CONFIG: Record<Signal, { color: string; label: string }> = {
  bullish: { color: '#00C896', label: 'Bullish' },
  neutral: { color: '#8A99B3', label: 'Neutral' },
  bearish: { color: '#FF4D4D', label: 'Bearish' },
}

const TOOLTIPS: Record<string, string> = {
  peRatio:          "Price-to-Earnings: how much investors pay per $1 of earnings. Context matters — growth stocks trade at higher multiples.",
  forwardPE:        "Uses next year's estimated earnings. Lower forward P/E than trailing suggests analysts expect earnings growth.",
  eps:              "Earnings Per Share (TTM): net profit divided by shares outstanding over the last 12 months.",
  beta:             "Volatility vs the S&P 500. Beta > 1 = more volatile than the market. Beta < 0 = moves inversely.",
  dividendYield:    "Annual dividend as a percentage of stock price. Only relevant if the company pays dividends.",
  marketCap:        "Total market value of all shares. Large-cap >$10B, Mid-cap $2B–$10B, Small-cap <$2B.",
  enterpriseValue:  "Market cap plus net debt — the theoretical cost to acquire the entire company.",
  week52:           "Price range over the last 52 weeks — helps gauge momentum and relative valuation.",
  revenue:          "Total revenue (TTM): total income from business operations over the last 12 months.",
  profitMargin:     "Net profit as a percentage of revenue. Higher = more efficient at converting sales to earnings.",
  roe:              "Return on Equity: profit generated per dollar of shareholder equity. Above 15% is strong.",
  debtToEquity:     "Total debt relative to shareholder equity. High D/E amplifies both returns and risk.",
  sharesOutstanding:"Total shares in existence. Dilution (new shares issued) reduces existing holders' percentage.",
  nextEarnings:     "The next scheduled earnings release date — often a catalyst for price movement.",
  analystRating:    "Consensus analyst recommendation from Wall Street. Treat as context, not a signal — analysts lag the market.",
  priceTarget:      "Average analyst 12-month price target. Compare to current price to estimate implied upside/downside.",
}

// ── Monte Carlo constants ──────────────────────────────────────────────────────

const MC_HORIZONS: { label: string; days: number }[] = [
  { label: '1 Day',      days: 1   },
  { label: '3 Days',     days: 3   },
  { label: '7 Days',     days: 7   },
  { label: '14 Days',    days: 14  },
  { label: '30 Days',    days: 30  },
  { label: '60 Days',    days: 60  },
  { label: '90 Days',    days: 90  },
  { label: 'Half-Year',  days: 126 },
  { label: '1 Year',     days: 252 },
  { label: '2 Years',    days: 504 },
]

const MC_SIMS_OPTIONS = [100, 500, 1_000, 2_000, 5_000]

function clientMC(params: MCParams, horizon: number, simulations: number): MonteCarloResult {
  const { drift, sigma, currentPrice } = params
  function randn(): number {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const maxCp = Math.min(10, horizon)
  const step = Math.max(1, Math.ceil(horizon / maxCp))
  const checkpoints: number[] = []
  for (let d = step; d < horizon; d += step) checkpoints.push(d)
  checkpoints.push(horizon)
  const buckets: number[][] = checkpoints.map(() => [])
  for (let s = 0; s < simulations; s++) {
    let price = currentPrice; let cpIdx = 0
    for (let d = 1; d <= horizon; d++) {
      price *= Math.exp(drift + sigma * randn())
      if (cpIdx < checkpoints.length && d === checkpoints[cpIdx]) { buckets[cpIdx].push(price); cpIdx++ }
    }
  }
  function pct(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = (p / 100) * (sorted.length - 1)
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }
  return {
    percentiles: checkpoints.map((day, i) => ({ day, p10: pct(buckets[i], 10), p25: pct(buckets[i], 25), p50: pct(buckets[i], 50), p75: pct(buckets[i], 75), p90: pct(buckets[i], 90) })),
    currentPrice,
    horizon,
  }
}

// ── Helper formatters ──────────────────────────────────────────────────────────

function fmtLargeNum(n: number | null): string {
  if (n == null) return 'N/A'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function fmtShares(n: number | null): string {
  if (n == null) return 'N/A'
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

// ── SVG Arc Gauge (RSI, regime confidence) ─────────────────────────────────────

function ArcGauge({
  value,
  min = 0,
  max = 100,
  bearishBelow,
  bullishAbove,
}: {
  value: number
  min?: number
  max?: number
  bearishBelow?: number
  bullishAbove?: number
}) {
  const cx = 52, cy = 52, r = 42
  const clamp = (v: number) => Math.min(0.995, Math.max(0.005, v))
  const pct = clamp((value - min) / (max - min))
  const theta = (1 - pct) * Math.PI
  const nx = cx + r * Math.cos(theta)
  const ny = cy - r * Math.sin(theta)

  let fillColor = '#8A99B3'
  if (bearishBelow != null && value < bearishBelow) fillColor = '#FF4D4D'
  else if (bullishAbove != null && value > bullishAbove) fillColor = '#00C896'

  // Tick marks at zone thresholds
  const ticks = [bearishBelow, bullishAbove].filter((t): t is number => t != null)

  return (
    <svg viewBox="0 0 104 62" style={{ width: '100%', maxWidth: 120, height: 'auto' }}>
      {/* Background track */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#1E2D4A" strokeWidth={8} strokeLinecap="round" />
      {/* Filled arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
        fill="none" stroke={fillColor} strokeWidth={8} strokeLinecap="round" />
      {/* Zone tick marks */}
      {ticks.map((t, i) => {
        const tp = clamp((t - min) / (max - min))
        const tt = (1 - tp) * Math.PI
        const ix = cx + (r - 6) * Math.cos(tt), iy = cy - (r - 6) * Math.sin(tt)
        const ox = cx + (r + 6) * Math.cos(tt), oy = cy - (r + 6) * Math.sin(tt)
        const lx = cx + (r + 14) * Math.cos(tt), ly = cy - (r + 14) * Math.sin(tt)
        return (
          <g key={i}>
            <line x1={ix} y1={iy} x2={ox} y2={oy} stroke="#0A0F1E" strokeWidth={2} />
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize={7} fill="#8A99B3">{t}</text>
          </g>
        )
      })}
      {/* Center value */}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={17} fontWeight="bold"
        fill={fillColor} style={{ fontFamily: 'var(--font-syne)' }}>
        {value.toFixed(value < 10 ? 1 : 0)}
      </text>
    </svg>
  )
}

// ── CSS-based mini bars ────────────────────────────────────────────────────────

function CenterBar({ value, maxAbs = 20, suffix = '%' }: { value: number; maxAbs?: number; suffix?: string }) {
  const pct = Math.min(Math.abs(value) / maxAbs, 1) * 50
  const isPos = value >= 0
  const color = isPos ? '#00C896' : '#FF4D4D'
  return (
    <div className="mt-1.5 space-y-0.5">
      <div className="relative h-2.5 bg-[#1E2D4A] rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-px bg-[#2F80ED]/60 left-1/2 z-10" />
        <div className="absolute top-0 bottom-0 rounded-full"
          style={{ [isPos ? 'left' : 'right']: '50%', width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-[8px] text-[#8A99B3]">
        <span>−{maxAbs}{suffix}</span>
        <span className="font-bold" style={{ color }}>{isPos ? '+' : ''}{value.toFixed(1)}{suffix}</span>
        <span>+{maxAbs}{suffix}</span>
      </div>
    </div>
  )
}

function BandBar({ value }: { value: number }) {
  const color = value < 20 ? '#00C896' : value > 80 ? '#FF4D4D' : '#8A99B3'
  return (
    <div className="mt-1.5">
      <div className="relative h-2.5 rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(to right, rgba(0,200,150,0.25) 0%, rgba(30,45,74,1) 20%, rgba(30,45,74,1) 80%, rgba(255,77,77,0.25) 100%)' }}>
        <div className="absolute top-0 bottom-0 w-1 -translate-x-1/2 rounded-full" style={{ left: `${value}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-[8px] text-[#8A99B3] mt-0.5">
        <span className="text-[#00C896]">Lower band</span>
        <span className="font-bold" style={{ color }}>{value.toFixed(0)}th %ile</span>
        <span className="text-[#FF4D4D]">Upper band</span>
      </div>
    </div>
  )
}

function VolumeBar({ value }: { value: number }) {
  const color = value >= 1.2 ? '#00C896' : value <= 0.8 ? '#FF4D4D' : '#F59E0B'
  const cap = 2.5
  const pct = Math.min(value / cap, 1) * 100
  const avgPct = (1.0 / cap) * 100
  return (
    <div className="mt-1.5">
      <div className="relative h-2.5 bg-[#1E2D4A] rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }} />
        <div className="absolute top-0 bottom-0 w-px bg-[#2F80ED]" style={{ left: `${avgPct}%` }} />
      </div>
      <div className="flex justify-between text-[8px] text-[#8A99B3] mt-0.5">
        <span>0×</span>
        <span className="font-bold" style={{ color }}>{value.toFixed(2)}× avg</span>
        <span>2.5×</span>
      </div>
    </div>
  )
}

function MiniBar({ value, max, colorFn }: { value: number; max: number; colorFn: (v: number) => string }) {
  const pct = Math.min(Math.abs(value) / max, 1) * 100
  const color = colorFn(value)
  return (
    <div className="mt-1.5">
      <div className="h-2.5 bg-[#1E2D4A] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Monte Carlo SVG Chart ──────────────────────────────────────────────────────

function MonteCarloChart({ mc, currentPrice }: { mc: MonteCarloResult; currentPrice: number }) {
  const W = 700, H = 260
  const pad = { top: 24, right: 110, bottom: 42, left: 58 }
  const cW = W - pad.left - pad.right
  const cH = H - pad.top - pad.bottom

  const allPoints: MCPoint[] = [
    { day: 0, p10: currentPrice, p25: currentPrice, p50: currentPrice, p75: currentPrice, p90: currentPrice },
    ...mc.percentiles,
  ]
  const maxDay = mc.horizon
  const allPrices = allPoints.flatMap(p => [p.p10, p.p90])
  const minP = Math.min(...allPrices) * 0.975
  const maxP = Math.max(...allPrices) * 1.025

  const x = (day: number) => pad.left + (day / maxDay) * cW
  const y = (price: number) => pad.top + cH - ((price - minP) / (maxP - minP)) * cH

  const line = (key: keyof Omit<MCPoint, 'day'>) =>
    allPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.day).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ')

  const band = (upper: keyof Omit<MCPoint, 'day'>, lower: keyof Omit<MCPoint, 'day'>) => {
    const fwd = allPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.day).toFixed(1)} ${y(p[upper]).toFixed(1)}`).join(' ')
    const rev = [...allPoints].reverse().map(p => `L ${x(p.day).toFixed(1)} ${y(p[lower]).toFixed(1)}`).join(' ')
    return `${fwd} ${rev} Z`
  }

  const last = allPoints[allPoints.length - 1]
  const fmtP = (p: number) => `$${p.toFixed(2)}`
  const fmtChg = (p: number) => {
    const pct = ((p / currentPrice) - 1) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  const yTicks = 5
  const yTickVals = Array.from({ length: yTicks }, (_, i) => minP + (i / (yTicks - 1)) * (maxP - minP))
  const xTicks = [15, 30, 45, 60, 75, 90].filter(d => d <= maxDay)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Outer cone P10–P90 */}
      <path d={band('p90', 'p10')} fill="#4FA3FF" fillOpacity={0.06} />
      {/* Inner cone P25–P75 */}
      <path d={band('p75', 'p25')} fill="#4FA3FF" fillOpacity={0.13} />

      {/* Grid */}
      {yTickVals.map((v, i) => (
        <g key={i}>
          <line x1={pad.left} y1={y(v)} x2={pad.left + cW} y2={y(v)} stroke="#1E2D4A" strokeWidth={1} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" fontSize={9} fill="#8A99B3">
            ${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}
          </text>
        </g>
      ))}
      {xTicks.map(d => (
        <g key={d}>
          <line x1={x(d)} y1={pad.top} x2={x(d)} y2={pad.top + cH} stroke="#1E2D4A" strokeWidth={1} strokeDasharray="3,4" />
          <text x={x(d)} y={pad.top + cH + 15} textAnchor="middle" fontSize={9} fill="#8A99B3">{d}d</text>
        </g>
      ))}

      {/* Current price reference */}
      <line x1={pad.left} y1={y(currentPrice)} x2={pad.left + cW} y2={y(currentPrice)}
        stroke="#2F80ED" strokeWidth={1} strokeDasharray="5,4" opacity={0.5} />
      <text x={pad.left - 6} y={y(currentPrice) + 4} textAnchor="end" fontSize={8} fill="#2F80ED">now</text>

      {/* Percentile lines */}
      <path d={line('p90')} fill="none" stroke="#00C896" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.75} />
      <path d={line('p75')} fill="none" stroke="#00C896" strokeWidth={1}   opacity={0.45} />
      <path d={line('p50')} fill="none" stroke="#F0F4FF" strokeWidth={2.5} />
      <path d={line('p25')} fill="none" stroke="#FF4D4D" strokeWidth={1}   opacity={0.45} />
      <path d={line('p10')} fill="none" stroke="#FF4D4D" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.75} />

      {/* Current price dot */}
      <circle cx={x(0)} cy={y(currentPrice)} r={4} fill="#2F80ED" />

      {/* Right-side labels */}
      <text x={pad.left + cW + 8} y={y(last.p90) + 4} fontSize={9} fill="#00C896">
        {fmtP(last.p90)} <tspan fontSize={8} opacity={0.7}>({fmtChg(last.p90)})</tspan>
      </text>
      <text x={pad.left + cW + 8} y={y(last.p75) + 4} fontSize={8} fill="#00C896" opacity={0.6}>
        {fmtP(last.p75)}
      </text>
      <text x={pad.left + cW + 8} y={y(last.p50) + 4} fontSize={9} fill="#F0F4FF" fontWeight="bold">
        {fmtP(last.p50)} <tspan fontSize={8} opacity={0.6}>(median)</tspan>
      </text>
      <text x={pad.left + cW + 8} y={y(last.p25) + 4} fontSize={8} fill="#FF4D4D" opacity={0.6}>
        {fmtP(last.p25)}
      </text>
      <text x={pad.left + cW + 8} y={y(last.p10) + 4} fontSize={9} fill="#FF4D4D">
        {fmtP(last.p10)} <tspan fontSize={8} opacity={0.7}>({fmtChg(last.p10)})</tspan>
      </text>

      {/* Axis labels */}
      <text x={pad.left + cW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#8A99B3">Trading days from today</text>
    </svg>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  return (
    <div className="relative group inline-block">
      <Info size={10} className="text-[#2F80ED]/60 cursor-help hover:text-[#2F80ED] transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-[#1E2D4A] border border-[#2F80ED]/20 rounded-[4px] px-3 py-2 text-[11px] text-[#F0F4FF] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1E2D4A] border-r border-b border-[#2F80ED]/20 rotate-45 -mt-1" />
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color, tooltipKey }: {
  label: string; value: string; sub?: string; color?: string; tooltipKey?: string
}) {
  return (
    <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[10px] text-[#8A99B3] uppercase tracking-widest font-medium">{label}</p>
        {tooltipKey && TOOLTIPS[tooltipKey] && <Tooltip text={TOOLTIPS[tooltipKey]} />}
      </div>
      <p className="text-base font-bold truncate" style={{ color: color ?? '#F0F4FF', fontFamily: 'var(--font-syne)' }}>{value}</p>
      {sub && <p className="text-[10px] text-[#8A99B3] mt-0.5">{sub}</p>}
    </div>
  )
}

function ScoreBar({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100))
  const color = score >= 7 ? '#00C896' : score >= 5 ? '#F59E0B' : '#FF4D4D'
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-[#8A99B3]">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{score}/{max}</span>
      </div>
      <div className="h-2 bg-[#1E2D4A] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function ConfidenceArc({ value, color }: { value: number; color: string }) {
  const cx = 60, cy = 56, r = 48
  const pct = Math.min(0.995, Math.max(0.005, value / 100))
  const theta = (1 - pct) * Math.PI
  const nx = cx + r * Math.cos(theta), ny = cy - r * Math.sin(theta)
  return (
    <svg viewBox="0 0 120 68" style={{ width: 120, height: 68 }}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#1E2D4A" strokeWidth={10} strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
        fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={22} fontWeight="bold"
        fill={color} style={{ fontFamily: 'var(--font-syne)' }}>{value}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#8A99B3">confidence</text>
    </svg>
  )
}

function SignalBadge({ signal }: { signal: Signal }) {
  const { color, label } = SIGNAL_CONFIG[signal]
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[3px] flex items-center gap-1 shrink-0 whitespace-nowrap"
      style={{ backgroundColor: `${color}1A`, color, border: `1px solid ${color}33` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function AnalystBar(r: { buy: number; hold: number; sell: number; strongBuy: number; strongSell: number; total: number; period: string }) {
  const total = r.total || 1
  const segs = [
    { label: 'Strong Buy', count: r.strongBuy, color: '#00C896' },
    { label: 'Buy',        count: r.buy,       color: '#4FA3FF' },
    { label: 'Hold',       count: r.hold,      color: '#F59E0B' },
    { label: 'Sell',       count: r.sell,      color: '#FF6B6B' },
    { label: 'Strong Sell',count: r.strongSell,color: '#FF4D4D' },
  ]
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-2">
        {segs.map(s => s.count > 0 && (
          <div key={s.label} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color, minWidth: 2 }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segs.map(s => (
          <span key={s.label} className="text-[10px] font-medium" style={{ color: s.color }}>
            {s.label} <span className="opacity-70">({s.count})</span>
          </span>
        ))}
      </div>
      <p className="text-[#8A99B3] text-[10px] mt-1.5">Based on {total} ratings · {r.period}</p>
    </div>
  )
}

// ── Technical indicator card with inline viz ───────────────────────────────────

function TechCard({ metric }: { metric: MetricResult }) {
  const { color, label: sigLabel } = SIGNAL_CONFIG[metric.signal]
  const rv = metric.rawValue ?? null

  let viz: React.ReactNode = null
  if (rv != null) {
    switch (metric.key) {
      case 'rsi':
        viz = <ArcGauge value={rv} min={0} max={100} bearishBelow={30} bullishAbove={70} />
        break
      case 'bbPercentile':
        viz = <BandBar value={rv} />
        break
      case 'sma50Deviation':
      case 'sma200Deviation':
      case 'momentum3M':
        viz = <CenterBar value={rv} maxAbs={Math.max(20, Math.abs(rv) * 1.5)} />
        break
      case 'macdSignal':
        viz = (
          <div className="mt-1.5">
            <div className="relative h-2.5 bg-[#1E2D4A] rounded-full overflow-hidden">
              <div className="absolute top-0 bottom-0 w-px bg-[#2F80ED]/60 left-1/2 z-10" />
              <div className="absolute top-0 bottom-0 rounded-full"
                style={{
                  [rv >= 0 ? 'left' : 'right']: '50%',
                  width: '30%',
                  backgroundColor: rv >= 0 ? '#00C896' : '#FF4D4D',
                }} />
            </div>
            <p className="text-[8px] text-center mt-0.5" style={{ color: rv >= 0 ? '#00C896' : '#FF4D4D' }}>
              {rv >= 0 ? 'Bullish' : 'Bearish'} histogram
            </p>
          </div>
        )
        break
      case 'volumeRatio':
        viz = <VolumeBar value={rv} />
        break
      case 'atr':
        viz = (
          <MiniBar value={rv} max={rv * 2 || 1}
            colorFn={() => '#F59E0B'} />
        )
        break
    }
  }

  return (
    <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] text-[#8A99B3] uppercase tracking-widest font-medium">{metric.label}</p>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[2px] shrink-0 ml-2"
          style={{ backgroundColor: `${color}1A`, color }}>
          {sigLabel}
        </span>
      </div>
      <p className="text-xl font-bold text-[#F0F4FF] mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
        {metric.value}
      </p>
      {viz && <div className="mb-2">{viz}</div>}
      <p className="text-[10px] text-[#8A99B3] leading-relaxed">{metric.explanation}</p>
    </div>
  )
}

// ── Regime visualization card ─────────────────────────────────────────────────

function RegimeCard({ regime, metric }: {
  regime: {
    label: string
    confidence: number
    daysInRegime: number
    history?: { index: number; label: 'up' | 'down' | 'choppy' }[]
    distribution?: { up: number; choppy: number; down: number }
  }
  metric?: MetricResult
}) {
  const color = regime.label === 'Trending Up' ? '#00C896'
    : regime.label === 'Trending Down' ? '#FF4D4D' : '#F59E0B'

  const regimeIcon = regime.label === 'Trending Up' ? '↗' : regime.label === 'Trending Down' ? '↘' : '↔'

  const stateColor = (lbl: 'up' | 'down' | 'choppy') =>
    lbl === 'up' ? '#00C896' : lbl === 'down' ? '#FF4D4D' : '#F59E0B'

  return (
    <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-5">
      <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium mb-4">Market Regime (Statistical Detection)</p>
      <div className="flex flex-wrap items-center gap-6">
        {/* Confidence arc */}
        <ConfidenceArc value={regime.confidence} color={color} />

        {/* State info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl" style={{ color }}>{regimeIcon}</span>
            <p className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-syne)' }}>
              {regime.label}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest">Duration in Regime</p>
              <p className="text-base font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                ~{regime.daysInRegime} periods
              </p>
            </div>
            <div>
              <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest">Detection Method</p>
              <p className="text-xs text-[#8A99B3]">Rolling Sharpe signal · 20-period window</p>
            </div>
          </div>
          {metric && (
            <p className="text-[11px] text-[#8A99B3] leading-relaxed mt-3 pt-3 border-t border-[#1E2D4A]">
              {metric.explanation}
            </p>
          )}
        </div>

        {/* Current regime state tiles */}
        <div className="w-full grid grid-cols-3 gap-3">
          {[
            { label: 'Trending Up',   color: '#00C896', key: 'up'   as const, active: regime.label === 'Trending Up'   },
            { label: 'Choppy',        color: '#F59E0B', key: 'choppy' as const, active: regime.label === 'Choppy'       },
            { label: 'Trending Down', color: '#FF4D4D', key: 'down' as const, active: regime.label === 'Trending Down'  },
          ].map(s => (
            <div key={s.label}
              className="rounded-[4px] px-3 py-2 text-center border"
              style={{
                backgroundColor: s.active ? `${s.color}15` : 'transparent',
                borderColor: s.active ? `${s.color}40` : '#1E2D4A',
              }}>
              <p className="text-[10px] font-semibold" style={{ color: s.active ? s.color : '#8A99B3' }}>
                {s.label}
              </p>
              {s.active && (
                <p className="text-[8px] text-[#8A99B3] mt-0.5">{regime.confidence}% confidence</p>
              )}
              {regime.distribution && (
                <p className="text-[9px] font-bold mt-1" style={{ color: s.active ? s.color : '#4A5568' }}>
                  {regime.distribution[s.key]}% of period
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Distribution stacked bar */}
        {regime.distribution && (
          <div className="w-full">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-2 font-medium">Time Spent in Each State</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {regime.distribution.up > 0 && (
                <div style={{ width: `${regime.distribution.up}%`, backgroundColor: '#00C896', minWidth: 2 }} />
              )}
              {regime.distribution.choppy > 0 && (
                <div style={{ width: `${regime.distribution.choppy}%`, backgroundColor: '#F59E0B', minWidth: 2 }} />
              )}
              {regime.distribution.down > 0 && (
                <div style={{ width: `${regime.distribution.down}%`, backgroundColor: '#FF4D4D', minWidth: 2 }} />
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
              <span className="text-[10px] font-medium" style={{ color: '#00C896' }}>
                ↗ Trending Up <span className="opacity-60">({regime.distribution.up}%)</span>
              </span>
              <span className="text-[10px] font-medium" style={{ color: '#F59E0B' }}>
                ↔ Choppy <span className="opacity-60">({regime.distribution.choppy}%)</span>
              </span>
              <span className="text-[10px] font-medium" style={{ color: '#FF4D4D' }}>
                ↘ Trending Down <span className="opacity-60">({regime.distribution.down}%)</span>
              </span>
            </div>
          </div>
        )}

        {/* Rolling history timeline */}
        {regime.history && regime.history.length > 1 && (
          <div className="w-full">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-2 font-medium">
              Regime Timeline — oldest → newest ({regime.history.length} windows)
            </p>
            <div className="flex gap-px h-7 rounded overflow-hidden">
              {regime.history.map((h, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: stateColor(h.label), opacity: 0.75, minWidth: 2 }}
                  title={`Window ${h.index}: ${h.label === 'up' ? 'Trending Up' : h.label === 'down' ? 'Trending Down' : 'Choppy'}`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[8px] text-[#8A99B3] mt-1">
              <span>Start of period</span>
              <span>← each segment = {Math.round(20 / 4)}-bar window →</span>
              <span>Most recent</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Chart types & constants ───────────────────────────────────────────────────

type ChartPeriod =
  | '1min' | '3min' | '5min' | '15min' | '30min' | '1h'
  | '1day' | '1week' | '1month' | 'all'

type ChartType = 'candlestick' | 'bar' | 'heikin_ashi'

type OHLCV = {
  time: string | number
  open: number; high: number; low: number; close: number; volume: number
}

const CHART_TF: { value: ChartPeriod; label: string }[] = [
  { value: '1min',   label: '1 Minute'  },
  { value: '3min',   label: '3 Minutes' },
  { value: '5min',   label: '5 Minutes' },
  { value: '15min',  label: '15 Minutes'},
  { value: '30min',  label: '30 Minutes'},
  { value: '1h',     label: '1 Hour'    },
  { value: '1day',   label: '1 Day'     },
  { value: '1week',  label: '1 Week'    },
  { value: '1month', label: '1 Month'   },
  { value: 'all',    label: 'All Time'  },
]

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'candlestick', label: 'Candles'     },
  { value: 'bar',         label: 'OHLC Bar'    },
  { value: 'heikin_ashi', label: 'Heikin Ashi' },
]

function toHeikinAshi(candles: OHLCV[]): OHLCV[] {
  const out: OHLCV[] = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const haClose = (c.open + c.high + c.low + c.close) / 4
    const haOpen  = i === 0
      ? (c.open + c.close) / 2
      : (out[i - 1].open + out[i - 1].close) / 2
    out.push({ ...c, open: haOpen, high: Math.max(c.high, haOpen, haClose), low: Math.min(c.low, haOpen, haClose), close: haClose })
  }
  return out
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StockAnalysisClient() {
  const [searchInput,  setSearchInput]  = useState('')
  const [ticker,       setTicker]       = useState('')
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [period,       setPeriod]       = useState<AnalysisPeriod>('1y')
  const [aiResult,     setAiResult]     = useState<AIResult | null>(null)
  const [aiLoading,    setAiLoading]    = useState(false)
  const [detailedOpen, setDetailedOpen] = useState(false)
  const [mcHorizon,    setMcHorizon]    = useState(90)
  const [mcSims,       setMcSims]       = useState(1_000)
  const [mcData,       setMcData]       = useState<MonteCarloResult | null>(null)
  const [mcComputing,  setMcComputing]  = useState(false)

  // ── Chart state ──────────────────────────────────────────────────────────────
  const [chartPeriod,   setChartPeriod]   = useState<ChartPeriod>('1day')
  const [chartType,     setChartType]     = useState<ChartType>('candlestick')
  const [tfOpen,        setTfOpen]        = useState(false)
  const [chartLoading,  setChartLoading]  = useState(false)
  const [chartData,     setChartData]     = useState<OHLCV[]>([])

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef  = useRef<ReturnType<typeof createChart> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartSeriesRef    = useRef<any>(null)
  const chartTypeRef      = useRef<ChartType>('candlestick')

  const searchParams = useSearchParams()

  useEffect(() => {
    const sym = searchParams.get('ticker')?.toUpperCase()
    if (sym) { setSearchInput(sym); loadStock(sym) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recompute Monte Carlo client-side whenever horizon, sims, or params change
  useEffect(() => {
    const params = aiResult?.monteCarloParams
    if (!params) {
      setMcData(aiResult?.monteCarlo ?? null)
      return
    }
    setMcComputing(true)
    // Small timeout so React can paint the loading state first
    const timer = setTimeout(() => {
      setMcData(clientMC(params, mcHorizon, mcSims))
      setMcComputing(false)
    }, 10)
    return () => clearTimeout(timer)
  }, [aiResult, mcHorizon, mcSims])

  const loadStock = useCallback(async (sym: string) => {
    setLoading(true)
    setError(null); setFundamentals(null); setAiResult(null); setDetailedOpen(false)
    try {
      const res = await fetch(`/api/stock/fundamentals?symbol=${encodeURIComponent(sym)}`)
      if (!res.ok) throw new Error('Symbol not found')
      const data = await res.json() as Fundamentals
      setFundamentals(data)
      setTicker(sym)
    } catch {
      setError('Could not load data. Check the ticker symbol and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const sym = searchInput.trim().toUpperCase()
    if (!sym) return
    loadStock(sym)
  }, [searchInput, loadStock])

  // ── Chart helpers ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function rebuildSeries(chart: ReturnType<typeof createChart>, ct: ChartType, data: OHLCV[]): any {
    const prev = chartSeriesRef.current
    if (prev) { try { chart.removeSeries(prev) } catch { /* ok */ } }
    let series
    if (ct === 'bar') {
      series = chart.addSeries(BarSeries, { upColor: '#00C896', downColor: '#FF4D4D' })
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#00C896', downColor: '#FF4D4D',
        borderUpColor: '#00C896', borderDownColor: '#FF4D4D',
        wickUpColor: '#00C896', wickDownColor: '#FF4D4D',
      })
    }
    const display = ct === 'heikin_ashi' ? toHeikinAshi(data) : data
    series.setData(display.map(d => ({ ...d, time: d.time as Time })))
    chartSeriesRef.current = series
    chart.timeScale().fitContent()
    return series
  }

  const fetchChartData = useCallback(async (sym: string, p: ChartPeriod) => {
    setChartLoading(true)
    try {
      const res = await fetch(`/api/stock/chart?symbol=${encodeURIComponent(sym)}&period=${p}`)
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: OHLCV[] }
      setChartData(json.data ?? [])
    } catch { /* silent — chart just stays empty */ } finally {
      setChartLoading(false)
    }
  }, [])

  // Init lightweight-charts instance once
  useEffect(() => {
    if (!chartContainerRef.current) return
    const chart = createChart(chartContainerRef.current, {
      layout:          { background: { color: '#0A0F1E' }, textColor: '#8A99B3' },
      grid:            { vertLines: { color: '#1E2D4A' }, horzLines: { color: '#1E2D4A' } },
      crosshair:       { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: '#1E2D4A' },
      timeScale:       { borderColor: '#1E2D4A', timeVisible: true },
      width:           chartContainerRef.current.clientWidth,
      height:          320,
    })
    chartInstanceRef.current = chart
    chartSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#00C896', downColor: '#FF4D4D',
      borderUpColor: '#00C896', borderDownColor: '#FF4D4D',
      wickUpColor: '#00C896', wickDownColor: '#FF4D4D',
    })
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) chart.resize(chartContainerRef.current.clientWidth, 320)
    })
    ro.observe(chartContainerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartInstanceRef.current = null; chartSeriesRef.current = null }
  }, [])

  // Re-render chart when data or type changes
  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart || !chartData.length) return
    rebuildSeries(chart, chartType, chartData)
    chartTypeRef.current = chartType
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, chartType])

  // Fetch chart data when ticker or period changes
  useEffect(() => {
    if (ticker) fetchChartData(ticker, chartPeriod)
  }, [ticker, chartPeriod, fetchChartData])

  const handleChartPeriod = useCallback((p: ChartPeriod) => {
    setChartPeriod(p); setTfOpen(false)
    if (ticker) fetchChartData(ticker, p)
  }, [ticker, fetchChartData])

  const handleChartType = useCallback((ct: ChartType) => {
    setChartType(ct); chartTypeRef.current = ct
    const chart = chartInstanceRef.current
    if (chart && chartData.length) rebuildSeries(chart, ct, chartData)
  }, [chartData])

  const runAI = useCallback(async () => {
    if (!fundamentals || !ticker) return
    setAiLoading(true); setAiResult(null); setDetailedOpen(false)
    try {
      const res = await fetch('/api/ai/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker, period, fundamentals }),
      })
      const data = await res.json() as AIResult
      if (!res.ok) {
        setAiResult({ ...data, verdict: 'WAIT', confidence: 0, summary: data.error ?? 'Analysis failed.', fundamentalsScore: 0, technicalsScore: 0, regimeScore: 0, regime: { label: '', confidence: 0, daysInRegime: 0 }, metrics: [] })
        return
      }
      setAiResult(data)
    } catch {
      setAiResult(null)
    } finally {
      setAiLoading(false)
    }
  }, [fundamentals, ticker, period])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
          Stock Analysis
        </h1>
        <p className="text-[#8A99B3] text-sm mt-0.5">Fundamentals · AI verdict · Monte Carlo · Detailed breakdown</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A99B3]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Ticker symbol — e.g. AAPL, NVDA, TSLA"
            className="w-full bg-[#0F1729] border border-[#1E2D4A] focus:border-[#2F80ED] text-[#F0F4FF] text-sm pl-9 pr-4 py-2.5 rounded-[4px] outline-none transition-colors"
          />
        </div>
        <button type="submit" disabled={loading}
          className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-[4px] transition-colors">
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-[6px] px-4 py-3 text-[#FF4D4D] text-sm mb-6">{error}</div>
      )}

      {!ticker && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-56 bg-[#0F1729] border border-[#1E2D4A] rounded-[6px]">
          <TrendingUp size={36} className="text-[#1E2D4A] mb-3" />
          <p className="text-[#8A99B3] text-sm">Enter a ticker symbol to begin analysis</p>
          <p className="text-[#2F80ED]/40 text-xs mt-1">AAPL · NVDA · TSLA · MSFT · AMZN</p>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="h-24 bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-20 bg-[#0F1729] border border-[#1E2D4A] rounded-[4px] animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {fundamentals && !loading && (
        <>
          {/* Company header */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {fundamentals.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[#2F80ED] text-xs font-bold">{ticker}</span>
                  {fundamentals.sector && <><span className="text-[#1E2D4A]">·</span><span className="text-[#8A99B3] text-xs">{fundamentals.sector}</span></>}
                  {fundamentals.industry && <><span className="text-[#1E2D4A]">·</span><span className="text-[#8A99B3] text-xs">{fundamentals.industry}</span></>}
                  {fundamentals.country && <><span className="text-[#1E2D4A]">·</span><span className="text-[#8A99B3] text-xs">{fundamentals.country}</span></>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  ${fundamentals.price.toFixed(2)}
                </p>
                <p className={`text-sm font-medium ${fundamentals.change >= 0 ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                  {fundamentals.change >= 0 ? '+' : ''}{fundamentals.change.toFixed(2)}
                  {' '}({fundamentals.changePercent >= 0 ? '+' : ''}{fundamentals.changePercent.toFixed(2)}%)
                </p>
              </div>
            </div>

            {/* 52W range progress bar */}
            {fundamentals.week52Low != null && fundamentals.week52High != null && (
              <div className="mt-4 pt-4 border-t border-[#1E2D4A]">
                <div className="flex justify-between text-[9px] text-[#8A99B3] mb-1.5">
                  <span>52W Low: ${fundamentals.week52Low.toFixed(2)}</span>
                  <span>Current: ${fundamentals.price.toFixed(2)}</span>
                  <span>52W High: ${fundamentals.week52High.toFixed(2)}</span>
                </div>
                <div className="relative h-2 bg-[#1E2D4A] rounded-full overflow-hidden">
                  <div className="absolute inset-0 rounded-full"
                    style={{ background: 'linear-gradient(to right, #FF4D4D20, #F59E0B20, #00C89620)' }} />
                  <div className="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 rounded-full bg-[#F0F4FF]"
                    style={{ left: `${((fundamentals.price - fundamentals.week52Low) / (fundamentals.week52High - fundamentals.week52Low)) * 100}%` }} />
                </div>
                <p className="text-[9px] text-[#8A99B3] mt-1 text-center">
                  {(((fundamentals.price - fundamentals.week52Low) / (fundamentals.week52High - fundamentals.week52Low)) * 100).toFixed(0)}% of 52-week range
                </p>
              </div>
            )}

            {fundamentals.description && (
              <p className="text-[#8A99B3] text-xs leading-relaxed mt-3 pt-3 border-t border-[#1E2D4A]">
                {fundamentals.description}{fundamentals.description.length >= 400 && '…'}
              </p>
            )}
          </div>

          {/* ── Chart section ────────────────────────────────────────────── */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] overflow-hidden mb-5">
            {/* Chart controls */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E2D4A] flex-wrap">
              <span className="text-[10px] text-[#8A99B3] uppercase tracking-widest font-medium mr-auto">
                Price Chart
              </span>

              {/* Timeframe dropdown */}
              <div className="relative">
                <button
                  onClick={() => setTfOpen(v => !v)}
                  className="flex items-center gap-2 text-xs bg-[#0A0F1E] border border-[#1E2D4A] hover:border-[#2F80ED] text-[#F0F4FF] px-3 py-1.5 rounded-[4px] transition-colors min-w-[120px] justify-between"
                >
                  <span>{CHART_TF.find(t => t.value === chartPeriod)?.label ?? 'Timeframe'}</span>
                  <ChevronDown size={11} className={`text-[#8A99B3] transition-transform ${tfOpen ? 'rotate-180' : ''}`} />
                </button>
                {tfOpen && (
                  <div className="absolute top-full mt-1 right-0 z-20 w-36 bg-[#0F1729] border border-[#1E2D4A] rounded-[4px] overflow-hidden shadow-xl">
                    {CHART_TF.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleChartPeriod(opt.value)}
                        className="w-full text-left text-xs px-3 py-2 transition-colors hover:bg-[#1E2D4A]"
                        style={{ color: chartPeriod === opt.value ? '#4FA3FF' : '#8A99B3' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chart type segmented control */}
              <div className="flex items-center gap-0.5 bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] p-0.5">
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    onClick={() => handleChartType(ct.value)}
                    className="text-[11px] px-3 py-1 rounded-[3px] font-medium transition-all"
                    style={{
                      backgroundColor: chartType === ct.value ? '#2F80ED' : 'transparent',
                      color:           chartType === ct.value ? '#fff'    : '#8A99B3',
                    }}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart canvas */}
            <div className="relative" style={{ minHeight: 320 }}>
              {chartLoading && (
                <div className="absolute inset-0 z-10 skeleton rounded-none" />
              )}
              <div ref={chartContainerRef} className="w-full" />
            </div>
          </div>

          {/* Fundamental metrics grid */}
          <div className="mb-5">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-3 font-medium">Fundamental Metrics</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

              <MetricCard label="P/E Ratio (TTM)" tooltipKey="peRatio"
                value={fundamentals.peRatio != null ? fundamentals.peRatio.toFixed(1) + 'x' : 'N/A'}
                sub={fundamentals.forwardPE != null ? `Fwd: ${fundamentals.forwardPE.toFixed(1)}x` : undefined}
                color={fundamentals.peRatio != null ? (fundamentals.peRatio <= 0 ? '#FF4D4D' : fundamentals.peRatio < 15 ? '#00C896' : fundamentals.peRatio > 35 ? '#FF4D4D' : '#F0F4FF') : '#8A99B3'}
              />

              <MetricCard label="EPS (TTM)" tooltipKey="eps"
                value={fundamentals.eps != null ? `$${fundamentals.eps.toFixed(2)}` : 'N/A'}
                color={fundamentals.eps != null ? (fundamentals.eps > 0 ? '#00C896' : '#FF4D4D') : '#8A99B3'}
              />

              <MetricCard label="Market Cap" tooltipKey="marketCap"
                value={fmtLargeNum(fundamentals.marketCap)}
                sub={fundamentals.enterpriseValue ? `EV: ${fmtLargeNum(fundamentals.enterpriseValue)}` : undefined}
              />

              <MetricCard label="Revenue (TTM)" tooltipKey="revenue"
                value={fmtLargeNum(fundamentals.revenue)}
                sub={fundamentals.profitMargin != null ? `Margin: ${(fundamentals.profitMargin * 100).toFixed(1)}%` : undefined}
              />

              <MetricCard label="Profit Margin" tooltipKey="profitMargin"
                value={fundamentals.profitMargin != null ? `${(fundamentals.profitMargin * 100).toFixed(1)}%` : 'N/A'}
                color={fundamentals.profitMargin != null ? (fundamentals.profitMargin > 0.2 ? '#00C896' : fundamentals.profitMargin > 0 ? '#F59E0B' : '#FF4D4D') : '#8A99B3'}
              />

              <MetricCard label="ROE" tooltipKey="roe"
                value={fundamentals.roe != null ? `${(fundamentals.roe * 100).toFixed(1)}%` : 'N/A'}
                color={fundamentals.roe != null ? (fundamentals.roe > 0.15 ? '#00C896' : fundamentals.roe > 0 ? '#F59E0B' : '#FF4D4D') : '#8A99B3'}
              />

              <MetricCard label="Debt / Equity" tooltipKey="debtToEquity"
                value={fundamentals.debtToEquity != null ? fundamentals.debtToEquity.toFixed(2) + 'x' : 'N/A'}
                color={fundamentals.debtToEquity != null ? (fundamentals.debtToEquity < 0.5 ? '#00C896' : fundamentals.debtToEquity > 2 ? '#FF4D4D' : '#F0F4FF') : '#8A99B3'}
              />

              <MetricCard label="Beta" tooltipKey="beta"
                value={fundamentals.beta != null ? fundamentals.beta.toFixed(2) : 'N/A'}
                sub={fundamentals.beta != null ? (fundamentals.beta > 1.5 ? 'High Volatility' : fundamentals.beta < 0.5 ? 'Low Volatility' : 'Moderate') : undefined}
              />

              <MetricCard label="Dividend Yield" tooltipKey="dividendYield"
                value={fundamentals.dividendYield ? `${(fundamentals.dividendYield * 100).toFixed(2)}%` : 'None'}
                color={fundamentals.dividendYield ? '#00C896' : '#8A99B3'}
              />

              <MetricCard label="Shares Outstanding" tooltipKey="sharesOutstanding"
                value={fmtShares(fundamentals.sharesOutstanding)}
              />

              <MetricCard label="Next Earnings" tooltipKey="nextEarnings"
                value={fundamentals.nextEarningsDate ?? 'N/A'}
                color={fundamentals.nextEarningsDate ? '#F59E0B' : '#8A99B3'}
              />

              {fundamentals.analystPriceTarget && (
                <MetricCard label="Analyst Price Target" tooltipKey="priceTarget"
                  value={`$${fundamentals.analystPriceTarget.toFixed(2)}`}
                  sub={`${((fundamentals.analystPriceTarget / fundamentals.price - 1) * 100).toFixed(1)}% from current`}
                  color={fundamentals.analystPriceTarget > fundamentals.price ? '#00C896' : '#FF4D4D'}
                />
              )}

              {fundamentals.analystRating && (
                <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] p-4 col-span-2 sm:col-span-2 lg:col-span-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[10px] text-[#8A99B3] uppercase tracking-widest font-medium">Analyst Rating</p>
                    <Tooltip text={TOOLTIPS.analystRating} />
                  </div>
                  <p className="text-base font-bold mb-2" style={{
                    fontFamily: 'var(--font-syne)',
                    color: fundamentals.analystRating.consensus === 'Buy' ? '#00C896'
                      : fundamentals.analystRating.consensus === 'Sell' ? '#FF4D4D' : '#F59E0B',
                  }}>
                    {fundamentals.analystRating.consensus}
                  </p>
                  <AnalystBar {...fundamentals.analystRating} />
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis section */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot size={15} className="text-[#2F80ED]" />
              <h3 className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                AI Analysis
              </h3>
              <span className="text-[10px] text-[#8A99B3] ml-auto">Powered by Gemini · Monte Carlo · Regime Detection</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">Historical Period</label>
                <select value={period} onChange={(e) => setPeriod(e.target.value as AnalysisPeriod)}
                  className="bg-[#0A0F1E] border border-[#1E2D4A] text-[#F0F4FF] text-sm px-3 py-2 rounded-[4px] outline-none focus:border-[#2F80ED] transition-colors cursor-pointer appearance-none pr-8"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A99B3' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                  {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <label className="text-[9px] text-transparent uppercase tracking-widest font-medium mb-1">run</label>
                <button onClick={runAI} disabled={aiLoading}
                  className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2 rounded-[4px] transition-colors flex items-center gap-2">
                  {aiLoading ? (
                    <><span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />Analyzing…</>
                  ) : 'Run AI Analysis'}
                </button>
              </div>
            </div>

            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 border-2 border-[#2F80ED]/30 border-t-[#2F80ED] rounded-full animate-spin" />
                <p className="text-[#8A99B3] text-sm">
                  Fetching {period} chart data · computing RSI, MACD, Bollinger Bands · running 1,000 Monte Carlo simulations · detecting market regime…
                </p>
              </div>
            )}

            {aiResult?.error === 'daily_limit_reached' && (
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-[6px] p-4">
                <p className="text-[#F59E0B] text-sm font-semibold mb-1">Daily limit reached</p>
                <p className="text-[#8A99B3] text-xs">
                  Free plan: {aiResult.queriesLimit} AI queries per day. Resets at midnight.{' '}
                  <a href="/pricing" className="text-[#2F80ED] hover:underline">Upgrade to Pro</a> for unlimited analysis.
                </p>
              </div>
            )}

            {!aiResult && !aiLoading && (
              <p className="text-[#8A99B3] text-sm">
                Select a historical period and click <span className="text-[#F0F4FF]">&quot;Run AI Analysis&quot;</span> to get a comprehensive BUY / WAIT / AVOID verdict with full metric breakdown and Monte Carlo simulation.
              </p>
            )}

            {aiResult && aiResult.verdict && !aiResult.error && (
              <div className="mt-2">
                {(() => {
                  const cfg = VERDICT_CONFIG[aiResult.verdict]
                  return (
                    <div className="rounded-[6px] p-5 mb-4"
                      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>

                      {/* Verdict header row */}
                      <div className="flex flex-wrap items-center gap-6 mb-4">
                        {/* Confidence arc */}
                        <ConfidenceArc value={aiResult.confidence} color={cfg.color} />

                        {/* Verdict label */}
                        <div>
                          <p className="text-xs text-[#8A99B3] uppercase tracking-widest mb-0.5">AI Verdict</p>
                          <p className="text-4xl font-bold" style={{ color: cfg.color, fontFamily: 'var(--font-syne)' }}>
                            {cfg.label}
                          </p>
                          <p className="text-xs text-[#8A99B3] mt-1">{ticker} · {PERIODS.find(p => p.value === period)?.label} analysis</p>
                        </div>

                        {/* Regime pill */}
                        {aiResult.regime?.label && (
                          <div className="ml-auto text-right">
                            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-1">Market Regime</p>
                            <span className="text-sm font-semibold px-3 py-1 rounded-full"
                              style={{
                                backgroundColor: aiResult.regime.label === 'Trending Up' ? '#00C89620' : aiResult.regime.label === 'Trending Down' ? '#FF4D4D20' : '#F59E0B20',
                                color: aiResult.regime.label === 'Trending Up' ? '#00C896' : aiResult.regime.label === 'Trending Down' ? '#FF4D4D' : '#F59E0B',
                                border: `1px solid ${aiResult.regime.label === 'Trending Up' ? '#00C89640' : aiResult.regime.label === 'Trending Down' ? '#FF4D4D40' : '#F59E0B40'}`,
                              }}>
                              {aiResult.regime.label}
                            </span>
                            <p className="text-[10px] text-[#8A99B3] mt-1">
                              {aiResult.regime.confidence}% confidence · ~{aiResult.regime.daysInRegime} periods
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      <p className="text-[#F0F4FF] text-sm leading-relaxed border-t border-white/10 pt-4 mb-4">
                        {aiResult.summary}
                      </p>

                      {/* Score bars */}
                      <div className="grid grid-cols-3 gap-5 mb-4">
                        <ScoreBar label="Fundamentals" score={aiResult.fundamentalsScore} />
                        <ScoreBar label="Technicals"   score={aiResult.technicalsScore} />
                        <ScoreBar label="Regime"       score={aiResult.regimeScore} />
                      </div>

                      {/* Detailed overview toggle */}
                      <button onClick={() => setDetailedOpen(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                        style={{ color: cfg.color }}>
                        {detailedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {detailedOpen ? 'Hide Detailed Overview' : 'Show Detailed Overview'}
                      </button>
                    </div>
                  )
                })()}

                {/* Detailed overview */}
                {detailedOpen && aiResult.metrics.length > 0 && (
                  <div className="space-y-6">

                    {/* Fundamental metrics table */}
                    {(() => {
                      const fundMetrics = aiResult.metrics.filter(m => m.category === 'fundamental')
                      if (!fundMetrics.length) return null
                      return (
                        <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-5">
                          <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-4 font-medium">Fundamental Metrics</p>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-[#1E2D4A]">
                                  <th className="text-left pb-2 pr-4 text-[10px] text-[#8A99B3] uppercase tracking-wider font-medium">Metric</th>
                                  <th className="text-left pb-2 pr-4 text-[10px] text-[#8A99B3] uppercase tracking-wider font-medium">Value</th>
                                  <th className="text-left pb-2 pr-4 text-[10px] text-[#8A99B3] uppercase tracking-wider font-medium">Signal</th>
                                  <th className="text-left pb-2 text-[10px] text-[#8A99B3] uppercase tracking-wider font-medium">What It Means</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fundMetrics.map(m => (
                                  <tr key={m.key} className="border-b border-[#1E2D4A]/50 hover:bg-[#0F1729]/50 transition-colors">
                                    <td className="py-3 pr-4 text-xs text-[#8A99B3] font-medium whitespace-nowrap">{m.label}</td>
                                    <td className="py-3 pr-4 text-sm font-bold text-[#F0F4FF] whitespace-nowrap">{m.value}</td>
                                    <td className="py-3 pr-4 whitespace-nowrap"><SignalBadge signal={m.signal} /></td>
                                    <td className="py-3 text-xs text-[#8A99B3] leading-relaxed">{m.explanation}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Technical indicators grid */}
                    {(() => {
                      const techMetrics = aiResult.metrics.filter(m => m.category === 'technical')
                      if (!techMetrics.length) return null
                      return (
                        <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-5">
                          <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-4 font-medium">Technical Indicators</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {techMetrics.map(m => <TechCard key={m.key} metric={m} />)}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Regime visualization */}
                    {(() => {
                      const regimeMetric = aiResult.metrics.find(m => m.category === 'regime')
                      if (!aiResult.regime?.label) return null
                      return <RegimeCard regime={aiResult.regime} metric={regimeMetric} />
                    })()}

                    {/* Monte Carlo */}
                    {aiResult.monteCarloParams && (
                      <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                          <div>
                            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium mb-0.5">Monte Carlo Simulation</p>
                            <p className="text-xs text-[#8A99B3]">Geometric Brownian Motion · based on historical return distribution</p>
                          </div>
                          {/* Controls */}
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="block text-[9px] text-[#8A99B3] uppercase tracking-widest mb-1">Horizon</label>
                              <select
                                value={mcHorizon}
                                onChange={(e) => setMcHorizon(Number(e.target.value))}
                                className="bg-[#0F1729] border border-[#1E2D4A] text-[#F0F4FF] text-xs px-2.5 py-1.5 rounded-[4px] outline-none focus:border-[#2F80ED] cursor-pointer"
                              >
                                {MC_HORIZONS.map(h => (
                                  <option key={h.days} value={h.days}>{h.label} ({h.days}d)</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] text-[#8A99B3] uppercase tracking-widest mb-1">Simulations</label>
                              <select
                                value={mcSims}
                                onChange={(e) => setMcSims(Number(e.target.value))}
                                className="bg-[#0F1729] border border-[#1E2D4A] text-[#F0F4FF] text-xs px-2.5 py-1.5 rounded-[4px] outline-none focus:border-[#2F80ED] cursor-pointer"
                              >
                                {MC_SIMS_OPTIONS.map(n => (
                                  <option key={n} value={n}>{n.toLocaleString()} paths</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {mcComputing ? (
                          <div className="flex items-center justify-center py-16 gap-3 text-[#8A99B3] text-sm">
                            <span className="w-5 h-5 border-2 border-[#2F80ED]/30 border-t-[#2F80ED] rounded-full animate-spin" />
                            Running {mcSims.toLocaleString()} simulations…
                          </div>
                        ) : mcData ? (
                          <>
                            <MonteCarloChart mc={mcData} currentPrice={fundamentals.price} />
                            {/* Summary stats */}
                            {(() => {
                              const last = mcData.percentiles[mcData.percentiles.length - 1]
                              const cp = fundamentals.price
                              const fmtChg = (p: number) => {
                                const pct = (p / cp - 1) * 100
                                return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
                              }
                              return (
                                <div className="mt-4 pt-4 border-t border-[#1E2D4A]">
                                  <p className="text-xs text-[#8A99B3] mb-3">
                                    After <span className="text-[#F0F4FF] font-semibold">{mcData.horizon} trading days</span>, based on <span className="text-[#F0F4FF] font-semibold">{mcSims.toLocaleString()} simulations</span>:
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                      { label: 'Pessimistic (P10)',  val: last.p10, color: '#FF4D4D' },
                                      { label: 'Below median (P25)', val: last.p25, color: '#FF6B6B' },
                                      { label: 'Median (P50)',       val: last.p50, color: '#F0F4FF' },
                                      { label: 'Above median (P75)', val: last.p75, color: '#4FA3FF' },
                                      { label: 'Optimistic (P90)',   val: last.p90, color: '#00C896' },
                                    ].map(s => (
                                      <div key={s.label} className="bg-[#0F1729] border border-[#1E2D4A] rounded-[4px] p-3 text-center">
                                        <p className="text-[9px] text-[#8A99B3] mb-1">{s.label}</p>
                                        <p className="text-sm font-bold" style={{ color: s.color, fontFamily: 'var(--font-syne)' }}>
                                          ${s.val.toFixed(2)}
                                        </p>
                                        <p className="text-[10px] mt-0.5" style={{ color: s.color }}>{fmtChg(s.val)}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[11px] text-[#8A99B3] mt-3">
                                    <span className="text-[#F0F4FF]">50% probability</span> price lands between{' '}
                                    <span style={{ color: '#4FA3FF' }}>${last.p25.toFixed(2)}</span> and{' '}
                                    <span style={{ color: '#4FA3FF' }}>${last.p75.toFixed(2)}</span> in {mcData.horizon} trading days.
                                    This is an educational simulation based on historical price behavior — not a prediction.
                                  </p>
                                </div>
                              )
                            })()}
                          </>
                        ) : (
                          <p className="text-[#8A99B3] text-sm py-6 text-center">Not enough historical data to run simulation.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {aiResult.queriesLimit != null && (
                  <p className="text-[#8A99B3] text-xs mt-3">
                    {aiResult.queriesLimit - (aiResult.queriesUsed ?? 0)} free queries remaining today ·{' '}
                    <a href="/pricing" className="text-[#2F80ED] hover:underline">Upgrade to Pro</a> for unlimited
                  </p>
                )}
              </div>
            )}
          </div>

          <NewsSection ticker={ticker} companyName={fundamentals.name} />
        </>
      )}
    </div>
  )
}

// ── News section ───────────────────────────────────────────────────────────────

function NewsSection({ ticker, companyName }: { ticker: string; companyName: string }) {
  const [news, setNews] = useState<{ datetime: number; headline: string; source: string; url: string }[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true); setNews(null)
    fetch(`/api/stock/news?symbol=${encodeURIComponent(ticker)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setNews(Array.isArray(d) ? d : []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false))
  }, [ticker])

  function timeAgo(unix: number): string {
    const diff = Date.now() / 1000 - unix
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5">
      <h3 className="text-sm font-semibold text-[#F0F4FF] mb-4" style={{ fontFamily: 'var(--font-syne)' }}>
        Latest News <span className="text-[#8A99B3] font-normal ml-2">— {companyName}</span>
      </h3>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#1E2D4A]/30 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (!news || news.length === 0) && (
        <p className="text-[#8A99B3] text-sm">No recent news found for {ticker}.</p>
      )}

      {!loading && news && news.length > 0 && (
        <div className="divide-y divide-[#1E2D4A]">
          {news.map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-3 py-3 group hover:bg-[#1E2D4A]/20 -mx-2 px-2 rounded transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[#F0F4FF] text-sm leading-snug group-hover:text-[#4FA3FF] transition-colors line-clamp-2">
                  {item.headline}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[#2F80ED] font-medium">{item.source}</span>
                  <span className="text-[#1E2D4A]">·</span>
                  <span className="text-[10px] text-[#8A99B3]">{timeAgo(item.datetime)}</span>
                </div>
              </div>
              <ExternalLink size={12} className="text-[#8A99B3] group-hover:text-[#4FA3FF] transition-colors shrink-0 mt-1" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
