'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Play, Radar, ChevronRight, AlertCircle } from 'lucide-react'
import type { FilterCriterion, FilterType, ScanResult, ScanUniverse } from '@/app/api/scanner/route'
import { SkeletonTable } from '@/components/ui/Skeleton'

// ── Filter definitions ────────────────────────────────────────────────────────

type FilterDef = {
  type: FilterType
  label: string
  hasValue: boolean
  defaultValue?: number
  valueLabel?: string
  valueSuffix?: string
}

const FILTER_DEFS: FilterDef[] = [
  { type: 'rsi_below',         label: 'RSI below',                      hasValue: true,  defaultValue: 30, valueLabel: 'threshold', valueSuffix: '' },
  { type: 'rsi_above',         label: 'RSI above',                      hasValue: true,  defaultValue: 70, valueLabel: 'threshold', valueSuffix: '' },
  { type: 'price_above_sma50', label: 'Price above SMA 50',             hasValue: false },
  { type: 'price_below_sma50', label: 'Price below SMA 50',             hasValue: false },
  { type: 'price_above_sma200',label: 'Price above SMA 200',            hasValue: false },
  { type: 'price_below_sma200',label: 'Price below SMA 200',            hasValue: false },
  { type: 'macd_bullish',      label: 'MACD bullish crossover (3 days)', hasValue: false },
  { type: 'macd_bearish',      label: 'MACD bearish crossover (3 days)', hasValue: false },
  { type: 'volume_spike',      label: 'Volume spike above avg by',       hasValue: true,  defaultValue: 50,  valueLabel: 'pct above avg', valueSuffix: '%' },
  { type: 'near_52w_high',     label: 'Within X% of 52-week high',       hasValue: true,  defaultValue: 2,   valueLabel: 'within %', valueSuffix: '%' },
  { type: 'near_52w_low',      label: 'Within X% of 52-week low',        hasValue: true,  defaultValue: 5,   valueLabel: 'within %', valueSuffix: '%' },
  { type: 'pe_below',          label: 'P/E ratio below',                  hasValue: true,  defaultValue: 20,  valueLabel: 'P/E', valueSuffix: 'x' },
  { type: 'eps_positive',      label: 'EPS positive (profitable)',        hasValue: false },
]

const FILTER_MAP = Object.fromEntries(FILTER_DEFS.map(d => [d.type, d]))

// ── Preset scans ──────────────────────────────────────────────────────────────

type Preset = {
  id: string
  label: string
  description: string
  icon: string
  filters: FilterCriterion[]
}

const PRESETS: Preset[] = [
  {
    id: 'oversold',
    label: 'Oversold Bouncers',
    description: 'RSI below 30 + above SMA 200 — oversold in a long-term uptrend',
    icon: '🔄',
    filters: [{ type: 'rsi_below', value: 30 }, { type: 'price_above_sma200' }],
  },
  {
    id: 'breakout',
    label: 'Breakout Candidates',
    description: 'Near 52W high + volume spike — potential breakout setup',
    icon: '🚀',
    filters: [{ type: 'near_52w_high', value: 2 }, { type: 'volume_spike', value: 50 }],
  },
  {
    id: 'macd_momentum',
    label: 'MACD Momentum',
    description: 'Bullish MACD crossover + above SMA 50 — momentum entry',
    icon: '📈',
    filters: [{ type: 'macd_bullish' }, { type: 'price_above_sma50' }],
  },
  {
    id: 'undervalued',
    label: 'Undervalued Growth',
    description: 'P/E below 20 + positive EPS — value with proven profitability',
    icon: '💎',
    filters: [{ type: 'pe_below', value: 20 }, { type: 'eps_positive' }],
  },
]

// ── Universe options ──────────────────────────────────────────────────────────

type UniverseOption = {
  value: ScanUniverse
  label: string
  description: string
  badge: string
}

