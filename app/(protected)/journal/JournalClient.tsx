'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, X, Edit2, Check, BookOpen, TrendingUp, TrendingDown,
  AlertCircle, ChevronDown, Bot, Loader2, RefreshCw,
  Star, Target, BarChart2, Lightbulb, ChevronRight,
} from 'lucide-react'
import type { CoachReport } from '@/app/api/ai/journal-coach/route'

// ── Types ──────────────────────────────────────────────────────────────────────

type Trade = {
  id: string
  date: string
  ticker: string
  entry_price: number
  exit_price: number
  shares: number
  pnl: number
  notes: string
  created_at: string
}

type SortKey = 'date' | 'ticker' | 'pnl'
type SortDir = 'asc' | 'desc'

type TradeForm = {
  date: string; ticker: string; entry_price: string
  exit_price: string; shares: string; notes: string
}

type CoachStats = {
  total: number; winRate: number; totalPnl: number
  avgGain: number; avgLoss: number; rrRatio: number | null
  maxWinStreak: number; maxLossStreak: number
  recentWins: number; recentTotal: number
}

const EMPTY_FORM: TradeForm = {
  date: new Date().toISOString().split('T')[0],
  ticker: '', entry_price: '', exit_price: '', shares: '', notes: '',
}

function previewPnl(f: TradeForm): number | null {
  const e = parseFloat(f.entry_price)
  const x = parseFloat(f.exit_price)
  const s = parseFloat(f.shares)
  if (!isNaN(e) && !isNaN(x) && !isNaN(s) && s > 0) return (x - e) * s
  return null
}

// ── AI Coach Panel ─────────────────────────────────────────────────────────────

