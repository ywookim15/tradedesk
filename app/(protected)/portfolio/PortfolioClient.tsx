'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, X, Edit2, Check, TrendingUp, TrendingDown, AlertCircle, Briefcase } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Holding = {
  id: string
  ticker: string
  name: string
  shares: number
  avgBuyPrice: number
  currentPrice: number
  currentValue: number
  costBasis: number
  pnl: number
  pnlPercent: number
}

const CHART_COLORS = [
  '#2F80ED', '#00C896', '#FF4D4D', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

type AddForm = { ticker: string; shares: string; avgBuyPrice: string }

export default function PortfolioClient() {
  const [holdings, setHoldings]   = useState<Holding[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [addForm, setAddForm]     = useState<AddForm>({ ticker: '', shares: '', avgBuyPrice: '' })
  const [adding, setAdding]       = useState(false)
  const [addError, setAddError]   = useState<string | null>(null)
  const [editId, setEditId]       = useState<string | null>(null)
  const [editShares, setEditShares] = useState('')
  const [editPrice, setEditPrice]   = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio')
      if (!res.ok) throw new Error('Failed to load portfolio')
      const data = await res.json() as Holding[]
      setHoldings(data)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPortfolio()
    intervalRef.current = setInterval(fetchPortfolio, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchPortfolio])

  const totalValue    = holdings.reduce((s, h) => s + h.currentValue, 0)
  const totalCost     = holdings.reduce((s, h) => s + h.costBasis, 0)
  const totalPnl      = totalValue - totalCost
  const totalPnlPct   = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  const pieData = holdings.map((h) => ({
    name: h.ticker,
    value: h.currentValue,
  }))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: addForm.ticker.toUpperCase(),
          shares: parseFloat(addForm.shares),
          avg_buy_price: parseFloat(addForm.avgBuyPrice),
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setAddError(data.error ?? 'Failed to add'); return }
      setAddForm({ ticker: '', shares: '', avgBuyPrice: '' })
      setShowAdd(false)
      await fetchPortfolio()
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function handleEdit(h: Holding) {
    try {
      await fetch('/api/portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, shares: parseFloat(editShares), avg_buy_price: parseFloat(editPrice) }),
      })
      setEditId(null)
      await fetchPortfolio()
    } catch { /* silent */ }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    setHoldings((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F0F4FF] p-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="text-[#2F80ED]" size={22} />
          <h1 className="text-2xl font-bold font-sans tracking-tight">Portfolio</h1>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-[#2F80ED] hover:bg-[#4FA3FF] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Add Holding
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 bg-[#0F1729] border border-[#1E2D4A] rounded p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A99B3]">Ticker</label>
            <input
              value={addForm.ticker}
              onChange={(e) => setAddForm({ ...addForm, ticker: e.target.value.toUpperCase() })}
              placeholder="AAPL"
              maxLength={10}
              required
              className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-24 uppercase"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A99B3]">Shares</label>
            <input
              value={addForm.shares}
              onChange={(e) => setAddForm({ ...addForm, shares: e.target.value })}
              placeholder="100"
              type="number"
              step="any"
              min="0.001"
              required
              className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-28"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A99B3]">Avg Buy Price ($)</label>
            <input
              value={addForm.avgBuyPrice}
              onChange={(e) => setAddForm({ ...addForm, avgBuyPrice: e.target.value })}
              placeholder="150.00"
              type="number"
              step="any"
              min="0.001"
              required
              className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#2F80ED] w-32"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="text-[#8A99B3] hover:text-[#F0F4FF] px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          {addError && <p className="w-full text-[#FF4D4D] text-xs mt-1">{addError}</p>}
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-[#0F1729] rounded animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-[#FF4D4D] bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 rounded px-4 py-3 text-sm">
          <AlertCircle size={14} />{error}
        </div>
      ) : holdings.length === 0 ? (
        <div className="text-center py-20 text-[#8A99B3]">
          <Briefcase size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-1">No holdings yet</p>
          <p className="text-sm">Add your first position above</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Value', value: fmt(totalValue), sub: null },
              { label: 'Total Cost', value: fmt(totalCost), sub: null },
              {
                label: 'Unrealized P&L',
                value: `${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`,
                sub: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`,
                color: totalPnl >= 0 ? 'text-[#00C896]' : 'text-[#FF4D4D]',
              },
              { label: 'Holdings', value: holdings.length.toString(), sub: 'positions' },
            ].map((c) => (
              <div key={c.label} className="bg-[#0F1729] border border-[#1E2D4A] rounded p-4" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.08)' }}>
                <p className="text-[#8A99B3] text-xs mb-1">{c.label}</p>
                <p className={`text-xl font-bold tabular-nums ${c.color ?? ''}`}>{c.value}</p>
                {c.sub && <p className={`text-xs mt-0.5 ${c.color ?? 'text-[#8A99B3]'}`}>{c.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Holdings table */}
            <div className="xl:col-span-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#8A99B3] text-xs uppercase tracking-wider border-b border-[#1E2D4A]">
                    <th className="text-left pb-3 pr-3">Ticker</th>
                    <th className="text-right pb-3 pr-3">Shares</th>
                    <th className="text-right pb-3 pr-3">Avg Buy</th>
                    <th className="text-right pb-3 pr-3">Price</th>
                    <th className="text-right pb-3 pr-3">Value</th>
                    <th className="text-right pb-3 pr-3">P&L</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const up = h.pnl >= 0
                    const editing = editId === h.id
                    return (
                      <tr key={h.id} className="border-b border-[#1E2D4A]/50 hover:bg-[#0F1729] transition-colors group">
                        <td className="py-3 pr-3">
                          <div className="font-bold text-[#2F80ED]">{h.ticker}</div>
                          <div className="text-xs text-[#8A99B3] truncate max-w-[120px]">{h.name}</div>
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          {editing ? (
                            <input
                              value={editShares}
                              onChange={(e) => setEditShares(e.target.value)}
                              className="w-20 bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs text-right"
                            />
                          ) : h.shares}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#8A99B3]">
                          {editing ? (
                            <input
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-24 bg-[#0A0F1E] border border-[#2F80ED] rounded px-2 py-0.5 text-xs text-right"
                            />
                          ) : `$${h.avgBuyPrice.toFixed(2)}`}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          ${h.currentPrice.toFixed(2)}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums font-medium">
                          {fmt(h.currentValue)}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <div className={`flex items-center justify-end gap-1 ${up ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            <span className="tabular-nums text-xs">
                              {up ? '+' : ''}{fmt(h.pnl)}<br />
                              <span className="opacity-70">{up ? '+' : ''}{h.pnlPercent.toFixed(2)}%</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            {editing ? (
                              <button onClick={() => handleEdit(h)} className="text-[#00C896] hover:text-[#00C896]/80 p-1">
                                <Check size={13} />
                              </button>
                            ) : (
                              <button onClick={() => { setEditId(h.id); setEditShares(String(h.shares)); setEditPrice(String(h.avgBuyPrice)) }} className="text-[#8A99B3] hover:text-[#F0F4FF] p-1">
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button onClick={() => handleDelete(h.id)} className="text-[#8A99B3] hover:text-[#FF4D4D] p-1">
                              <X size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pie chart */}
            <div className="bg-[#0F1729] border border-[#1E2D4A] rounded p-4" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.08)' }}>
              <h3 className="text-sm font-medium mb-4 text-[#8A99B3]">Allocation</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [fmt(Number(v ?? 0)), 'Value']}
                    contentStyle={{ background: '#0F1729', border: '1px solid #1E2D4A', borderRadius: 4, fontSize: 12 }}
                    labelStyle={{ color: '#F0F4FF' }}
                  />
                  <Legend
                    formatter={(v) => <span style={{ color: '#8A99B3', fontSize: 11 }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-xs text-[#8A99B3] mt-4">Auto-refreshes every 60 seconds · Prices from Yahoo Finance</p>
        </>
      )}
    </div>
  )
}
