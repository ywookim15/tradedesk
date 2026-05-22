import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'

type RawQuote = {
  symbol?: string
  regularMarketPrice?: number
  shortName?: string
  longName?: string
}

type PortfolioRow = {
  id: string; ticker: string; shares: number
  avg_buy_price: number; user_id: string; created_at: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: raw_rows, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    console.error('[/api/portfolio GET] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const holdings = (raw_rows ?? []) as PortfolioRow[]
  if (!holdings.length) return NextResponse.json([])

  try {
    const tickers = holdings.map((h) => h.ticker)
    const raw = await yf.quote(tickers) as unknown as RawQuote | RawQuote[]
    const list = Array.isArray(raw) ? raw : [raw]
    const qMap = Object.fromEntries(list.map((q) => [q.symbol, q]))

    return NextResponse.json(holdings.map((h) => {
      const q = qMap[h.ticker] ?? {}
      const currentPrice = q.regularMarketPrice ?? 0
      const shares = h.shares ?? 0
      const avgBuyPrice = h.avg_buy_price ?? 0
      const currentValue = currentPrice * shares
      const costBasis = avgBuyPrice * shares
      const pnl = currentValue - costBasis
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0

      return {
        id:           h.id,
        ticker:       h.ticker,
        shares,
        avgBuyPrice,
        name:         q.shortName ?? q.longName ?? h.ticker,
        currentPrice,
        currentValue,
        costBasis,
        pnl,
        pnlPercent,
      }
    }))
  } catch (err) {
    console.error('[/api/portfolio GET] Yahoo Finance error:', err)
    return NextResponse.json(holdings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      shares: h.shares,
      avgBuyPrice: h.avg_buy_price,
      name: h.ticker,
      currentPrice: 0,
      currentValue: 0,
      costBasis: h.shares * h.avg_buy_price,
      pnl: 0,
      pnlPercent: 0,
    })))
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, shares, avg_buy_price } = await req.json() as {
    ticker: string; shares: number; avg_buy_price: number
  }

  if (!ticker?.trim()) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })
  if (!shares || shares <= 0) return NextResponse.json({ error: 'Shares must be positive' }, { status: 400 })
  if (!avg_buy_price || avg_buy_price <= 0) return NextResponse.json({ error: 'Buy price must be positive' }, { status: 400 })

  const sym = ticker.trim().toUpperCase()

  const { data, error } = await supabase
    .from('portfolio')
    .insert({ user_id: user.id, ticker: sym, shares, avg_buy_price } as never)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, shares, avg_buy_price } = await req.json() as {
    id: string; shares: number; avg_buy_price: number
  }
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data, error } = await supabase
    .from('portfolio')
    .update({ shares, avg_buy_price } as never)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
