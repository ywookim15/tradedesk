import Link from 'next/link'
import { Check, Zap } from 'lucide-react'

const freeFeatures = [
  'Full platform access',
  '10 AI assistant queries per day',
  'Watchlist: up to 10 stocks',
  'All technical analysis tools',
  'All fundamental analysis tools',
  'Trade journal & portfolio tracker',
  'Voice assistant (within daily limit)',
]

const proFeatures = [
  'Everything in Free',
  'Unlimited AI assistant queries',
  'Unlimited watchlist stocks',
  'Priority response speed',
  'Early access to new features',
]

export default function PricingPreview() {
  return (
    <section id="pricing" className="py-28 relative">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#1E2D4A] to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 border border-[#1E2D4A] bg-[#0F1729] rounded-[4px] px-3 py-1.5 mb-5">
            <span className="text-[11px] text-[#8A99B3] tracking-widest uppercase">
              Transparent Pricing
            </span>
          </div>
          <h2
            className="text-4xl lg:text-5xl font-bold text-[#F0F4FF] mb-4"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Start free.{' '}
            <span className="text-[#2F80ED]">Upgrade when ready.</span>
          </h2>
          <p className="text-[#8A99B3] text-lg max-w-lg mx-auto leading-relaxed">
            No credit card required. Full access from day one.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* ── Free ── */}
          <div className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-8 flex flex-col">
            <div className="mb-6">
              <h3
                className="text-[#F0F4FF] font-bold text-xl mb-3"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Free
              </h3>
              <div className="flex items-end gap-1.5 mb-1">
                <span
                  className="text-5xl font-extrabold text-[#F0F4FF] leading-none"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  $0
                </span>
                <span className="text-[#8A99B3] text-sm mb-1.5">/month</span>
              </div>
              <p className="text-[#8A99B3] text-sm">Start with no commitment.</p>
            </div>

            <Link
              href="/signup"
              className="block w-full text-center border border-[#1E2D4A] hover:border-[#2F80ED]/60 text-[#F0F4FF] hover:text-[#2F80ED] font-medium text-sm py-3 rounded-[4px] mb-7 transition-colors"
            >
              Get Started Free
            </Link>

            <ul className="flex flex-col gap-3 mt-auto">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-[#8A99B3]">
                  <Check size={14} className="text-[#00C896] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Pro ── */}
          <div
            className="relative bg-[#0F1729] border border-[#2F80ED]/40 rounded-[6px] p-8 flex flex-col"
            style={{
              boxShadow:
                '0 0 48px rgba(47,128,237,0.1), inset 0 0 0 1px rgba(47,128,237,0.12)',
            }}
          >
            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1.5 bg-[#2F80ED] text-white text-xs font-semibold px-3.5 py-1 rounded-full">
                <Zap size={11} />
                Most Popular
              </div>
            </div>

            <div className="mb-6">
              <h3
                className="text-[#F0F4FF] font-bold text-xl mb-3"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Pro
              </h3>
              <div className="flex items-end gap-1.5 mb-1">
                <span
                  className="text-5xl font-extrabold text-[#F0F4FF] leading-none"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  $19
                </span>
                <span className="text-[#8A99B3] text-sm mb-1.5">/month</span>
              </div>
              <div className="text-[#00C896] text-xs font-medium">
                or $149/year — save ~35%
              </div>
            </div>

            <Link
              href="/pricing"
              className="block w-full text-center bg-[#2F80ED] hover:bg-[#4FA3FF] text-white font-medium text-sm py-3 rounded-[4px] mb-7 transition-colors"
            >
              Upgrade to Pro
            </Link>

            <ul className="flex flex-col gap-3 mt-auto">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-[#8A99B3]">
                  <Check size={14} className="text-[#2F80ED] mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-[#8A99B3] mt-8">
          See the full feature breakdown on the{' '}
          <Link
            href="/pricing"
            className="text-[#2F80ED] hover:text-[#4FA3FF] transition-colors"
          >
            pricing page →
          </Link>
        </p>
      </div>
    </section>
  )
}
