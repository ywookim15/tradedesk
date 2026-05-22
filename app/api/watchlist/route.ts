import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'

type RawQuote = {
  symbol?: string; shortName?: string; longName?: string
  regularMarketPrice?: number; regularMarketChange?: number
  regularMarketChangePercent?: number; regularMarketVolume?: number; marketCap?: number
}

type WatchlistRow = { id: string; ticker: string; added_at: string; user_id: string }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: raw_rows, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const items = (raw_rows ?? []) as WatchlistRow[]
  if (!items.length) return NextResponse.json([])

  try {
    const tickers = items.map((i) => i.ticker)
    const raw     = await yf.quote(tickers) as unknown as RawQuote | RawQuote[]
    const list    = Array.isArray(raw) ? raw : [raw]
    const qMap    = Object.fromEntries(list.map((q) => [q.symbol, q]))

    return NextResponse.json(items.map((item) => {
      const q = qMap[item.ticker] ?? {}
      return {
        id:            item.id,
        ticker:        item.ticker,
        added_at:      item.added_at,
        name:          q.shortName ?? q.longName ?? item.ticker,
        price:         q.regularMarketPrice         ?? 0,
        change:        q.regularMarketChange        ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume:        q.regularMarketVolume        ?? 0,
        marketCap:     q.marketCap                  ?? 0,
      }
    }))
  } catch {
    return NextResponse.json(items.map((item) => ({
      id: item.id, ticker: item.ticker, added_at: item.added_at,
      name: item.ticker, price: 0, change: 0, changePercent: 0, volume: 0, marketCap: 0,
    })))
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await req.json() as { ticker: string }
  if (!ticker?.trim()) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })
  const sym = ticker.trim().toUpperCase()

  // Free plan limit
  type ProfileRow = { plan: string | null }
  const { data: profile } = await supabase
    .from('profiles').select('plan').eq('id', user.id).single() as { data: ProfileRow | null; error: unknown }

  if (profile?.plan !== 'pro') {
    const { count } = await supabase
      .from('watchlist').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= 10) return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 })
  }

  // Duplicate check
  const { data: dup } = await supabase
    .from('watchlist').select('id').eq('user_id', user.id).eq('ticker', sym).maybeSingle()
  if (dup) return NextResponse.json({ error: 'Already in watchlist' }, { status: 409 })

  const { data, error } = await supabase
    .from('watchlist').insert({ user_id: user.id, ticker: sym } as never).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabase
    .from('watchlist').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
