'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, TrendingUp, TrendingDown, Zap, Star, RefreshCw, ChevronRight } from 'lucide-react'
import type { BriefingData } from '@/app/api/market/briefing/route'

function timeLabel(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function pctColor(v: number) { return v >= 0 ? '#00C896' : '#FF4D4D' }
function pctSign(v: number) { return v >= 0 ? '+' : '' }

export default function MorningBriefing() {
  const router = useRouter()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/market/briefing')
      if (res.ok) setData(await res.json() as BriefingData)
    } catch { /* silent — briefing is non-critical */ }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5 mb-5 animate-pulse">
        <div className="h-4 w-40 bg-[#1E2D4A] rounded mb-3" />
        <div className="h-3 w-full bg-[#1E2D4A] rounded mb-2" />
        <div className="h-3 w-3/4 bg-[#1E2D4A] rounded" />
      </div>
    )
  }

  if (!data) return null

  const hasAlerts    = data.alerts.length > 0
  const hasStockOfDay = data.stockOfDay != null

  return (
    <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] overflow-hidden mb-5">

      {/* Top bar — market mood */}
      <div className="px-5 py-4 border-b border-[#1E2D4A]"
        style={{ background: `linear-gradient(135deg, ${data.moodColor}08 0%, transparent 60%)` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: `${data.moodColor}15`, border: `1px solid ${data.moodColor}30` }}>
              <Sun size={17} style={{ color: data.moodColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">Morning Briefing</p>
                <span className="text-[9px] text-[#8A99B3]">· updated {timeLabel(data.generatedAt)}</span>
              </div>
              <p className="text-sm font-bold" style={{ color: data.moodColor, fontFamily: 'var(--font-syne)' }}>
                {data.moodLabel}
              </p>
              <p className="text-xs text-[#8A99B3] leading-relaxed mt-0.5 max-w-xl">
                {data.moodDescription}
              </p>
            </div>
          </div>

          {/* Index mini-pills */}
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {data.indices
              .filter(idx => ['SPY', 'QQQ', '^VIX'].includes(idx.symbol))
              .map(idx => (
                <div key={idx.symbol}
                  className="text-right px-2 py-1 rounded-[4px] border"
                  style={{ borderColor: '#1E2D4A', backgroundColor: '#0A0F1E' }}>
                  <p className="text-[9px] text-[#8A99B3]">{idx.symbol === '^VIX' ? 'VIX' : idx.symbol}</p>
                  <p className="text-xs font-bold tabular-nums" style={{ color: pctColor(idx.changePercent) }}>
                    {pctSign(idx.changePercent)}{idx.changePercent.toFixed(2)}%
                  </p>
                </div>
              ))}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-1.5 rounded-[4px] border border-[#1E2D4A] text-[#8A99B3] hover:text-[#F0F4FF] hover:bg-[#1E2D4A] transition-colors"
              title="Refresh briefing"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Stock of Day + Watchlist Alerts */}
      {(hasStockOfDay || hasAlerts) && (
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[#1E2D4A]">

          {/* Stock of Day */}
          {hasStockOfDay && data.stockOfDay && (
            <button
              onClick={() => router.push(`/stock-analysis?ticker=${data.stockOfDay!.ticker}`)}
              className="flex-1 px-5 py-4 text-left hover:bg-[#1E2D4A]/30 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <Star size={12} className="text-[#F59E0B]" />
                <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">Stock of the Day</p>
                <span className="text-[9px] text-[#8A99B3]">· from your watchlist</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#2F80ED]" style={{ fontFamily: 'var(--font-syne)' }}>
                      {data.stockOfDay.ticker}
                    </span>
                    <span className="text-xs font-semibold tabular-nums"
                      style={{ color: pctColor(data.stockOfDay.changePercent) }}>
                      {pctSign(data.stockOfDay.changePercent)}{data.stockOfDay.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8A99B3] truncate">{data.stockOfDay.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {data.stockOfDay.reasons.map((r, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-[3px]"
                        style={{ backgroundColor: '#F59E0B10', border: '1px solid #F59E0B25', color: '#F59E0B' }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold text-[#F0F4FF] tabular-nums">
                    ${data.stockOfDay.price.toFixed(2)}
                  </span>
                  <ChevronRight size={13} className="text-[#8A99B3] group-hover:text-[#2F80ED] transition-colors" />
                </div>
              </div>
            </button>
          )}

          {/* Watchlist alerts */}
          {hasAlerts && (
            <div className="flex-1 px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={12} className="text-[#2F80ED]" />
                <p className="text-[9px] text-[#8A99B3] uppercase tracking-widest font-medium">
                  Watchlist Alerts
                </p>
                <span className="text-[9px] bg-[#2F80ED]/15 text-[#2F80ED] px-1.5 py-0.5 rounded-full font-semibold">
                  {data.alerts.length}
                </span>
              </div>
              <div className="space-y-2">
                {data.alerts.slice(0, 3).map(alert => (
                  <button
                    key={alert.ticker}
                    onClick={() => router.push(`/stock-analysis?ticker=${alert.ticker}`)}
                    className="w-full flex items-center justify-between gap-3 hover:bg-[#1E2D4A]/30 rounded-[4px] px-2 py-1.5 -mx-2 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {alert.changePercent >= 0
                        ? <TrendingUp size={11} className="text-[#00C896] shrink-0" />
                        : <TrendingDown size={11} className="text-[#FF4D4D] shrink-0" />
                      }
                      <span className="text-xs font-bold text-[#2F80ED]">{alert.ticker}</span>
                      <span className="text-[10px] text-[#8A99B3] truncate">
                        {alert.reasons.join(' · ')}
                      </span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums shrink-0"
                      style={{ color: pctColor(alert.changePercent) }}>
                      {pctSign(alert.changePercent)}{alert.changePercent.toFixed(2)}%
                    </span>
                  </button>
                ))}
                {data.alerts.length > 3 && (
                  <p className="text-[10px] text-[#8A99B3] text-center mt-1">
                    +{data.alerts.length - 3} more in your watchlist
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state when watchlist is empty */}
      {!hasAlerts && !hasStockOfDay && (
        <div className="px-5 py-4 text-center">
          <p className="text-[#8A99B3] text-xs">
            Add stocks to your{' '}
            <button onClick={() => router.push('/watchlist')}
              className="text-[#2F80ED] hover:underline">watchlist</button>
            {' '}to see personalized alerts here.
          </p>
        </div>
      )}
    </div>
  )
}
