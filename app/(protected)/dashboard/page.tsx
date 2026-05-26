import { createClient } from '@/lib/supabase/server'
import TopBar            from '@/components/dashboard/TopBar'
import MarketIndices     from '@/components/dashboard/MarketIndices'
import TopMovers         from '@/components/dashboard/TopMovers'
import SectorHeatmap     from '@/components/dashboard/SectorHeatmap'
import WatchlistSnapshot from '@/components/dashboard/WatchlistSnapshot'
import AIBriefWidget     from '@/components/dashboard/AIBriefWidget'
import MorningBriefing   from '@/components/dashboard/MorningBriefing'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single() as { data: { full_name: string | null } | null; error: unknown }

  const userName = profile?.full_name?.split(' ')[0] ?? 'Trader'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Top greeting bar */}
      <TopBar userName={userName} />

      {/* Morning briefing — market mood, watchlist alerts, stock of day */}
      <MorningBriefing />

      {/* Market indices row */}
      <MarketIndices />

      {/* Top movers + watchlist side-by-side */}
      <div className="grid lg:grid-cols-3 gap-4 mb-0">
        <div className="lg:col-span-2">
          <TopMovers />
        </div>
        <div>
          <WatchlistSnapshot />
        </div>
      </div>

      {/* Sector heatmap */}
      <SectorHeatmap />

      {/* AI brief CTA */}
      <AIBriefWidget />
    </div>
  )
}
