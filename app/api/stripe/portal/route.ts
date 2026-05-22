import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id

  if (!customerId) {
    return NextResponse.json({ error: 'No Stripe customer found. Please upgrade to Pro first.' }, { status: 404 })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[/api/stripe/portal]', err)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
