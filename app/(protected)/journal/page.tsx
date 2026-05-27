import dynamic from 'next/dynamic'
import { SkeletonTable } from '@/components/ui/Skeleton'

const JournalClient = dynamic(() => import('./JournalClient'), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="skeleton h-7 w-40 mb-6 rounded-[4px]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-4">
            <div className="skeleton h-3 w-24 mb-2 rounded-[3px]" />
            <div className="skeleton h-6 w-16 rounded-[3px]" />
          </div>
        ))}
      </div>
      <SkeletonTable rows={5} cols={7} />
    </div>
  ),
})

export default function JournalPage() {
  return <JournalClient />
}
