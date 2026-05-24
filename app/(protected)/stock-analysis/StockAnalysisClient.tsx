'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search, Info, Bot, ExternalLink, TrendingUp, ChevronDown, ChevronUp,
} from 'lucide-react'

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

type MetricResult = {
  key: string
  label: string
  category: 'fundamental' | 'technical' | 'regime'
  value: string
  signal: Signal
  explanation: string
}

type AIResult = {
  verdict: 'BUY' | 'WAIT' | 'AVOID'
  confidence: number
  summary: string
  fundamentalsScore: number
  technicalsScore: number
  regimeScore: number
  regime: { label: string; confidence: number; daysInRegime: number }
  metrics: MetricResult[]
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
  BUY:   { color: '#00C896', bg: 'rgba(0,200,150,0.08)',  border: 'rgba(0,200,150,0.25)',  dot: '🟢', label: 'BUY'  },
  WAIT:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', dot: '🟡', label: 'WAIT' },
  AVOID: { color: '#FF4D4D', bg: 'rgba(255,77,77,0.08)',  border: 'rgba(255,77,77,0.25)',  dot: '🔴', label: 'AVOID'},
}

const SIGNAL_CONFIG: Record<Signal, { color: string; label: string }> = {
  bullish: { color: '#00C896', label: 'Bullish' },
  neutral: { color: '#8A99B3', label: 'Neutral' },
  bearish: { color: '#FF4D4D', label: 'Bearish' },
}

