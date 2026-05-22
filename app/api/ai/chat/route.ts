import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geminiChatWithHistory } from '@/lib/gemini'
import type { Content } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

const FREE_DAILY_LIMIT = 10

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('[/api/ai/chat] auth check — user:', user?.id ?? 'none', '| authError:', authError?.message ?? 'none')

    if (!user) {
      console.error('[/api/ai/chat] Unauthorized — no session cookie or expired token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Parse body ──────────────────────────────────────────────────────────
    const { message, history = [] } = await req.json() as {
      message: string
      history: Content[]
    }

    console.log('[/api/ai/chat] message length:', message?.length, '| history turns:', history.length)

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // ── 3. Profile lookup ──────────────────────────────────────────────────────
    type ProfileRow = {
      plan: string | null
      ai_queries_today: number | null
      ai_queries_reset_date: string | null
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, ai_queries_today, ai_queries_reset_date')
      .eq('id', user.id)
      .single() as { data: ProfileRow | null; error: unknown }

    console.log('[/api/ai/chat] profile:', profile, '| profileError:', profileError)

    if (profileError || !profile) {
      console.error('[/api/ai/chat] Profile not found for user', user.id)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ── 4. Daily counter reset ─────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]
    let queriesUsed = profile.ai_queries_today ?? 0

    if (profile.ai_queries_reset_date !== today) {
      queriesUsed = 0
      await supabase
        .from('profiles')
        .update({ ai_queries_today: 0, ai_queries_reset_date: today } as never)
        .eq('id', user.id)
    }

    const isPro = profile.plan === 'pro'

    console.log('[/api/ai/chat] isPro:', isPro, '| queriesUsed:', queriesUsed, '| limit:', FREE_DAILY_LIMIT)

    if (!isPro && queriesUsed >= FREE_DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'daily_limit_reached', queriesUsed, queriesLimit: FREE_DAILY_LIMIT },
        { status: 429 },
      )
    }

    // ── 5. Gemini API call ─────────────────────────────────────────────────────
    const geminiKey = process.env.GEMINI_API_KEY
    console.log('[/api/ai/chat] GEMINI_API_KEY present:', !!geminiKey, '| key prefix:', geminiKey?.slice(0, 8) ?? 'missing')

    const response = await geminiChatWithHistory(history, message.trim())

    console.log('[/api/ai/chat] Gemini response length:', response?.length)

    // ── 6. Increment counter ───────────────────────────────────────────────────
    await supabase
      .from('profiles')
      .update({ ai_queries_today: queriesUsed + 1 } as never)
      .eq('id', user.id)

    return NextResponse.json({
      response,
      queriesUsed: queriesUsed + 1,
      queriesLimit: isPro ? null : FREE_DAILY_LIMIT,
    })
  } catch (err) {
    console.error('[/api/ai/chat] CAUGHT ERROR:', err)
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 })
  }
}
