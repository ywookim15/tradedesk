import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('journal')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    date: string; ticker: string; entry_price: number
    exit_price: number; shares: number; notes?: string
  }

  const { date, ticker, entry_price, exit_price, shares, notes } = body
  if (!date || !ticker?.trim()) return NextResponse.json({ error: 'Date and ticker required' }, { status: 400 })
  if (!shares || shares <= 0) return NextResponse.json({ error: 'Shares must be positive' }, { status: 400 })

  const sym = ticker.trim().toUpperCase()
  const pnl = (exit_price - entry_price) * shares

  const { data, error } = await supabase
    .from('journal')
    .insert({
      user_id: user.id,
      date,
      ticker: sym,
      entry_price,
      exit_price,
      shares,
      pnl,
      notes: notes ?? '',
    } as never)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    id: string; date: string; ticker: string; entry_price: number
    exit_price: number; shares: number; notes?: string
  }

  const { id, date, ticker, entry_price, exit_price, shares, notes } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const sym = ticker.trim().toUpperCase()
  const pnl = (exit_price - entry_price) * shares

  const { data, error } = await supabase
    .from('journal')
    .update({ date, ticker: sym, entry_price, exit_price, shares, pnl, notes: notes ?? '' } as never)
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
    .from('journal')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
