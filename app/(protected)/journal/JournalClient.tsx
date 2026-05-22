'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Edit2, Check, BookOpen, TrendingUp, TrendingDown, AlertCircle, ChevronDown } from 'lucide-react'

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
          <p className="text-sm">Click "Log Trade" to record your first trade</p>
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
