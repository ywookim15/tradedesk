'use client'

import { useState, useEffect } from 'react'

interface SectorData {
  symbol:        string
  name:          string
  changePercent: number
  price:         number
}

function sectorColor(pct: number): string {
  const MAX   = 2.5
  const norm  = Math.min(Math.abs(pct) / MAX, 1)
  const base  = 0.08
  const alpha = base + norm * 0.38

  return pct >= 0
    ? `rgba(0,200,150,${alpha})`
    : `rgba(255,77,77,${alpha})`
}

function sectorTextColor(pct: number, magnitude: number): string {
  if (magnitude < 0.5) return '#8A99B3'
  return pct >= 0 ? '#00C896' : '#FF4D4D'
}

export default function SectorHeatmap() {
  const [data,  setData]  = useState<SectorData[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/market/sectors')
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : null))
      .catch(() => setError(true))
  }, [])

  return (
    <div
      className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-4 mt-4"
      style={{ animation: 'fadeUp 0.4s ease both', animationDelay: '320ms', boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.05)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-sm font-semibold text-[#F0F4FF]"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          S&P 500 Sectors
        </h2>
        <span className="text-[10px] text-[#8A99B3] uppercase tracking-widest">Today</span>
      </div>

      {error && (
        <p className="text-xs text-[#8A99B3]">Sector data unavailable.</p>
      )}

      {!data && !error && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#1E2D4A] rounded-[4px] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {data.map((s, i) => {
            const absPct = Math.abs(s.changePercent)
            return (
              <div
                key={s.symbol}
                className="rounded-[4px] p-2.5 flex flex-col justify-between h-16 border border-transparent transition-all hover:border-[#1E2D4A] cursor-default"
                style={{
                  backgroundColor: sectorColor(s.changePercent),
                  animation: `fadeUp 0.35s ease both`,
                  animationDelay: `${i * 40 + 360}ms`,
                }}
              >
                <p className="text-[10px] text-[#8A99B3] leading-tight">{s.name}</p>
                <p
                  className="text-xs font-bold"
                  style={{ color: sectorTextColor(s.changePercent, absPct) }}
                >
                  {s.changePercent >= 0 ? '+' : ''}
                  {s.changePercent.toFixed(2)}%
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
