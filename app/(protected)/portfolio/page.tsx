import dynamic from 'next/dynamic'
import { SkeletonPortfolioStats, SkeletonTable } from '@/components/ui/Skeleton'

const PortfolioClient = dynamic(() => import('./PortfolioClient'), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="skeleton h-7 w-44 mb-6 rounded-[4px]" />
      <SkeletonPortfolioStats />
      <SkeletonTable rows={5} cols={6} />
    </div>
  ),
})

export default function PortfolioPage() {
  return <PortfolioClient />
}
