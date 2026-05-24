'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, AlertCircle, Star } from 'lucide-react'

type WatchlistItem = {
  id: string
  ticker: string
  added_at: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
}

function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return n.toLocaleString()
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toString()
}

export default function WatchlistClient() {
  const router = useRouter()
  const [items, setItems]       = useState<WatchlistItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [addInput, setAddInput] = useState('')
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWatchlist = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/watchlist')
      if (!res.ok) throw new Error('Failed to load watchlist')
      const data = await res.json() as WatchlistItem[]
      setItems(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchWatchlist()
    intervalRef.current = setInterval(() => fetchWatchlist(true), 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchWatchlist])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addInput.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: addInput.trim().toUpperCase() }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        if (data.error === 'free_limit_reached') {
          setAddError('Free plan limit: 10 stocks. Upgrade to Pro for unlimited.')
        } else {
          setAddError(data.error ?? 'Failed to add ticker')
        }
        return
      }
      setAddInput('')
      await fetchWatchlist(true)
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      // silent
    }
  }

  function handleRowClick(ticker: string) {
    router.push(`/stock-analysis?ticker=${ticker}`)
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F0F4FF] p-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Star className="text-[#2F80ED]" size={22} />
          <h1 className="text-2xl font-bold font-sans tracking-tight">Watchlist</h1>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[#8A99B3] text-xs hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchWatchlist(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[#8A99B3] hover:text-[#F0F4FF] text-xs px-3 py-1.5 border border-[#1E2D4A] rounded hover:border-[#2F80ED] transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="mb-6 flex gap-2">
        <input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. AAPL)"
          maxLength={10}
          className="flex-1 max-w-xs bg-[#0F1729] border border-[#1E2D4A] rounded px-4 py-2 text-sm focus:outline-none focus:border-[#2F80ED] placeholder-[#8A99B3] uppercase"
        />
        <button
          type="submit"
          disabled={adding || !addInput.trim()}
          className="flex items-center gap-2 bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>

      {addError && (
        <div className="mb-4 flex items-center gap-2 text-[#FF4D4D] text-sm bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 rounded px-4 py-2">
          <AlertCircle size={14} />
          {addError}
          {addError.includes('Upgrade') && (
            <button
              onClick={() => router.push('/pricing')}
              className="ml-auto text-[#2F80ED] hover:underline text-xs"
            >
              Upgrade →
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-[#0F1729] rounded animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-[#FF4D4D] bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 rounded px-4 py-3 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-[#8A99B3]">
          <Star size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-1">Your watchlist is empty</p>
          <p className="text-sm">Add a ticker above to start tracking stocks</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8A99B3] text-xs uppercase tracking-wider border-b border-[#1E2D4A]">
                <th className="text-left pb-3 pr-4">Ticker</th>
                <th className="text-left pb-3 pr-4">Name</th>
                <th className="text-right pb-3 pr-4">Price</th>
                <th className="text-right pb-3 pr-4">Change</th>
                <th className="text-right pb-3 pr-4 hidden md:table-cell">Volume</th>
                <th className="text-right pb-3 pr-4 hidden lg:table-cell">Market Cap</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const up = item.change >= 0
                return (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item.ticker)}
                    className="border-b border-[#1E2D4A]/50 hover:bg-[#0F1729] cursor-pointer transition-colors group"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="py-4 pr-4">
                      <span className="font-bold text-[#2F80ED] group-hover:text-[#4FA3FF] transition-colors">
                        {item.ticker}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-[#8A99B3] max-w-[200px] truncate">
                      {item.name}
                    </td>
                    <td className="py-4 pr-4 text-right font-medium tabular-nums">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className={`flex items-center justify-end gap-1 ${up ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        <span className="tabular-nums">
                          {up ? '+' : ''}{item.change.toFixed(2)} ({up ? '+' : ''}{item.changePercent.toFixed(2)}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right text-[#8A99B3] tabular-nums hidden md:table-cell">
                      {fmtVol(item.volume)}
                    </td>
                    <td className="py-4 pr-4 text-right text-[#8A99B3] tabular-nums hidden lg:table-cell">
                      {item.marketCap ? fmt(item.marketCap) : '—'}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(item.id) }}
                        className="text-[#8A99B3] hover:text-[#FF4D4D] transition-colors opacity-0 group-hover:opacity-100 p-1"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p className="text-xs text-[#8A99B3] mt-4">
            {items.length} stock{items.length !== 1 ? 's' : ''} · Auto-refreshes every 60 seconds · Click a row to open Technical Analysis
          </p>
        </div>
      )}
    </div>
  )
}
