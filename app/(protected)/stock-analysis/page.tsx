import { Suspense } from 'react'
import StockAnalysisClient from './StockAnalysisClient'

export default function StockAnalysisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0F1E]" />}>
      <StockAnalysisClient />
    </Suspense>
  )
}