// ── Tooltip content ────────────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  peRatio:       "Price-to-Earnings: how much investors pay per $1 of earnings. Context matters — growth stocks trade at higher multiples.",
  forwardPE:     "Uses next year's estimated earnings. Lower forward P/E than trailing suggests analysts expect earnings growth.",
  eps:           "Earnings Per Share (TTM): net profit divided by shares outstanding over the last 12 months.",
  beta:          "Volatility vs the S&P 500. Beta > 1 = more volatile than the market. Beta < 0 = moves inversely.",
  dividendYield: "Annual dividend as a percentage of stock price. Only relevant if the company pays dividends.",
  marketCap:     "Total market value of all shares. Large-cap >$10B, Mid-cap $2B–$10B, Small-cap <$2B.",
  enterpriseValue: "Market cap plus net debt — the theoretical cost to acquire the entire company.",
  week52:        "Price range over the last 52 weeks — helps gauge momentum and relative valuation.",
  revenue:       "Total revenue (TTM): total income from business operations over the last 12 months.",
  profitMargin:  "Net profit as a percentage of revenue. Higher = more efficient at converting sales to earnings.",
  roe:           "Return on Equity: profit generated per dollar of shareholder equity. Above 15% is strong.",
  debtToEquity:  "Total debt relative to shareholder equity. High D/E amplifies both returns and risk.",
  sharesOutstanding: "Total shares in existence. Dilution (new shares issued) reduces existing holders' percentage.",
  nextEarnings:  "The next scheduled earnings release date — often a catalyst for price movement.",
  analystRating: "Consensus analyst recommendation from Wall Street. Treat as context, not a signal — analysts lag the market.",
  priceTarget:   "Average analyst 12-month price target. Compare to current price to estimate implied upside/downside.",
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

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function MetricCard({
  label, value, sub, color, tooltipKey,
}: { label: string; value: string; sub?: string; color?: string; tooltipKey?: string }) {
  return (
    <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[10px] text-[#8A99B3] uppercase tracking-widest font-medium">{label}</p>
        {tooltipKey && TOOLTIPS[tooltipKey] && <Tooltip text={TOOLTIPS[tooltipKey]} />}
      </div>
      <p className="text-base font-bold truncate" style={{ color: color ?? '#F0F4FF', fontFamily: 'var(--font-syne)' }}>
        {value}
      </p>
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
        <span className="text-xs font-bold" style={{ color }}>{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-[#1E2D4A] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function SignalBadge({ signal }: { signal: Signal }) {
  const { color, label } = SIGNAL_CONFIG[signal]
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-[3px] flex items-center gap-1 shrink-0"
      style={{ backgroundColor: `${color}1A`, color, border: `1px solid ${color}33` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function AnalystBar(r: { buy: number; hold: number; sell: number; strongBuy: number; strongSell: number; total: number; period: string }) {
  const total = r.total || 1
  const segments = [
    { label: 'Strong Buy', count: r.strongBuy, color: '#00C896' },
    { label: 'Buy',        count: r.buy,       color: '#4FA3FF' },
    { label: 'Hold',       count: r.hold,      color: '#F59E0B' },
    { label: 'Sell',       count: r.sell,      color: '#FF6B6B' },
    { label: 'Strong Sell',count: r.strongSell,color: '#FF4D4D' },
  ]
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-2">
        {segments.map((s) => s.count > 0 && (
          <div key={s.label} className="transition-all"
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color, minWidth: 2 }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((s) => (
          <span key={s.label} className="text-[10px]" style={{ color: s.color }}>
            {s.label}: {s.count}
          </span>
        ))}
      </div>
      <p className="text-[#8A99B3] text-[10px] mt-1">Based on {total} ratings · {r.period}</p>
    </div>
  )
}

function MetricTableRow({ metric }: { metric: MetricResult }) {
  return (
    <tr className="border-b border-[#1E2D4A]/50 hover:bg-[#0F1729]/50 transition-colors">
      <td className="py-3 pr-4 text-xs text-[#8A99B3] font-medium whitespace-nowrap">{metric.label}</td>
      <td className="py-3 pr-4 text-sm font-bold text-[#F0F4FF] whitespace-nowrap">{metric.value}</td>
      <td className="py-3 pr-4 whitespace-nowrap">
        <SignalBadge signal={metric.signal} />
      </td>
      <td className="py-3 text-xs text-[#8A99B3] leading-relaxed">{metric.explanation}</td>
    </tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StockAnalysisClient() {
  const [searchInput,    setSearchInput]    = useState('')
  const [ticker,         setTicker]         = useState('')
  const [fundamentals,   setFundamentals]   = useState<Fundamentals | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [period,         setPeriod]         = useState<AnalysisPeriod>('1y')
  const [aiResult,       setAiResult]       = useState<AIResult | null>(null)
  const [aiLoading,      setAiLoading]      = useState(false)
  const [detailedOpen,   setDetailedOpen]   = useState(false)

  const searchParams = useSearchParams()

  // Auto-load ticker from URL param (e.g. from watchlist / top-movers links)
  useEffect(() => {
    const sym = searchParams.get('ticker')?.toUpperCase()
    if (sym) { setSearchInput(sym); loadStock(sym) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        if (data.error === 'daily_limit_reached') {
          setAiResult({ ...data, verdict: 'WAIT', confidence: 0, summary: '', fundamentalsScore: 0, technicalsScore: 0, regimeScore: 0, regime: { label: '', confidence: 0, daysInRegime: 0 }, metrics: [] })
        } else {
          setAiResult({ ...data, verdict: 'WAIT', confidence: 0, summary: data.error ?? 'Analysis failed.', fundamentalsScore: 0, technicalsScore: 0, regimeScore: 0, regime: { label: '', confidence: 0, daysInRegime: 0 }, metrics: [] })
        }
        return
      }
      setAiResult(data)
    } catch {
      setAiResult(null)
    } finally {
      setAiLoading(false)
    }
  }, [fundamentals, ticker, period])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
          Stock Analysis
        </h1>
        <p className="text-[#8A99B3] text-sm mt-0.5">Fundamentals, AI verdict & detailed breakdown</p>
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
        <button
          type="submit"
          disabled={loading}
          className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-[4px] transition-colors"
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-[6px] px-4 py-3 text-[#FF4D4D] text-sm mb-6">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!ticker && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-56 bg-[#0F1729] border border-[#1E2D4A] rounded-[6px]">
          <TrendingUp size={36} className="text-[#1E2D4A] mb-3" />
          <p className="text-[#8A99B3] text-sm">Enter a ticker symbol to begin analysis</p>
          <p className="text-[#2F80ED]/40 text-xs mt-1">AAPL · NVDA · TSLA · MSFT · AMZN</p>
        </div>
      )}

      {/* Loading skeleton */}
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

      {/* Main content */}
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
                  {fundamentals.sector && (
                    <><span className="text-[#1E2D4A]">·</span><span className="text-[#8A99B3] text-xs">{fundamentals.sector}</span></>
                  )}
                  {fundamentals.industry && (
                    <><span className="text-[#1E2D4A]">·</span><span className="text-[#8A99B3] text-xs">{fundamentals.industry}</span></>
                  )}
                  {fundamentals.country && (
                    <><span className="text-[#1E2D4A]">·</span><span className="text-[#8A99B3] text-xs">{fundamentals.country}</span></>
                  )}
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
            {fundamentals.description && (
              <p className="text-[#8A99B3] text-xs leading-relaxed mt-3 pt-3 border-t border-[#1E2D4A]">
                {fundamentals.description}{fundamentals.description.length >= 400 && '…'}
              </p>
            )}
          </div>

          {/* Fundamental metrics grid */}
          <div className="mb-5">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-3 font-medium">Fundamental Metrics</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

              <MetricCard
                label="P/E Ratio (TTM)" tooltipKey="peRatio"
                value={fundamentals.peRatio != null ? fundamentals.peRatio.toFixed(1) + 'x' : 'N/A'}
                sub={fundamentals.forwardPE != null ? `Fwd: ${fundamentals.forwardPE.toFixed(1)}x` : undefined}
                color={fundamentals.peRatio != null ? (fundamentals.peRatio <= 0 ? '#FF4D4D' : fundamentals.peRatio < 15 ? '#00C896' : fundamentals.peRatio > 35 ? '#FF4D4D' : '#F0F4FF') : '#8A99B3'}
              />

              <MetricCard
                label="EPS (TTM)" tooltipKey="eps"
                value={fundamentals.eps != null ? `$${fundamentals.eps.toFixed(2)}` : 'N/A'}
                color={fundamentals.eps != null ? (fundamentals.eps > 0 ? '#00C896' : '#FF4D4D') : '#8A99B3'}
              />

              <MetricCard
                label="Market Cap" tooltipKey="marketCap"
                value={fmtLargeNum(fundamentals.marketCap)}
                sub={fundamentals.enterpriseValue ? `EV: ${fmtLargeNum(fundamentals.enterpriseValue)}` : undefined}
              />

              <MetricCard
                label="Revenue (TTM)" tooltipKey="revenue"
                value={fmtLargeNum(fundamentals.revenue)}
                sub={fundamentals.profitMargin != null ? `Margin: ${(fundamentals.profitMargin * 100).toFixed(1)}%` : undefined}
              />

              <MetricCard
                label="Profit Margin" tooltipKey="profitMargin"
                value={fundamentals.profitMargin != null ? `${(fundamentals.profitMargin * 100).toFixed(1)}%` : 'N/A'}
                color={fundamentals.profitMargin != null ? (fundamentals.profitMargin > 0.2 ? '#00C896' : fundamentals.profitMargin > 0 ? '#F59E0B' : '#FF4D4D') : '#8A99B3'}
              />

              <MetricCard
                label="ROE" tooltipKey="roe"
                value={fundamentals.roe != null ? `${(fundamentals.roe * 100).toFixed(1)}%` : 'N/A'}
                color={fundamentals.roe != null ? (fundamentals.roe > 0.15 ? '#00C896' : fundamentals.roe > 0 ? '#F59E0B' : '#FF4D4D') : '#8A99B3'}
              />

              <MetricCard
                label="Debt / Equity" tooltipKey="debtToEquity"
                value={fundamentals.debtToEquity != null ? fundamentals.debtToEquity.toFixed(2) + 'x' : 'N/A'}
                color={fundamentals.debtToEquity != null ? (fundamentals.debtToEquity < 0.5 ? '#00C896' : fundamentals.debtToEquity > 2 ? '#FF4D4D' : '#F0F4FF') : '#8A99B3'}
              />

              <MetricCard
                label="Beta" tooltipKey="beta"
                value={fundamentals.beta != null ? fundamentals.beta.toFixed(2) : 'N/A'}
                sub={fundamentals.beta != null ? (fundamentals.beta > 1.5 ? 'High Volatility' : fundamentals.beta < 0.5 ? 'Low Volatility' : 'Moderate') : undefined}
              />

              <MetricCard
                label="Dividend Yield" tooltipKey="dividendYield"
                value={fundamentals.dividendYield ? `${(fundamentals.dividendYield * 100).toFixed(2)}%` : 'None'}
                color={fundamentals.dividendYield ? '#00C896' : '#8A99B3'}
              />

              <MetricCard
                label="52-Week Range" tooltipKey="week52"
                value={
                  fundamentals.week52Low != null && fundamentals.week52High != null
                    ? `$${fundamentals.week52Low.toFixed(0)} – $${fundamentals.week52High.toFixed(0)}`
                    : 'N/A'
                }
                sub={
                  fundamentals.week52Low && fundamentals.week52High
                    ? `${(((fundamentals.price - fundamentals.week52Low) / (fundamentals.week52High - fundamentals.week52Low)) * 100).toFixed(0)}% of range`
                    : undefined
                }
              />

              <MetricCard
                label="Shares Outstanding" tooltipKey="sharesOutstanding"
                value={fmtShares(fundamentals.sharesOutstanding)}
              />

              <MetricCard
                label="Next Earnings" tooltipKey="nextEarnings"
                value={fundamentals.nextEarningsDate ?? 'N/A'}
                color={fundamentals.nextEarningsDate ? '#F59E0B' : '#8A99B3'}
              />

              {/* Analyst price target */}
              {fundamentals.analystPriceTarget && (
                <MetricCard
                  label="Analyst Price Target" tooltipKey="priceTarget"
                  value={`$${fundamentals.analystPriceTarget.toFixed(2)}`}
                  sub={`${((fundamentals.analystPriceTarget / fundamentals.price - 1) * 100).toFixed(1)}% from current`}
                  color={fundamentals.analystPriceTarget > fundamentals.price ? '#00C896' : '#FF4D4D'}
                />
              )}

              {/* Analyst rating — full-width segment */}
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
            </div>

            {/* Period selector + Run button */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">
                  Historical Period
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as AnalysisPeriod)}
                  className="bg-[#0A0F1E] border border-[#1E2D4A] text-[#F0F4FF] text-sm px-3 py-2 rounded-[4px] outline-none focus:border-[#2F80ED] transition-colors cursor-pointer appearance-none pr-8"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A99B3' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <label className="text-[9px] text-transparent uppercase tracking-widest font-medium mb-1">run</label>
                <button
                  onClick={runAI}
                  disabled={aiLoading}
                  className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2 rounded-[4px] transition-colors flex items-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                      Analyzing…
                    </>
                  ) : 'Run AI Analysis'}
                </button>
              </div>
            </div>

            {/* Loading state */}
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 border-2 border-[#2F80ED]/30 border-t-[#2F80ED] rounded-full animate-spin" />
                <p className="text-[#8A99B3] text-sm">
                  Analyzing {fundamentals.name} — fetching {period} chart data, computing indicators, detecting market regime…
                </p>
              </div>
            )}

            {/* Daily limit error */}
            {aiResult?.error === 'daily_limit_reached' && (
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-[6px] p-4">
                <p className="text-[#F59E0B] text-sm font-semibold mb-1">Daily limit reached</p>
                <p className="text-[#8A99B3] text-xs">
                  Free plan: {aiResult.queriesLimit} AI queries per day. Resets at midnight.{' '}
                  <a href="/pricing" className="text-[#2F80ED] hover:underline">Upgrade to Pro</a> for unlimited analysis.
                </p>
              </div>
            )}

            {/* Prompt (no result yet) */}
            {!aiResult && !aiLoading && (
              <p className="text-[#8A99B3] text-sm">
                Select a historical period and click <span className="text-[#F0F4FF]">&quot;Run AI Analysis&quot;</span> to get a comprehensive BUY / WAIT / AVOID verdict with full metric breakdown.
              </p>
            )}

            {/* Verdict card */}
            {aiResult && aiResult.verdict && !aiResult.error && (
              <div className="mt-2">
                {(() => {
                  const cfg = VERDICT_CONFIG[aiResult.verdict]
                  return (
                    <div
                      className="rounded-[6px] p-5 mb-4"
                      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
                    >
                      {/* Verdict header */}
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{cfg.dot}</span>
                          <div>
                            <p className="text-xs text-[#8A99B3] uppercase tracking-widest">AI Verdict</p>
                            <p className="text-2xl font-bold" style={{ color: cfg.color, fontFamily: 'var(--font-syne)' }}>
                              {ticker} — {cfg.label}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#8A99B3] uppercase tracking-widest">Confidence</p>
                          <p className="text-2xl font-bold" style={{ color: cfg.color, fontFamily: 'var(--font-syne)' }}>
                            {aiResult.confidence}%
                          </p>
                        </div>
                      </div>

                      {/* Regime pill */}
                      {aiResult.regime?.label && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] text-[#8A99B3] uppercase tracking-widest">Regime</span>
                          <span
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: aiResult.regime.label === 'Trending Up' ? '#00C89620' : aiResult.regime.label === 'Trending Down' ? '#FF4D4D20' : '#F59E0B20',
                              color: aiResult.regime.label === 'Trending Up' ? '#00C896' : aiResult.regime.label === 'Trending Down' ? '#FF4D4D' : '#F59E0B',
                            }}
                          >
                            {aiResult.regime.label}
                          </span>
                          <span className="text-[10px] text-[#8A99B3]">
                            {aiResult.regime.confidence}% confidence · ~{aiResult.regime.daysInRegime} periods
                          </span>
                        </div>
                      )}

                      {/* Summary */}
                      <p className="text-[#F0F4FF] text-sm leading-relaxed border-t border-white/10 pt-3 mb-4">
                        &ldquo;{aiResult.summary}&rdquo;
                      </p>

                      {/* Score bars */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <ScoreBar label="Fundamentals" score={aiResult.fundamentalsScore} />
                        <ScoreBar label="Technicals" score={aiResult.technicalsScore} />
                        <ScoreBar label="Regime" score={aiResult.regimeScore} />
                      </div>

                      {/* Detailed overview toggle */}
                      <button
                        onClick={() => setDetailedOpen((v) => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                        style={{ color: cfg.color }}
                      >
                        {detailedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {detailedOpen ? 'Hide' : 'Detailed Overview'}
                      </button>
                    </div>
                  )
                })()}

                {/* Detailed overview — collapsible */}
                {detailedOpen && aiResult.metrics && aiResult.metrics.length > 0 && (
                  <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-5">
                    {(['fundamental', 'technical', 'regime'] as const).map((cat) => {
                      const catMetrics = aiResult.metrics.filter((m) => m.category === cat)
                      if (!catMetrics.length) return null
                      const catLabel = cat === 'fundamental' ? 'Fundamental Metrics' : cat === 'technical' ? 'Technical Indicators' : 'Market Regime'
                      return (
                        <div key={cat} className="mb-6 last:mb-0">
                          <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-3 font-medium">{catLabel}</p>
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
                                {catMetrics.map((m) => <MetricTableRow key={m.key} metric={m} />)}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Queries remaining */}
                {aiResult.queriesLimit != null && (
                  <p className="text-[#8A99B3] text-xs mt-3">
                    {aiResult.queriesLimit - (aiResult.queriesUsed ?? 0)} free queries remaining today ·{' '}
                    <a href="/pricing" className="text-[#2F80ED] hover:underline">Upgrade to Pro</a> for unlimited
                  </p>
                )}
              </div>
            )}
          </div>

          {/* News section */}
          <NewsSection ticker={ticker} companyName={fundamentals.name} />
        </>
      )}
    </div>
  )
}

// ── News section (lazy-loaded) ─────────────────────────────────────────────────

function NewsSection({ ticker, companyName }: { ticker: string; companyName: string }) {
  const [news, setNews] = useState<{ datetime: number; headline: string; source: string; url: string }[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true); setNews(null)
    fetch(`/api/stock/news?symbol=${encodeURIComponent(ticker)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setNews(Array.isArray(d) ? d : []))
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
        Latest News
        <span className="text-[#8A99B3] font-normal ml-2">— {companyName}</span>
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
            <a
              key={i} href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-3 py-3 group hover:bg-[#1E2D4A]/20 -mx-2 px-2 rounded transition-colors"
            >
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
