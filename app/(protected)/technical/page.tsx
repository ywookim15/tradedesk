import { Suspense } from 'react'
import TechnicalClient from './TechnicalClient'

export default function TechnicalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0F1E]" />}>
      <TechnicalClient />
    </Suspense>
  )
}
