'use client'

import { useState, useEffect } from 'react'
import { isMarketOpen } from '@/lib/utils'

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name}`
  if (h < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

export default function TopBar({ userName }: { userName: string }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const open = isMarketOpen()

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
      <div>
        <h1
          className="text-xl font-bold text-[#F0F4FF]"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          {greeting(userName)}
        </h1>
        <p className="text-xs text-[#8A99B3] mt-0.5">{dateStr}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-[#8A99B3]">{timeStr}</span>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            open
              ? 'bg-[#00C896]/10 border border-[#00C896]/30 text-[#00C896]'
              : 'bg-[#1E2D4A] border border-[#1E2D4A] text-[#8A99B3]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-[#00C896] animate-pulse' : 'bg-[#8A99B3]'}`}
          />
          {open ? 'Market Open' : 'Market Closed'}
        </div>
      </div>
    </div>
  )
}
