'use client'

import { useState, useCallback } from 'react'
import { Search, Info, Bot, ExternalLink, TrendingUp, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Fundamentals = {
  symbol: string
  name: string
  sector: string | null
  industry: string | null
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
  week52High: number | null
  week52Low: number | null
  revenue: number | null
  profitMargin: number | null
  roe: number | null
  revenuePerShare: number | null
  analystRating: {
    buy: number; hold: number; sell: number
    strongBuy: number; strongSell: number
    total: number; consensus: string; period: string
  } | null
}

type NewsItem = {
  datetime: number
  headline: string
  source: string
  url: string
  summary: string
}

type CalcType = 'fairvalue' | 'momentum' | 'meanrev'

type CalcResult =
  | { type: 'fairvalue'; conservative: number; fair: number; optimistic: number; current: number; eps: number }
  | { type: 'momentum'; r3m: number | null; r6m: number | null; r12m: number | null; score: number }
  | { type: 'meanrev'; price: number; sma20: number; deviation: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtLargeNum(n: number | null): string {
  if (n == null) return 'N/A'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function timeAgo(unix: number): string {
  const diff = Date.now() / 1000 - unix
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function sma(data: number[], n: number): number | null {
  if (data.length < n) return null
  return data.slice(-n).reduce((a, b) => a + b, 0) / n
}

// ── Metric tooltip content ────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  peRatio:       'Price-to-Earnings: how much investors pay per $1 of earnings. Lower can mean cheaper, but context matters — growth stocks trade at higher multiples.',
  forwardPE:     'Forward P/E uses next year\'s estimated earnings. Lower than trailing P/E suggests analysts expect earnings growth.',
  eps:           'Earnings Per Share (TTM): the company\'s net profit divided by shares outstanding over the last 12 months. The foundation of most valuation models.',
  beta:          'Beta measures volatility vs the S&P 500. Beta > 1 = more volatile than the market. Beta < 1 = less volatile. Beta < 0 = moves inversely.',
  dividendYield: 'Annual dividend payment as a percentage of stock price. Only relevant if the company pays dividends. Higher yield can signal value — or distress.',
  marketCap:     'Total market value of all shares outstanding. Large-cap (>$10B), Mid-cap ($2B–$10B), Small-cap (<$2B).',
  week52:        '52-week price range. Helps gauge where the stock sits relative to its recent high and low — useful context for momentum and valuation.',
  revenue:       'Total Revenue (TTM): total income from business operations over the last 12 months, before expenses.',
  profitMargin:  'Net Profit Margin: percentage of revenue that becomes profit. Higher = more efficient at converting sales to earnings.',
  roe:           'Return on Equity: how much profit a company generates per dollar of shareholder equity. Above 15% is generally considered strong.',
  analystRating: 'Consensus analyst recommendation based on the latest published ratings from Wall Street analysts. Not a guarantee — analysts are often wrong.',
}

// ── Metric card with tooltip ──────────────────────────────────────────────────

function MetricCard({
  label, value, sub, color, tooltipKey,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  tooltipKey?: string
}) {
  return (
    <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[10px] text-[#8A99B3] uppercase tracking-widest font-medium">{label}</p>
        {tooltipKey && TOOLTIPS[tooltipKey] && (
          <div className="relative group">
            <Info size={10} className="text-[#2F80ED]/60 cursor-help hover:text-[#2F80ED] transition-colors" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#1E2D4A] border border-[#2F80ED]/20 rounded-[4px] px-3 py-2 text-[11px] text-[#F0F4FF] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              {TOOLTIPS[tooltipKey]}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1E2D4A] border-r border-b border-[#2F80ED]/20 rotate-45 -mt-1" />
            </div>
          </div>
        )}
      </div>
      <p className="text-base font-bold" style={{ color: color ?? '#F0F4FF', fontFamily: 'var(--font-syne)' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#8A99B3] mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FundamentalClient() {
  const [searchInput, setSearchInput] = useState('')
  const [ticker,      setTicker]      = useState('')
  const [data,        setData]        = useState<Fundamentals | null>(null)
  const [news,        setNews]        = useState<NewsItem[] | null>(null)
  const [calcResult,  setCalcResult]  = useState<CalcResult | null>(null)
  const [aiResponse,  setAiResponse]  = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [newsLoading, setNewsLoading] = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)
  const [aiLoading,   setAiLoading]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // ── Load stock ─────────────────────────────────────────────────────────────

  const loadStock = useCallback(async (sym: string) => {
    setLoading(true); setNewsLoading(true)
    setError(null); setData(null); setNews(null); setCalcResult(null); setAiResponse(null)

    // Fetch fundamentals and news in parallel
    const [fundRes, newsRes] = await Promise.allSettled([
      fetch(`/api/stock/fundamentals?symbol=${encodeURIComponent(sym)}`),
      fetch(`/api/stock/news?symbol=${encodeURIComponent(sym)}`),
    ])

    if (fundRes.status === 'fulfilled' && fundRes.value.ok) {
      setData(await fundRes.value.json() as Fundamentals)
    } else {
      setError('Could not load fundamentals. Check the ticker symbol.')
    }
    setLoading(false)

    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      setNews(await newsRes.value.json() as NewsItem[])
    }
    setNewsLoading(false)
  }, [])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const sym = searchInput.trim().toUpperCase()
    if (!sym) return
    setTicker(sym)
    loadStock(sym)
  }, [searchInput, loadStock])

  // ── Calculated analyses ────────────────────────────────────────────────────

  const runCalc = useCallback(async (type: CalcType) => {
    if (!data) return
    setCalcLoading(true); setCalcResult(null)

    if (type === 'fairvalue') {
      const eps = data.eps ?? 0
      setCalcResult({
        type: 'fairvalue',
        conservative: eps * 10,
        fair:         eps * 15,
        optimistic:   eps * 22,
        current:      data.price,
        eps,
      })
      setCalcLoading(false)
      return
    }

    // Momentum and Mean Reversion both need historical price data
    try {
      const period = type === 'momentum' ? '1y' : '1mo'
      const res   = await fetch(`/api/stock/chart?symbol=${encodeURIComponent(ticker)}&period=${period}`)
      const json  = await res.json() as { data: { close: number }[] }
      const closes = json.data.map((d) => d.close)
      const n = closes.length

      if (type === 'momentum') {
        const r3m  = n >= 63  ? ((closes[n-1] - closes[n-63])  / closes[n-63])  * 100 : null
        const r6m  = n >= 126 ? ((closes[n-1] - closes[n-126]) / closes[n-126]) * 100 : null
        const r12m = n >= 252 ? ((closes[n-1] - closes[n-252]) / closes[n-252]) * 100 : null
        const valid = [r3m, r6m, r12m].filter((v): v is number => v != null)
        const score = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
        setCalcResult({ type: 'momentum', r3m, r6m, r12m, score })
      } else {
        const s20   = sma(closes, 20) ?? closes[closes.length - 1]
        const price = closes[closes.length - 1]
        setCalcResult({ type: 'meanrev', price, sma20: s20, deviation: ((price - s20) / s20) * 100 })
      }
    } catch {
      setCalcResult(null)
    }

    setCalcLoading(false)
  }, [data, ticker])

  // ── AI Analysis ────────────────────────────────────────────────────────────

  const runAI = useCallback(async () => {
    if (!data) return
    setAiLoading(true); setAiResponse(null)

    const fmt = (v: number | null, suffix = '') =>
      v != null ? `${v.toFixed(2)}${suffix}` : 'N/A'

    const prompt =
      `Provide an educational fundamental analysis for ${data.name} (${ticker}). ` +
      `Sector: ${data.sector ?? 'N/A'}. Price: $${data.price.toFixed(2)}. ` +
      `P/E: ${fmt(data.peRatio)}. Forward P/E: ${fmt(data.forwardPE)}. ` +
      `EPS: $${fmt(data.eps)}. ROE: ${fmt(data.roe ? data.roe * 100 : null, '%')}. ` +
      `Beta: ${fmt(data.beta)}. Profit Margin: ${fmt(data.profitMargin ? data.profitMargin * 100 : null, '%')}. ` +
      `Market Cap: ${fmtLargeNum(data.marketCap)}. Revenue TTM: ${fmtLargeNum(data.revenue)}. ` +
      `Dividend Yield: ${fmt(data.dividendYield ? data.dividendYield * 100 : null, '%')}. ` +
      `52W Range: $${fmt(data.week52Low)} – $${fmt(data.week52High)}. ` +
      `Analyst Consensus: ${data.analystRating?.consensus ?? 'N/A'}. ` +
      `Explain what these numbers tell a trader about the company\'s financial health. Be educational and concise.`

    try {
      const res  = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      })
      const json = await res.json() as { response?: string; error?: string }
      setAiResponse(json.response ?? json.error ?? 'No response received.')
    } catch {
      setAiResponse('Failed to reach the AI. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }, [data, ticker])

  // ── Render calc panel ──────────────────────────────────────────────────────

  const renderCalc = (r: CalcResult) => {
    if (r.type === 'fairvalue') {
      const { conservative, fair, optimistic, current, eps } = r
      if (eps <= 0) {
        return (
          <p className="text-[#8A99B3] text-sm">
            Fair value estimate requires positive EPS. This company is currently not profitable (EPS ≤ 0).
          </p>
        )
      }
      const status = current < conservative ? 'undervalued'
        : current < optimistic ? 'fairly-valued'
        : 'overvalued'
      const statusColor = status === 'undervalued' ? '#00C896'
        : status === 'fairly-valued' ? '#F59E0B' : '#FF4D4D'
      const statusLabel = status === 'undervalued' ? 'Potentially Undervalued'
        : status === 'fairly-valued' ? 'Fairly Valued'
        : 'Potentially Overvalued'
      return (
        <div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Stat label="Conservative" value={`$${conservative.toFixed(2)}`} sub="EPS × 10" />
            <Stat label="Fair Value"   value={`$${fair.toFixed(2)}`}         sub="EPS × 15" />
            <Stat label="Optimistic"   value={`$${optimistic.toFixed(2)}`}   sub="EPS × 22" />
            <Stat label="Current"      value={`$${current.toFixed(2)}`}      color="#4FA3FF" />
          </div>
          <p className="text-sm font-semibold mb-2" style={{ color: statusColor }}>{statusLabel}</p>
          <p className="text-[#8A99B3] text-xs leading-relaxed">
            This is a simplified P/E-based fair value model (not a DCF). Conservative assumes a P/E of 10 (value stock), Fair Value assumes 15 (historical market average), Optimistic assumes 22 (moderate growth premium). Use as a rough reference only — sector, growth rate, and debt levels all affect appropriate multiples.
          </p>
        </div>
      )
    }

    if (r.type === 'momentum') {
      const fmt = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : 'N/A'
      const col = (v: number | null) => v == null ? '#8A99B3' : v >= 0 ? '#00C896' : '#FF4D4D'
      const scoreLabel = r.score > 20 ? 'Strong Bullish' : r.score > 0 ? 'Mild Bullish' : r.score > -20 ? 'Mild Bearish' : 'Strong Bearish'
      const scoreColor = r.score > 20 ? '#00C896' : r.score > 0 ? '#4FA3FF' : r.score > -20 ? '#F59E0B' : '#FF4D4D'
      return (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="3-Month"  value={fmt(r.r3m)}  color={col(r.r3m)} />
            <Stat label="6-Month"  value={fmt(r.r6m)}  color={col(r.r6m)} />
            <Stat label="12-Month" value={fmt(r.r12m)} color={col(r.r12m)} />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[#8A99B3] text-xs">Average Momentum:</span>
            <span className="font-bold" style={{ color: scoreColor }}>
              {r.score >= 0 ? '+' : ''}{r.score.toFixed(1)}%
            </span>
            <span className="text-xs px-2 py-0.5 border rounded" style={{ borderColor: scoreColor, color: scoreColor }}>
              {scoreLabel}
            </span>
          </div>
          <p className="text-[#8A99B3] text-xs leading-relaxed">
            Price momentum measures how the stock has performed over recent periods. Consistent positive momentum across 3M, 6M, and 12M is a stronger signal than a single period. Academic research shows momentum tends to persist in the medium term.
          </p>
        </div>
      )
    }

    if (r.type === 'meanrev') {
      const dev = r.deviation
      const col = Math.abs(dev) > 5 ? '#FF4D4D' : '#00C896'
      return (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="Current Price" value={`$${r.price.toFixed(2)}`} />
            <Stat label="20-Day SMA"    value={`$${r.sma20.toFixed(2)}`} />
            <Stat label="Deviation"
              value={`${dev >= 0 ? '+' : ''}${dev.toFixed(2)}%`}
              color={col} />
          </div>
          <p className="text-[#8A99B3] text-xs leading-relaxed">
            {Math.abs(dev) > 5
              ? `Price is ${Math.abs(dev).toFixed(1)}% ${dev > 0 ? 'above' : 'below'} its 20-day average — extended from the mean. Mean-reversion strategies look for these stretched conditions as potential entry points in the opposite direction.`
              : 'Price is trading close to its 20-day average. No significant deviation detected. Mean-reversion traders typically look for stretches of 5%+ before considering a setup.'}
          </p>
        </div>
      )
    }

    return null
  }

  // ── Analyst rating bar ─────────────────────────────────────────────────────

  const renderAnalystBar = (r: NonNullable<Fundamentals['analystRating']>) => {
    const segments = [
      { label: 'Strong Buy', count: r.strongBuy, color: '#00C896' },
      { label: 'Buy',        count: r.buy,       color: '#4FA3FF' },
      { label: 'Hold',       count: r.hold,      color: '#F59E0B' },
      { label: 'Sell',       count: r.sell,      color: '#FF6B6B' },
      { label: 'Strong Sell',count: r.strongSell,color: '#FF4D4D' },
    ]
    const total = r.total || 1
    return (
      <div>
        <div className="flex h-3 rounded-full overflow-hidden gap-px mb-2">
          {segments.map((s) => s.count > 0 && (
            <div key={s.label} className="transition-all" style={{
              width: `${(s.count / total) * 100}%`,
              backgroundColor: s.color,
              minWidth: s.count > 0 ? 2 : 0,
            }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {segments.map((s) => (
            <span key={s.label} className="text-[10px]" style={{ color: s.color }}>
              {s.label}: {s.count}
            </span>
          ))}
        </div>
        <p className="text-[#8A99B3] text-[10px] mt-1">
          Based on {total} analyst ratings · Period: {r.period}
        </p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
          Fundamental Analysis
        </h1>
        <p className="text-[#8A99B3] text-sm mt-0.5">Financial metrics, valuation & news</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
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
          disabled={loading}
          className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-[4px] transition-colors"
        >
          {loading ? 'Loading…' : 'Load'}
        </button>
      </form>

      {/* Empty state */}
      {!ticker && (
        <div className="flex flex-col items-center justify-center h-52 bg-[#0F1729] border border-[#1E2D4A] rounded-[6px]">
          <TrendingUp size={36} className="text-[#1E2D4A] mb-3" />
          <p className="text-[#8A99B3] text-sm">Enter a ticker to load fundamental data</p>
          <p className="text-[#2F80ED]/40 text-xs mt-1">AAPL · MSFT · TSLA · NVDA · JPM</p>
        </div>
      )}

      {error && ticker && (
        <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-[6px] px-4 py-3 text-[#FF4D4D] text-sm mb-6">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Company header */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  {data.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[#8A99B3] text-xs">{ticker}</span>
                  {data.sector && (
                    <>
                      <span className="text-[#1E2D4A]">·</span>
                      <span className="text-[#8A99B3] text-xs">{data.sector}</span>
                    </>
                  )}
                  {data.industry && (
                    <>
                      <span className="text-[#1E2D4A]">·</span>
                      <span className="text-[#8A99B3] text-xs">{data.industry}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  ${data.price.toFixed(2)}
                </p>
                <p className={`text-sm font-medium ${data.change >= 0 ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                  {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}
                  {' '}({data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
            {data.description && (
              <p className="text-[#8A99B3] text-xs leading-relaxed mt-3 border-t border-[#1E2D4A] pt-3">
                {data.description}
                {data.description.length >= 400 && '…'}
              </p>
            )}
          </div>

          {/* Key metrics grid */}
          <div className="mb-5">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-3 font-medium">Key Metrics</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard
                label="P/E Ratio (TTM)"
                value={data.peRatio != null ? data.peRatio.toFixed(1) : 'N/A'}
                sub={data.forwardPE != null ? `Fwd: ${data.forwardPE.toFixed(1)}` : undefined}
                color={data.peRatio != null ? (data.peRatio < 15 ? '#00C896' : data.peRatio > 30 ? '#FF4D4D' : '#F0F4FF') : '#8A99B3'}
                tooltipKey="peRatio"
              />
              <MetricCard
                label="EPS (TTM)"
                value={data.eps != null ? `$${data.eps.toFixed(2)}` : 'N/A'}
                color={data.eps != null ? (data.eps > 0 ? '#00C896' : '#FF4D4D') : '#8A99B3'}
                tooltipKey="eps"
              />
              <MetricCard
                label="ROE"
                value={data.roe != null ? `${(data.roe * 100).toFixed(1)}%` : 'N/A'}
                color={data.roe != null ? (data.roe > 0.15 ? '#00C896' : data.roe > 0 ? '#F59E0B' : '#FF4D4D') : '#8A99B3'}
                tooltipKey="roe"
              />
              <MetricCard
                label="Beta"
                value={data.beta != null ? data.beta.toFixed(2) : 'N/A'}
                sub={data.beta != null ? (data.beta > 1.5 ? 'High Volatility' : data.beta < 0.5 ? 'Low Volatility' : 'Moderate') : undefined}
                tooltipKey="beta"
              />
              <MetricCard
                label="Dividend Yield"
                value={data.dividendYield != null ? `${(data.dividendYield * 100).toFixed(2)}%` : 'None'}
                color={data.dividendYield ? '#00C896' : '#8A99B3'}
                tooltipKey="dividendYield"
              />
              <MetricCard
                label="Market Cap"
                value={fmtLargeNum(data.marketCap)}
                tooltipKey="marketCap"
              />
              <MetricCard
                label="52-Week Range"
                value={data.week52Low != null && data.week52High != null
                  ? `$${data.week52Low.toFixed(0)} – $${data.week52High.toFixed(0)}`
                  : 'N/A'}
                sub={data.week52Low && data.week52High
                  ? `${(((data.price - data.week52Low) / (data.week52High - data.week52Low)) * 100).toFixed(0)}% of range`
                  : undefined}
                tooltipKey="week52"
              />
              <MetricCard
                label="Revenue (TTM)"
                value={fmtLargeNum(data.revenue)}
                tooltipKey="revenue"
              />
              <MetricCard
                label="Profit Margin"
                value={data.profitMargin != null ? `${(data.profitMargin * 100).toFixed(1)}%` : 'N/A'}
                color={data.profitMargin != null ? (data.profitMargin > 0.2 ? '#00C896' : data.profitMargin > 0.05 ? '#F59E0B' : '#FF4D4D') : '#8A99B3'}
                tooltipKey="profitMargin"
              />
              {data.analystRating && (
                <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] p-4 sm:col-span-1 lg:col-span-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[10px] text-[#8A99B3] uppercase tracking-widest font-medium">Analyst Rating</p>
                    <div className="relative group">
                      <Info size={10} className="text-[#2F80ED]/60 cursor-help hover:text-[#2F80ED] transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#1E2D4A] border border-[#2F80ED]/20 rounded-[4px] px-3 py-2 text-[11px] text-[#F0F4FF] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                        {TOOLTIPS.analystRating}
                      </div>
                    </div>
                  </div>
                  <p className="text-base font-bold mb-2" style={{
                    fontFamily: 'var(--font-syne)',
                    color: data.analystRating.consensus === 'Buy' ? '#00C896'
                      : data.analystRating.consensus === 'Sell' ? '#FF4D4D'
                      : '#F59E0B',
                  }}>
                    {data.analystRating.consensus}
                  </p>
                  {renderAnalystBar(data.analystRating)}
                </div>
              )}
            </div>
          </div>

          {/* Calculated analyses */}
          <div className="mb-5">
            <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-3 font-medium">Calculated Analysis</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { key: 'fairvalue' as CalcType, label: 'Fair Value Estimate' },
                { key: 'momentum' as CalcType,  label: 'Momentum Score'     },
                { key: 'meanrev'  as CalcType,  label: 'Mean Reversion'     },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => runCalc(key)}
                  className="text-[11px] px-4 py-1.5 rounded-[4px] font-medium transition-colors"
                  style={{
                    backgroundColor: calcResult?.type === key ? '#2F80ED1A' : 'transparent',
                    color:           calcResult?.type === key ? '#F0F4FF'   : '#8A99B3',
                    border:          `1px solid ${calcResult?.type === key ? '#2F80ED' : '#1E2D4A'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {calcResult && (
              <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 card-glow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                    {calcResult.type === 'fairvalue' ? 'Fair Value Estimate'
                      : calcResult.type === 'momentum' ? 'Momentum Score'
                      : 'Mean Reversion Signal'}
                    <span className="text-[#8A99B3] font-normal ml-2">— {ticker}</span>
                  </h3>
                  <button
                    onClick={() => setCalcResult(null)}
                    className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                {calcLoading
                  ? <p className="text-[#8A99B3] text-sm animate-pulse">Calculating…</p>
                  : renderCalc(calcResult)}
              </div>
            )}
          </div>

          {/* AI Analysis */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-[#2F80ED]" />
                <h3 className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                  AI Fundamental Analysis
                </h3>
              </div>
              <button
                onClick={runAI}
                disabled={aiLoading}
                className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5"
              >
                {aiLoading && (
                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin inline-block" />
                )}
                {aiLoading ? 'Analyzing…' : 'Get AI Analysis'}
              </button>
            </div>
            {aiResponse ? (
              <p className="text-[#F0F4FF] text-sm leading-relaxed">{aiResponse}</p>
            ) : (
              <p className="text-[#8A99B3] text-sm">
                Click &quot;Get AI Analysis&quot; for an educational summary of this company&apos;s financial health based on the metrics above.
              </p>
            )}
          </div>

          {/* News feed */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5">
            <h3 className="text-sm font-semibold text-[#F0F4FF] mb-4" style={{ fontFamily: 'var(--font-syne)' }}>
              Latest News
              {data.name && <span className="text-[#8A99B3] font-normal ml-2">— {data.name}</span>}
            </h3>

            {newsLoading && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-[#1E2D4A]/30 rounded animate-pulse" />
                ))}
              </div>
            )}

            {!newsLoading && news && news.length === 0 && (
              <p className="text-[#8A99B3] text-sm">No recent news found for {ticker}.</p>
            )}

            {!newsLoading && news && news.length > 0 && (
              <div className="divide-y divide-[#1E2D4A]">
                {news.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
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

            {!newsLoading && !news && (
              <p className="text-[#8A99B3] text-sm">News unavailable.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, sub, color = '#F0F4FF' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] px-3 py-2">
      <p className="text-[10px] text-[#8A99B3] mb-0.5 truncate">{label}</p>
      <p className="text-sm font-bold truncate" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[#8A99B3] mt-0.5">{sub}</p>}
    </div>
  )
}
