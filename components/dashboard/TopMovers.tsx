'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Mover {
  symbol:        string
  name:          string
  price:         number
  change:        number
  changePercent: number
}

function MoverRow({ m, delay }: { m: Mover; delay: number }) {
  const router   = useRouter()
  const positive = m.changePercent >= 0

  return (
    <button
      onClick={() => router.push(`/stock-analysis?ticker=${m.symbol}`)}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-[4px] hover:bg-[#1E2D4A]/50 transition-colors group text-left"
      style={{ animation: 'fadeUp 0.35s ease both', animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-7 h-7 rounded-[3px] flex items-center justify-center shrink-0 text-[10px] font-bold"
          style={{
            backgroundColor: positive ? 'rgba(0,200,150,0.12)' : 'rgba(255,77,77,0.12)',
            color:            positive ? '#00C896' : '#FF4D4D',
          }}
        >
          {m.symbol.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#F0F4FF] group-hover:text-[#2F80ED] transition-colors">
            {m.symbol}
          </p>
          <p className="text-[10px] text-[#8A99B3] truncate max-w-[110px]">{m.name}</p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-[#F0F4FF]">${m.price.toFixed(2)}</p>
        <p
          className="text-[11px] font-semibold"
          style={{ color: positive ? '#00C896' : '#FF4D4D' }}
        >
          {formatPercent(m.changePercent)}
        </p>
      </div>
    </button>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 animate-pulse">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-[#1E2D4A] rounded-[3px]" />
        <div>
          <div className="h-2.5 w-10 bg-[#1E2D4A] rounded mb-1.5" />
          <div className="h-2 w-20 bg-[#1E2D4A] rounded" />
        </div>
      </div>
      <div className="text-right">
        <div className="h-2.5 w-12 bg-[#1E2D4A] rounded mb-1.5" />
        <div className="h-2 w-8 bg-[#1E2D4A] rounded" />
      </div>
    </div>
  )
}

export default function TopMovers() {
  const [gainers, setGainers] = useState<Mover[] | null>(null)
  const [losers,  setLosers]  = useState<Mover[] | null>(null)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    fetch('/api/market/movers')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(true); return }
        setGainers(d.gainers)
        setLosers(d.losers)
      })
      .catch(() => setError(true))
  }, [])

  const loading = !gainers && !error

  return (
    <div
      className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] overflow-hidden"
      style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '240ms', boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.05)' }}
    >
      <div className="grid grid-cols-2 divide-x divide-[#1E2D4A]">
        {/* Gainers */}
        <div>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E2D4A]">
            <TrendingUp size={13} className="text-[#00C896]" />
            <span className="text-[11px] font-semibold text-[#00C896] uppercase tracking-wider">Top Gainers</span>
          </div>
          <div className="py-1">
            {loading
              ? [0,1,2,3,4].map((i) => <SkeletonRow key={i} />)
              : error
              ? <p className="text-xs text-[#8A99B3] px-4 py-3">Unavailable</p>
              : gainers?.map((m, i) => <MoverRow key={m.symbol} m={m} delay={i * 60} />)
            }
          </div>
        </div>

        {/* Losers */}
        <div>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E2D4A]">
            <TrendingDown size={13} className="text-[#FF4D4D]" />
            <span className="text-[11px] font-semibold text-[#FF4D4D] uppercase tracking-wider">Top Losers</span>
          </div>
          <div className="py-1">
            {loading
              ? [0,1,2,3,4].map((i) => <SkeletonRow key={i} />)
              : error
              ? <p className="text-xs text-[#8A99B3] px-4 py-3">Unavailable</p>
              : losers?.map((m, i) => <MoverRow key={m.symbol} m={m} delay={i * 60 + 300} />)
            }
          </div>
        </div>
      </div>
    </div>
  )
}