const UNIVERSE_OPTIONS: UniverseOption[] = [
  {
    value: 'watchlist',
    label: 'My Watchlist',
    description: 'Scan only tickers you have saved',
    badge: 'Custom',
  },
  {
    value: 'sp500_30',
    label: 'Top 30 S&P 500',
    description: 'The 30 largest S&P 500 components by market cap',
    badge: '~30',
  },
  {
    value: 'sp500_all',
    label: 'All S&P 500',
    description: 'Full S&P 500 constituent list (capped at 60 per scan)',
    badge: '500+',
  },
  {
    value: 'gainers',
    label: 'Top Gainers Today',
    description: "Today's top 100 gaining stocks from Yahoo Finance",
    badge: '100',
  },
]

// ── UI helpers ────────────────────────────────────────────────────────────────

const SELECT_STYLES = "bg-[#0A0F1E] border border-[#1E2D4A] text-[#F0F4FF] text-sm px-3 py-2 rounded-[4px] outline-none focus:border-[#2F80ED] transition-colors cursor-pointer appearance-none"
const ARROW_BG = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A99B3' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }

function pctColor(v: number) { return v >= 0 ? '#00C896' : '#FF4D4D' }

// ── Main component ────────────────────────────────────────────────────────────

export default function ScannerClient() {
  const router = useRouter()
  const [filters,       setFilters]       = useState<FilterCriterion[]>([{ type: 'rsi_below', value: 30 }])
  const [universe,      setUniverse]      = useState<ScanUniverse>('watchlist')
  const [running,       setRunning]       = useState(false)
  const [results,       setResults]       = useState<ScanResult[] | null>(null)
  const [scanMeta,      setScanMeta]      = useState<{
    tickerCount: number; watchlistCount: number; ms: number; universe: ScanUniverse; emptyWatchlist: boolean
  } | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [activePreset,  setActivePreset]  = useState<string | null>(null)

  // ── Filter management ──────────────────────────────────────────────────────

  function addFilter() {
    if (filters.length >= 4) return
    const unused = FILTER_DEFS.find(d => !filters.some(f => f.type === d.type))
    if (!unused) return
    setFilters(prev => [...prev, { type: unused.type, value: unused.defaultValue }])
    setActivePreset(null)
  }

  function removeFilter(i: number) {
    setFilters(prev => prev.filter((_, idx) => idx !== i))
    setActivePreset(null)
  }

  function updateFilterType(i: number, type: FilterType) {
    const def = FILTER_MAP[type]
    setFilters(prev => prev.map((f, idx) =>
      idx === i ? { type, value: def?.defaultValue } : f
    ))
    setActivePreset(null)
  }

  function updateFilterValue(i: number, value: string) {
    setFilters(prev => prev.map((f, idx) =>
      idx === i ? { ...f, value: parseFloat(value) || 0 } : f
    ))
  }

  function loadPreset(preset: Preset) {
    setFilters(preset.filters)
    setActivePreset(preset.id)
  }

  // ── Run scan ───────────────────────────────────────────────────────────────

  const runScan = useCallback(async () => {
    if (running || !filters.length) return
    setRunning(true)
    setResults(null)
    setError(null)
    const t0 = Date.now()

    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, universe }),
      })
      const data = await res.json() as {
        results: ScanResult[]
        tickerCount: number
        watchlistCount: number
        universe: ScanUniverse
        emptyWatchlist: boolean
        error?: string
      }
      if (!res.ok) { setError(data.error ?? 'Scan failed'); return }
      setResults(data.results)
      setScanMeta({
        tickerCount:   data.tickerCount,
        watchlistCount: data.watchlistCount,
        ms:            Date.now() - t0,
        universe:      data.universe,
        emptyWatchlist: data.emptyWatchlist ?? false,
      })
    } catch {
      setError('Network error — please try again')
    } finally {
      setRunning(false)
    }
  }, [filters, universe, running])

  // ── Universe label ─────────────────────────────────────────────────────────
  const selectedUniverse = UNIVERSE_OPTIONS.find(u => u.value === universe)!

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Radar size={20} className="text-[#2F80ED]" />
          <h1 className="text-2xl font-bold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
            Trade Setup Scanner
          </h1>
        </div>
        <p className="text-[#8A99B3] text-sm">
          Scan any stock universe for technical and fundamental setups
        </p>
      </div>

      {/* ── Scan Universe Selector (Task 7) ─────────────────────────────────── */}
      <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-5">
        <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium mb-3">
          Scan Universe — Choose What to Scan
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {UNIVERSE_OPTIONS.map(opt => {
            const isActive = universe === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setUniverse(opt.value)}
                className="text-left p-3 rounded-[6px] border transition-all"
                style={{
                  backgroundColor: isActive ? '#2F80ED18' : '#0A0F1E',
                  borderColor:     isActive ? '#2F80ED80' : '#1E2D4A',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-[#F0F4FF]">{opt.label}</p>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-[3px]"
                    style={{
                      backgroundColor: isActive ? '#2F80ED30' : '#1E2D4A',
                      color: isActive ? '#4FA3FF' : '#8A99B3',
                    }}
                  >
                    {opt.badge}
                  </span>
                </div>
                <p className="text-[10px] text-[#8A99B3] leading-relaxed">{opt.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Preset scans */}
      <div className="mb-5">
        <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium mb-3">Preset Scans — Load Instantly</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => loadPreset(p)}
              className="text-left p-3 rounded-[6px] border transition-all"
              style={{
                backgroundColor: activePreset === p.id ? '#2F80ED15' : '#0F1729',
                borderColor:     activePreset === p.id ? '#2F80ED60' : '#1E2D4A',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{p.icon}</span>
                <p className="text-xs font-semibold text-[#F0F4FF]">{p.label}</p>
              </div>
              <p className="text-[10px] text-[#8A99B3] leading-relaxed">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Scan builder */}
      <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-5">
        <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium mb-4">
          Build Your Scan — AND Logic (all criteria must match)
        </p>

        {/* Filters */}
        <div className="space-y-2.5 mb-4">
          {filters.map((f, i) => {
            const def = FILTER_MAP[f.type]
            return (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#8A99B3] w-16 text-right shrink-0">
                  {i === 0 ? 'WHERE' : 'AND'}
                </span>
                <select
                  value={f.type}
                  onChange={e => updateFilterType(i, e.target.value as FilterType)}
                  className={SELECT_STYLES}
                  style={{ ...ARROW_BG, minWidth: 240 }}
                >
                  {FILTER_DEFS.map(d => (
                    <option key={d.type} value={d.type}
                      disabled={d.type !== f.type && filters.some(ff => ff.type === d.type)}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {def?.hasValue && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={f.value ?? def.defaultValue ?? ''}
                      onChange={e => updateFilterValue(i, e.target.value)}
                      min={0}
                      step={f.type === 'pe_below' ? 1 : 0.5}
                      className="bg-[#0A0F1E] border border-[#1E2D4A] text-[#F0F4FF] text-sm px-3 py-2 rounded-[4px] w-20 outline-none focus:border-[#2F80ED] tabular-nums"
                    />
                    {def.valueSuffix && (
                      <span className="text-[#8A99B3] text-xs">{def.valueSuffix}</span>
                    )}
                  </div>
                )}
                {filters.length > 1 && (
                  <button onClick={() => removeFilter(i)}
                    className="text-[#8A99B3] hover:text-[#FF4D4D] p-1 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Add filter */}
        {filters.length < 4 && (
          <button onClick={addFilter}
            className="flex items-center gap-1.5 text-xs text-[#2F80ED] hover:text-[#4FA3FF] transition-colors mb-5">
            <Plus size={12} />
            Add criterion {filters.length > 0 && `(${4 - filters.length} remaining)`}
          </button>
        )}

        {/* Run button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1E2D4A]">
          <div>
            <p className="text-[10px] text-[#8A99B3] mb-0.5">Scanning:</p>
            <p className="text-xs text-[#F0F4FF] font-medium">{selectedUniverse.label}</p>
          </div>
          <button
            onClick={runScan}
            disabled={running || !filters.length}
            className="flex items-center gap-2 bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-[4px] transition-colors"
          >
            {running ? (
              <>
                <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                Scanning {selectedUniverse.badge} stocks…
              </>
            ) : (
              <><Play size={13} /> Run Scan</>
            )}
          </button>
        </div>
      </div>

      {/* Running skeleton */}
      {running && (
        <div className="mb-5">
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 border-2 border-[#2F80ED]/30 border-t-[#2F80ED] rounded-full animate-spin flex-shrink-0" />
              <p className="text-[#8A99B3] text-sm">
                Scanning <span className="text-[#4FA3FF] font-medium">{selectedUniverse.label}</span> ·
                fetching quotes · applying filters…
              </p>
            </div>
            <SkeletonTable rows={4} cols={6} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-[6px] px-4 py-3 text-[#FF4D4D] text-sm mb-5">
          {error}
        </div>
      )}

      {/* Empty watchlist warning */}
      {scanMeta?.emptyWatchlist && (
        <div className="flex items-start gap-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-[6px] px-4 py-3 mb-5">
          <AlertCircle size={16} className="text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <p className="text-[#F59E0B] text-sm font-medium">Your watchlist is empty</p>
            <p className="text-[#F59E0B]/70 text-xs mt-0.5">
              Add tickers to your watchlist first, or choose a different scan universe above.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {results !== null && !running && (
        <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
                {results.length === 0
                  ? 'No matches found'
                  : `${results.length} stock${results.length === 1 ? '' : 's'} matched`}
              </h3>
              {scanMeta && (
                <p className="text-[10px] text-[#8A99B3] mt-0.5">
                  Scanned {scanMeta.tickerCount} tickers from {selectedUniverse.label}
                  {' · '}{(scanMeta.ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
            {results.length > 0 && (
              <span className="text-[10px] text-[#8A99B3]">Click any row to open in Stock Analysis</span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-10">
              <Radar size={32} className="text-[#1E2D4A] mx-auto mb-3" />
              <p className="text-[#8A99B3] text-sm">No stocks passed all criteria in this universe.</p>
              <p className="text-[#8A99B3]/60 text-xs mt-1">
                Try relaxing a filter, choosing a broader universe, or switching presets.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E2D4A]">
                    {['Ticker', 'Name', 'Price', 'Change', 'RSI', 'Matched Criteria', ''].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-[10px] text-[#8A99B3] uppercase tracking-wider font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr
                      key={r.ticker}
                      onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}
                      className="border-b border-[#1E2D4A]/50 hover:bg-[#1E2D4A]/30 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 pr-4">
                        <span className="text-sm font-bold text-[#2F80ED]">{r.ticker}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs text-[#8A99B3] max-w-[120px] truncate block">{r.name}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-semibold text-[#F0F4FF] tabular-nums">
                          ${r.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-medium tabular-nums" style={{ color: pctColor(r.changePercent) }}>
                          {r.changePercent >= 0 ? '+' : ''}{r.changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {r.rsi != null ? (
                          <span
                            className="text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-[3px]"
                            style={{
                              color: r.rsi > 70 ? '#FF4D4D' : r.rsi < 30 ? '#00C896' : '#8A99B3',
                              backgroundColor: r.rsi > 70 ? '#FF4D4D15' : r.rsi < 30 ? '#00C89615' : '#1E2D4A',
                            }}
                          >
                            {r.rsi.toFixed(1)}
                          </span>
                        ) : <span className="text-[#8A99B3] text-xs">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {r.matchedFilters.map((label, i) => (
                            <span key={i}
                              className="text-[10px] px-2 py-0.5 rounded-full border"
                              style={{ backgroundColor: '#2F80ED12', borderColor: '#2F80ED30', color: '#4FA3FF' }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <ChevronRight size={14} className="text-[#8A99B3] group-hover:text-[#2F80ED] transition-colors inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
