/**
 * Lazy-loaded Stock Analysis page.
 * Wraps StockAnalysisClient in Suspense + dynamic import for code splitting.
 */
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { SkeletonChart, SkeletonCard } from '@/components/ui/Skeleton'

function StockAnalysisFallback() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="skeleton h-7 w-56 rounded-[4px]" />
      <SkeletonChart height={380} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}

const StockAnalysisClient = dynamic(() => import('./StockAnalysisClient'), {
  loading: StockAnalysisFallback,
})

export default function StockAnalysisPage() {
  return (
    <Suspense fallback={<StockAnalysisFallback />}>
      <StockAnalysisClient />
    </Suspense>
  )
}
