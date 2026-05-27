/**
 * Skeleton loader components — shimmer placeholders that match content shapes.
 * Use these everywhere a spinner previously appeared.
 */

import { cn } from '@/lib/utils'

// ── Primitive ─────────────────────────────────────────────────────────────────

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />
}

// ── Pre-built shapes ──────────────────────────────────────────────────────────

/** A single text line */
export function SkeletonLine({
  width = '100%',
  height = 14,
  className,
}: {
  width?: string | number
  height?: number
  className?: string
}) {
  return (
    <Skeleton
      className={cn('rounded-[3px]', className)}
      style={{ width, height }}
    />
  )
}

/** A data card shell */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-4 space-y-3',
        className,
      )}
    >
      <SkeletonLine width="55%" height={16} />
      <SkeletonLine height={12} />
      <SkeletonLine width="75%" height={12} />
    </div>
  )
}

/** Market index card skeleton */
export function SkeletonIndexCard() {
  return (
    <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-4">
      <SkeletonLine width="40%" height={11} className="mb-3" />
      <SkeletonLine width="65%" height={26} className="mb-2" />
      <SkeletonLine width="45%" height={12} className="mb-3" />
      {/* Sparkline placeholder */}
      <Skeleton className="w-full rounded-[3px]" style={{ height: 32 }} />
    </div>
  )
}

/** Table row skeleton */
export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-[#1E2D4A]/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <SkeletonLine width={i === 0 ? '60%' : i === cols - 1 ? '40%' : '80%'} height={13} />
        </td>
      ))}
    </tr>
  )
}

/** Full table skeleton with header + N rows */
export function SkeletonTable({
  rows = 5,
  cols = 6,
  headers,
}: {
  rows?: number
  cols?: number
  headers?: string[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#1E2D4A]">
            {(headers ?? Array.from({ length: cols }, (_, i) => `col-${i}`)).map((h, i) => (
              <th key={i} className="pb-2 pr-4 text-left">
                <SkeletonLine width={h.length ? `${Math.min(h.length * 7, 80)}px` : '60px'} height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Chart area skeleton */
export function SkeletonChart({ height = 380 }: { height?: number }) {
  return (
    <div
      className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] overflow-hidden relative"
      style={{ height }}
    >
      <Skeleton className="w-full h-full rounded-none" />
      {/* Fake axis lines */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
        {[0.2, 0.4, 0.6, 0.8].map((pos) => (
          <div
            key={pos}
            className="w-full h-px"
            style={{ backgroundColor: 'rgba(30,45,74,0.6)' }}
          />
        ))}
      </div>
    </div>
  )
}

/** Portfolio summary stats skeleton */
export function SkeletonPortfolioStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] px-4 py-3">
          <SkeletonLine width="50%" height={10} className="mb-2" />
          <SkeletonLine width="70%" height={22} />
        </div>
      ))}
    </div>
  )
}

/** Watchlist row skeleton */
export function SkeletonWatchlistRow() {
  return (
    <tr className="border-b border-[#1E2D4A]/50">
      <td className="py-3 pr-3"><SkeletonLine width={48} height={14} /></td>
      <td className="py-3 pr-3"><SkeletonLine width={110} height={12} /></td>
      <td className="py-3 pr-3"><SkeletonLine width={64} height={14} /></td>
      <td className="py-3 pr-3"><SkeletonLine width={56} height={14} /></td>
      <td className="py-3 pr-3"><SkeletonLine width={72} height={12} /></td>
      <td className="py-3"><SkeletonLine width={80} height={12} /></td>
    </tr>
  )
}

/** Scanner results skeleton */
export function SkeletonScannerResults() {
  return (
    <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-5">
      <SkeletonLine width="35%" height={16} className="mb-5" />
      <SkeletonTable rows={4} cols={6} />
    </div>
  )
}
