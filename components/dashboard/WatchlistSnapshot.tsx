'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, Plus } from 'lucide-react'
import { formatPercent } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface WatchItem {
  ticker:        string
  price:         number
  change:        number
  changePercent: number
}

export default function WatchlistSnapshot() {
  const router = useRouter()
  const [items, setItems] = useState<WatchItem[] | null>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: rows } = await supabase
        .from('watchlist')
        .select('ticker')
        .eq('user_id', user.id)
        .order('added_at')
        .limit(5)

      if (!rows || rows.length === 0) { setEmpty(true); return }

      const tickers = rows.map((r: { ticker: string }) => r.ticker).join(',')
      const res = await fetch(`/api/stock/quotes?symbols=${tickers}`)
      if (!res.ok) { setEmpty(true); return }
      const quotes = await res.json()
      setItems(quotes)
    }

    load()
  }, [])

  return (
    <div
      className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] overflow-hidden h-full"
      style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '200ms', boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.05)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2D4A]">
        <div className="flex items-center gap-2">
          <Eye size={13} className="text-[#2F80ED]" />
          <span className="text-[11px] font-semibold text-[#F0F4FF] uppercase tracking-wider">Watchlist</span>
        </div>
        <Link href="/watchlist" className="text-[10px] text-[#2F80ED] hover:text-[#4FA3FF] transition-colors">
          View all →
        </Link>
      </div>

      <div className="flex flex-col">
        {/* Loading */}
        {!items && !empty && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
              <div className="h-3 w-12 bg-[#1E2D4A] rounded" />
              <div className="h-3 w-16 bg-[#1E2D4A] rounded" />
            </div>
          ))
        )}

        {/* Empty state */}
        {empty && (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
            <Eye size={24} className="text-[#1E2D4A]" />
            <p className="text-xs text-[#8A99B3]">No stocks in your watchlist yet.</p>
            <button
              onClick={() => router.push('/watchlist')}
              className="flex items-center gap-1.5 text-xs text-[#2F80ED] hover:text-[#4FA3FF] transition-colors"
            >
              <Plus size={12} />
              Add your first stock
            </button>
          </div>
        )}

        {/* Items */}
        {items?.map((item) => {
          const positive = item.changePercent >= 0
          return (
            <button
              key={item.ticker}
              onClick={() => router.push(`/technical?ticker=${item.ticker}`)}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1E2D4A]/50 transition-colors text-left border-b border-[#1E2D4A]/40 last:border-0"
            >
              <span className="text-xs font-bold text-[#F0F4FF] hover:text-[#2F80ED] transition-colors">
                {item.ticker}
              </span>
              <div className="text-right">
                <p className="text-xs text-[#F0F4FF]">${item.price.toFixed(2)}</p>
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: positive ? '#00C896' : '#FF4D4D' }}
                >
                  {formatPercent(item.changePercent)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