function CoachPanel({ tradeCount }: { tradeCount: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CoachReport | null>(null)
  const [stats, setStats] = useState<CoachStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchCoach() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/journal-coach', { method: 'POST' })
      const data = await res.json() as { report?: CoachReport; stats?: CoachStats; tooFewTrades?: boolean; count?: number; error?: string }
      if (data.tooFewTrades) {
        setError(`too_few:${data.count ?? 0}`)
        return
      }
      if (!res.ok || data.error) { setError(data.error ?? 'Analysis failed'); return }
      if (data.report) setReport(data.report)
      if (data.stats) setStats(data.stats)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => { setOpen(v => !v); if (!open && !report && tradeCount >= 5) fetchCoach() }}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#1E2D4A]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-[#2F80ED]/15 border border-[#2F80ED]/25 flex items-center justify-center">
            <Bot size={15} className="text-[#2F80ED]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[#F0F4FF]" style={{ fontFamily: 'var(--font-syne)' }}>
              AI Trading Coach
            </p>
            <p className="text-[10px] text-[#8A99B3]">
              Behavioral analysis · patterns · personalized recommendations
            </p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className={`text-[#8A99B3] transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 border-t border-[#1E2D4A]">

          {/* Too few trades */}
          {error?.startsWith('too_few:') && (
            <div className="pt-5 text-center py-10">
              <BookOpen size={36} className="text-[#1E2D4A] mx-auto mb-3" />
              <p className="text-[#F0F4FF] text-sm font-medium mb-1">Not enough data yet</p>
              <p className="text-[#8A99B3] text-xs leading-relaxed max-w-sm mx-auto">
                You&apos;ve logged <strong className="text-[#F0F4FF]">{error.split(':')[1]}</strong> trade
                {error.split(':')[1] === '1' ? '' : 's'}.
                Log at least <strong className="text-[#F0F4FF]">5 trades</strong> before the AI coach can give meaningful feedback about your patterns.
              </p>
            </div>
          )}

          {/* General error */}
          {error && !error.startsWith('too_few:') && (
            <div className="pt-5">
              <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-[4px] px-4 py-3 text-[#FF4D4D] text-sm mb-3">
                {error}
              </div>
              <button onClick={fetchCoach} disabled={loading}
                className="flex items-center gap-2 text-sm text-[#2F80ED] hover:text-[#4FA3FF]">
                <RefreshCw size={13} /> Try again
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="pt-5 flex flex-col items-center gap-3 py-10">
              <Loader2 size={24} className="text-[#2F80ED] animate-spin" />
              <p className="text-[#8A99B3] text-sm">
                Analyzing {tradeCount} trades · detecting patterns · generating coaching report…
              </p>
            </div>
          )}

          {/* Report */}
          {report && stats && !loading && (
            <div className="pt-5 space-y-5">

              {/* Quick stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? '#00C896' : '#FF4D4D' },
                  { label: 'Avg Win', value: `+$${stats.avgGain.toFixed(0)}`, color: '#00C896' },
                  { label: 'Avg Loss', value: `-$${stats.avgLoss.toFixed(0)}`, color: '#FF4D4D' },
                  { label: 'R:R Ratio', value: stats.rrRatio != null ? `${stats.rrRatio.toFixed(2)}:1` : 'N/A', color: (stats.rrRatio ?? 0) >= 1 ? '#00C896' : '#FF4D4D' },
                ].map(s => (
                  <div key={s.label} className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[4px] p-3 text-center">
                    <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-1">{s.label}</p>
                    <p className="text-base font-bold tabular-nums" style={{ color: s.color, fontFamily: 'var(--font-syne)' }}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Overall summary */}
              <div className="bg-[#2F80ED]/08 border border-[#2F80ED]/20 rounded-[6px] p-4">
                <p className="text-sm text-[#F0F4FF] leading-relaxed">{report.overallSummary}</p>
              </div>

              {/* Two-column: best/worst day + tickers */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Day performance */}
                <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 size={13} className="text-[#2F80ED]" />
                    <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">Day of Week Performance</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#00C896] text-xs mt-0.5">↑</span>
                      <p className="text-xs text-[#F0F4FF]">{report.bestDay}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#FF4D4D] text-xs mt-0.5">↓</span>
                      <p className="text-xs text-[#F0F4FF]">{report.worstDay}</p>
                    </div>
                  </div>
                </div>

                {/* Ticker performance */}
                <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={13} className="text-[#2F80ED]" />
                    <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">Ticker Performance</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#00C896] text-xs mt-0.5">↑</span>
                      <p className="text-xs text-[#F0F4FF]">{report.topTicker}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#FF4D4D] text-xs mt-0.5">↓</span>
                      <p className="text-xs text-[#F0F4FF]">{report.worstTicker}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk/Reward */}
              <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={13} className="text-[#2F80ED]" />
                  <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">Risk / Reward Analysis</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-1">R:R Ratio</p>
                    <p className="text-xs text-[#F0F4FF]">{report.rrRatio}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-1">Average Gain</p>
                    <p className="text-xs text-[#F0F4FF]">{report.avgGain}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest mb-1">Average Loss</p>
                    <p className="text-xs text-[#F0F4FF]">{report.avgLoss}</p>
                  </div>
                </div>
              </div>

              {/* Behavioral patterns */}
              <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={13} className="text-[#F59E0B]" />
                  <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">Behavioral Patterns Detected</p>
                </div>
                <ul className="space-y-2">
                  {report.patterns.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#F59E0B] text-xs font-bold mt-0.5 shrink-0">{i + 1}.</span>
                      <p className="text-xs text-[#F0F4FF] leading-relaxed">{p}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="bg-[#0A0F1E] border border-[#1E2D4A] rounded-[6px] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={13} className="text-[#2F80ED]" />
                  <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">3 Actionable Recommendations</p>
                </div>
                <ul className="space-y-3">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                        style={{ backgroundColor: '#2F80ED20', color: '#2F80ED', border: '1px solid #2F80ED40' }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-xs text-[#F0F4FF] leading-relaxed">{r}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Encouragement */}
              <div className="rounded-[6px] px-4 py-3 flex items-start gap-3"
                style={{ backgroundColor: '#00C89610', border: '1px solid #00C89630' }}>
                <Star size={14} className="text-[#00C896] shrink-0 mt-0.5" />
                <p className="text-xs text-[#F0F4FF] leading-relaxed">{report.encouragement}</p>
              </div>

              {/* Refresh button */}
              <div className="flex justify-end">
                <button onClick={fetchCoach} disabled={loading}
                  className="flex items-center gap-2 text-xs text-[#8A99B3] hover:text-[#F0F4FF] border border-[#1E2D4A] rounded-[4px] px-3 py-1.5 transition-colors">
                  <RefreshCw size={11} />
                  Refresh Analysis
                </button>
              </div>
            </div>
          )}

          {/* Initial CTA (no report yet, no error, not loading) */}
          {!report && !loading && !error && (
            <div className="pt-5 flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-[#2F80ED]/10 border border-[#2F80ED]/20 flex items-center justify-center">
                <Bot size={20} className="text-[#2F80ED]" />
              </div>
              <div className="text-center">
                <p className="text-[#F0F4FF] text-sm font-medium mb-1">Get your personalized coaching report</p>
                <p className="text-[#8A99B3] text-xs max-w-xs leading-relaxed">
                  The AI analyzes all {tradeCount} of your logged trades to find patterns, behavioral tendencies, and specific improvements.
                </p>
              </div>
              <button onClick={fetchCoach}
                className="flex items-center gap-2 bg-[#2F80ED] hover:bg-[#4FA3FF] text-white text-sm font-semibold px-5 py-2.5 rounded-[4px] transition-colors">
                <Bot size={14} />
                Get Coaching Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main JournalClient ─────────────────────────────────────────────────────────

export default function JournalClient() {
  const [trades, setTrades]       = useState<Trade[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState<TradeForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editId, setEditId]       = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<TradeForm>(EMPTY_FORM)
  const [sortKey, setSortKey]     = useState<SortKey>('date')
  const [sortDir, setSortDir]     = useState<SortDir>('desc')

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/journal')
      if (!res.ok) throw new Error('Failed to load journal')
      const data = await res.json() as Trade[]
      setTrades(data)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  const sorted = [...trades].sort((a, b) => {
    let av: number | string = 0
    let bv: number | string = 0
    if (sortKey === 'date')   { av = a.date; bv = b.date }
    if (sortKey === 'ticker') { av = a.ticker; bv = b.ticker }
    if (sortKey === 'pnl')    { av = a.pnl; bv = b.pnl }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const totalTrades = trades.length
  const wins        = trades.filter((t) => t.pnl > 0).length
  const winRate     = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
  const totalPnl    = trades.reduce((s, t) => s + t.pnl, 0)
  const avgPnl      = totalTrades > 0 ? totalPnl / totalTrades : 0

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const body = {
        date: form.date,
        ticker: form.ticker.toUpperCase(),
        entry_price: parseFloat(form.entry_price),
        exit_price: parseFloat(form.exit_price),
        shares: parseFloat(form.shares),
        notes: form.notes,
      }
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return }
      setForm(EMPTY_FORM)
      setShowAdd(false)
      await fetchTrades()
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: string) {
    try {
      const body = {
        id,
        date: editForm.date,
        ticker: editForm.ticker.toUpperCase(),
        entry_price: parseFloat(editForm.entry_price),
        exit_price: parseFloat(editForm.exit_price),
        shares: parseFloat(editForm.shares),
        notes: editForm.notes,
      }
      await fetch('/api/journal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEditId(null)
      await fetchTrades()
    } catch { /* silent */ }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/journal?id=${id}`, { method: 'DELETE' })
    setTrades((prev) => prev.filter((t) => t.id !== id))
  }

  function startEdit(t: Trade) {
    setEditId(t.id)
    setEditForm({
      date: t.date, ticker: t.ticker,
      entry_price: String(t.entry_price), exit_price: String(t.exit_price),
      shares: String(t.shares), notes: t.notes,
    })
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ChevronDown
      size={10}
      className={`inline ml-1 transition-transform ${sortKey === col && sortDir === 'asc' ? 'rotate-180' : ''} ${sortKey === col ? 'text-[#2F80ED]' : 'opacity-30'}`}
    />
  )

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F0F4FF] p-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="text-[#2F80ED]" size={22} />
          <h1 className="text-2xl font-bold font-sans tracking-tight">Trade Journal</h1>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-[#2F80ED] hover:bg-[#4FA3FF] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Log Trade
        </button>
      </div>

      {/* Stats */}
      {trades.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Trades', value: totalTrades.toString(), sub: null, color: '' },
            { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${wins}W / ${totalTrades - wins}L`, color: winRate >= 50 ? 'text-[#00C896]' : 'text-[#FF4D4D]' },
            { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, sub: null, color: totalPnl >= 0 ? 'text-[#00C896]' : 'text-[#FF4D4D]' },
            { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}$${avgPnl.toFixed(2)}`, sub: 'per trade', color: avgPnl >= 0 ? 'text-[#00C896]' : 'text-[#FF4D4D]' },
          ].map((c) => (
            <div key={c.label} className="bg-[#0F1729] border border-[#1E2D4A] rounded p-4" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.08)' }}>
              <p className="text-[#8A99B3] text-xs mb-1">{c.label}</p>
              <p className={`text-xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
              {c.sub && <p className={`text-xs mt-0.5 text-[#8A99B3]`}>{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* AI Coach Panel */}
      {!loading && <CoachPanel tradeCount={trades.length} />}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleSave} className="mb-6 bg-[#0F1729] border border-[#1E2D4A] rounded p-4 space-y-3">
          <h3 className="text-sm font-medium text-[#F0F4FF] mb-3">New Trade Entry</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A99B3]">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A99B3]">Ticker</label>
              <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} placeholder="AAPL" maxLength={10} required
                className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-24 uppercase" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A99B3]">Entry Price ($)</label>
              <input value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })} type="number" step="any" min="0" placeholder="150.00" required
                className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-28" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A99B3]">Exit Price ($)</label>
              <input value={form.exit_price} onChange={(e) => setForm({ ...form, exit_price: e.target.value })} type="number" step="any" min="0" placeholder="160.00" required
                className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-28" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A99B3]">Shares</label>
              <input value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} type="number" step="any" min="0" placeholder="100" required
                className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-24" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A99B3]">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What worked, what didn't, lessons learned..."
              rows={2}
              className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] resize-none w-full max-w-xl" />
          </div>
          {previewPnl(form) !== null && (
            <p className={`text-sm font-medium ${(previewPnl(form) ?? 0) >= 0 ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
              Estimated P&L: {(previewPnl(form) ?? 0) >= 0 ? '+' : ''}${(previewPnl(form) ?? 0).toFixed(2)}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors">
              {saving ? 'Saving...' : 'Save Trade'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-[#8A99B3] hover:text-[#F0F4FF] px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
          {saveError && <p className="text-[#FF4D4D] text-xs">{saveError}</p>}
        </form>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-[#0F1729] rounded animate-pulse" />)}</div>
      ) : error ? (
        <div className="flex items-center gap-2 text-[#FF4D4D] bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 rounded px-4 py-3 text-sm">
          <AlertCircle size={14} />{error}
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-20 text-[#8A99B3]">
          <BookOpen size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-1">No trades logged yet</p>
          <p className="text-sm">Click &quot;Log Trade&quot; to record your first trade</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8A99B3] text-xs uppercase tracking-wider border-b border-[#1E2D4A]">
                <th className="text-left pb-3 pr-3 cursor-pointer hover:text-[#F0F4FF]" onClick={() => toggleSort('date')}>
                  Date <SortIcon col="date" />
                </th>
                <th className="text-left pb-3 pr-3 cursor-pointer hover:text-[#F0F4FF]" onClick={() => toggleSort('ticker')}>
                  Ticker <SortIcon col="ticker" />
                </th>
                <th className="text-right pb-3 pr-3">Entry</th>
                <th className="text-right pb-3 pr-3">Exit</th>
                <th className="text-right pb-3 pr-3">Shares</th>
                <th className="text-right pb-3 pr-3 cursor-pointer hover:text-[#F0F4FF]" onClick={() => toggleSort('pnl')}>
                  P&L <SortIcon col="pnl" />
                </th>
                <th className="text-left pb-3 pr-3 hidden lg:table-cell">Notes</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const up = t.pnl >= 0
                const editing = editId === t.id
                return (
                  <tr key={t.id} className="border-b border-[#1E2D4A]/50 hover:bg-[#0F1729] transition-colors group">
                    <td className="py-3 pr-3 text-[#8A99B3] whitespace-nowrap">
                      {editing ? (
                        <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          className="bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs w-32" />
                      ) : t.date}
                    </td>
                    <td className="py-3 pr-3">
                      {editing ? (
                        <input value={editForm.ticker} onChange={(e) => setEditForm({ ...editForm, ticker: e.target.value.toUpperCase() })}
                          className="bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs w-20 uppercase" />
                      ) : <span className="font-bold text-[#2F80ED]">{t.ticker}</span>}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-[#8A99B3]">
                      {editing ? (
                        <input type="number" step="any" value={editForm.entry_price} onChange={(e) => setEditForm({ ...editForm, entry_price: e.target.value })}
                          className="bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs w-24 text-right" />
                      ) : `$${t.entry_price.toFixed(2)}`}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-[#8A99B3]">
                      {editing ? (
                        <input type="number" step="any" value={editForm.exit_price} onChange={(e) => setEditForm({ ...editForm, exit_price: e.target.value })}
                          className="bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs w-24 text-right" />
                      ) : `$${t.exit_price.toFixed(2)}`}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {editing ? (
                        <input type="number" step="any" value={editForm.shares} onChange={(e) => setEditForm({ ...editForm, shares: e.target.value })}
                          className="bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs w-20 text-right" />
                      ) : t.shares}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className={`flex items-center justify-end gap-1 font-medium tabular-nums ${up ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {up ? '+' : ''}${t.pnl.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-[#8A99B3] text-xs max-w-[200px] truncate hidden lg:table-cell">
                      {editing ? (
                        <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          className="bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs w-48" />
                      ) : t.notes || '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        {editing ? (
                          <button onClick={() => handleEdit(t.id)} className="text-[#00C896] p-1"><Check size={13} /></button>
                        ) : (
                          <button onClick={() => startEdit(t)} className="text-[#8A99B3] hover:text-[#F0F4FF] p-1"><Edit2 size={13} /></button>
                        )}
                        <button onClick={() => handleDelete(t.id)} className="text-[#8A99B3] hover:text-[#FF4D4D] p-1"><X size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
