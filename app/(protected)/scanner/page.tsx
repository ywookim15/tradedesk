import dynamic from 'next/dynamic'
import { SkeletonScannerResults } from '@/components/ui/Skeleton'

const ScannerClient = dynamic(() => import('./ScannerClient'), {
  loading: () => (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="skeleton h-8 w-48 mb-6 rounded-[4px]" />
      <SkeletonScannerResults />
    </div>
  ),
})

export default function ScannerPage() {
  return <ScannerClient />
}
