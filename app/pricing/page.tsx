'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Zap, Star, ArrowLeft } from 'lucide-react'

const FREE_FEATURES = [
  'Full platform access',
  '10 AI assistant queries per day',
  'Watchlist: up to 10 stocks',
  'All technical analysis tools',
  'All fundamental analysis tools',
  'Trade journal & portfolio tracker',
  'Voice assistant (within daily limit)',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited AI assistant queries',
  'Unlimited watchlist stocks',
  'Priority response speed',
  'Early access to new features',
  'Advanced Monte Carlo simulations',
  'Priority support',
]

export default function PricingPage() {
  const router      = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const monthlyId = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID
  const annualId  = process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID

  async function handleUpgrade() {
    const priceId = billing === 'monthly' ? monthlyId : annualId
    if (!priceId) {
      alert('Stripe price IDs not configured yet. Please add NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID and NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID to your environment variables.')
      return
    }
    setLoading(billing)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok || !data.url) {
        alert(data.error ?? 'Failed to start checkout')
        return
      }
      window.location.href = data.url
    } catch {
      alert('Network error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F0F4FF] font-mono">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1E2D4A]">
        <Link href="/" className="text-lg font-bold font-sans text-[#2F80ED] tracking-tight">TradeDesk</Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-[#8A99B3] hover:text-[#F0F4FF] transition-colors">Dashboard</Link>
          <Link href="/login" className="text-sm text-[#8A99B3] hover:text-[#F0F4FF] transition-colors">Login</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#8A99B3] hover:text-[#F0F4FF] mb-10 transition-colors">
          <ArrowLeft size={12} /> Back to home
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-sans tracking-tight mb-3">Simple, Transparent Pricing</h1>
          <p className="text-[#8A99B3] max-w-xl mx-auto">
            Start free. Upgrade when you need unlimited AI power and more.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2 mt-8">
            <span className={`text-sm ${billing === 'monthly' ? 'text-[#F0F4FF]' : 'text-[#8A99B3]'}`}>Monthly</span>
            <button
              onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
              className={`relative w-12 h-6 rounded-full transition-colors ${billing === 'annual' ? 'bg-[#2F80ED]' : 'bg-[#1E2D4A]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${billing === 'annual' ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm ${billing === 'annual' ? 'text-[#F0F4FF]' : 'text-[#8A99B3]'}`}>
              Annual
              <span className="ml-1.5 text-xs bg-[#00C896]/15 text-[#00C896] px-1.5 py-0.5 rounded">Save 35%</span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded p-8 flex flex-col" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.06)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Star size={16} className="text-[#8A99B3]" />
              <span className="text-sm font-medium text-[#8A99B3]">Free</span>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold font-sans">$0</span>
              <span className="text-[#8A99B3] text-sm ml-2">/ month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#8A99B3]">
                  <Check size={14} className="text-[#00C896] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="block text-center border border-[#1E2D4A] hover:border-[#2F80ED] text-[#F0F4FF] px-6 py-3 rounded text-sm font-medium transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-[#0F1729] border border-[#2F80ED] rounded p-8 flex flex-col relative" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.2), 0 0 30px rgba(47,128,237,0.08)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-[#2F80ED] text-white text-xs px-3 py-1 rounded-full font-medium">Most Popular</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-[#2F80ED]" />
              <span className="text-sm font-medium text-[#2F80ED]">Pro</span>
            </div>
            <div className="mb-1">
              {billing === 'annual' ? (
                <>
                  <span className="text-4xl font-bold font-sans">$12.42</span>
                  <span className="text-[#8A99B3] text-sm ml-2">/ month</span>
                  <p className="text-xs text-[#8A99B3] mt-0.5">Billed $149/year</p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold font-sans">$19</span>
                  <span className="text-[#8A99B3] text-sm ml-2">/ month</span>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-8 mt-4 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={14} className="text-[#2F80ED] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={handleUpgrade}
              disabled={!!loading}
              className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-60 text-white px-6 py-3 rounded text-sm font-medium transition-colors"
            >
              {loading ? 'Redirecting...' : `Upgrade to Pro — ${billing === 'annual' ? '$149/yr' : '$19/mo'}`}
            </button>
          </div>
        </div>

        {/* FAQ / notes */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-lg font-bold font-sans mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel through the Stripe customer portal at any time. You keep Pro access until the end of your billing period.',
              },
              {
                q: 'What counts as an AI query?',
                a: 'Each message you send to the AI assistant — typed or spoken — counts as one query. Free users get 10 per day, resetting at midnight UTC.',
              },
              {
                q: 'Is my financial data stored?',
                a: 'Only your portfolio holdings, watchlist, and journal entries you manually input are stored in our database. No brokerage connections.',
              },
              {
                q: 'Do you offer refunds?',
                a: 'We offer a 7-day refund if you are not satisfied. Contact support within 7 days of purchase.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-[#1E2D4A] pb-4">
                <p className="text-sm font-medium mb-1.5">{q}</p>
                <p className="text-sm text-[#8A99B3]">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
