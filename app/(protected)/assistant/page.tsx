import { createClient } from '@/lib/supabase/server'
import AssistantClient from './AssistantClient'

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, plan, ai_queries_today, ai_queries_reset_date')
    .eq('id', user!.id)
    .single() as {
      data: {
        full_name: string | null
        plan: string | null
        ai_queries_today: number | null
        ai_queries_reset_date: string | null
      } | null
    }

  const today = new Date().toISOString().split('T')[0]
  const queriesUsed =
    profile?.ai_queries_reset_date === today
      ? (profile?.ai_queries_today ?? 0)
      : 0

  return (
    <AssistantClient
      isPro={profile?.plan === 'pro'}
      queriesUsed={queriesUsed}
      userName={profile?.full_name?.split(' ')[0] ?? 'Trader'}
    />
  )
}
