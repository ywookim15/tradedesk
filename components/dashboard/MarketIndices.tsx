'use client'

import { useState, useEffect, useRef } from 'react'
import { formatNumber, formatPercent } from '@/lib/utils'

interface IndexData {
  symbol: string
  name: string
  short: string
  value: number
  change: number
  changePercent: number
  sparkline: number[]
  error?: boolean
}

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    if (!target) return
    const start    = prev.current
    const startTs  = performance.now()

    function tick(ts: number) {
      const t       = Math.min((ts - startTs) / duration, 1)
      const eased   = 1 - Math.pow(1 - t, 3)
      const current = start + (target - start) * eased
      setVal(current)
      if (t < 1) requestAnimationFrame(tick)
      else prev.current = target
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return val
}

function Sparkline({ prices, positive }: { prices: number[]; positive: boolean }) {
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const W = 80, H = 28

  const d = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * W
      const y = H - ((p - min) / range) * H
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const fill = `${d} L${W},${H} L0,${H} Z`
  const color = positive ? '#00C896' : '#FF4D4D'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${positive})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function Skeleton() {
  return (
    <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-4 animate-pulse">
      <div className="h-3 w-16 bg-[#1E2D4A] rounded mb-3" />
      <div className="h-6 w-24 bg-[#1E2D4A] rounded mb-2" />
      <div className="h-3 w-12 bg-[#1E2D4A] rounded" />
    </div>
  )
}

function IndexCard({ data, delay }: { data: IndexData; delay: number }) {
  const positive = data.changePercent >= 0
  const animatedValue = useCountUp(data.value)

  return (
    <div
      className="bg-[#0F1729] border border-[#1E2D4A] hover:border-[#2F80ED]/30 rounded-[6px] p-4 transition-all"
      style={{
        animation: `fadeUp 0.4s ease both`,
        animationDelay: `${delay}ms`,
        boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.05)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] text-[#8A99B3] uppercase tracking-widest">{data.short}</p>
          <p className="text-[#8A99B3] text-xs">{data.name}</p>
        </div>
        <Sparkline prices={data.sparkline} positive={positive} />
      </div>

      <p
        className="text-2xl font-bold text-[#F0F4FF] mb-1"
        style={{ fontFamily: 'var(--font-syne)' }}
      >
        {['^VIX', 'CL=F'].includes(data.symbol)
          ? animatedValue.toFixed(2)
          : formatNumber(animatedValue, 2)}
      </p>

      <div className="flex items-center gap-2">
        <span
          className="text-sm font-semibold"
          style={{ color: positive ? '#00C896' : '#FF4D4D' }}
        >
          {formatPercent(data.changePercent)}
        </span>
        <span className="text-xs text-[#8A99B3]">
          {positive ? '+' : ''}{formatNumber(data.change, 2)} today
        </span>
      </div>
    </div>
  )
}

export default function MarketIndices() {
  const [data, setData] = useState<IndexData[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/market/indices')
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : null))
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-4 text-[#8A99B3] text-sm">
        Market data unavailable — check your network connection.
      </div>
    )
  }

  if (!data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
      {data.map((idx, i) => (
        <IndexCard key={idx.symbol} data={idx} delay={i * 80} />
      ))}
    </div>
  )
}
