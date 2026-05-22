'use client'

import { useState } from 'react'

export default function EmailCapture() {
  const beehiivUrl = process.env.NEXT_PUBLIC_BEEHIIV_FORM_URL
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    // Placeholder — replace with actual Beehiiv subscribe API call once URL is set
    setStatus('success')
    setEmail('')
  }

  return (
    <section className="py-24 relative">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#1E2D4A] to-transparent" />

      {/* Faint background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(47,128,237,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-2xl mx-auto px-6 text-center">
        <div
          className="bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-10 lg:p-12"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.06)' }}
        >
          <div className="inline-flex items-center gap-2 border border-[#1E2D4A] bg-[#0A0F1E] rounded-[4px] px-3 py-1.5 mb-5">
            <span className="text-[11px] text-[#8A99B3] tracking-widest uppercase">
              Weekly Newsletter
            </span>
          </div>

          <h2
            className="text-3xl font-bold text-[#F0F4FF] mb-3 leading-snug"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Get weekly market insights{' '}
            <span className="text-[#2F80ED]">from TradeDesk.</span>
          </h2>
          <p className="text-[#8A99B3] text-sm mb-8 leading-relaxed">
            Market breakdowns, trading concepts, and platform updates — straight
            to your inbox every week. Join free traders already subscribed.
          </p>

          {/* Beehiiv iframe embed if URL is provided, otherwise custom form */}
          {beehiivUrl ? (
            <div className="rounded-[4px] overflow-hidden -mx-2">
              <iframe
                src={beehiivUrl}
                width="100%"
                height="120"
                style={{ border: 'none', display: 'block' }}
                scrolling="no"
                title="TradeDesk newsletter signup"
              />
            </div>
          ) : status === 'success' ? (
            <div className="flex items-center justify-center gap-2 border border-[#00C896]/30 bg-[#00C896]/10 rounded-[4px] py-3 px-4">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00C896]" />
              <span className="text-[#00C896] text-sm font-medium">
                You&apos;re subscribed! Check your inbox.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 bg-[#0A0F1E] border border-[#1E2D4A] focus:border-[#2F80ED] text-[#F0F4FF] placeholder-[#8A99B3] text-sm px-4 py-3 rounded-[4px] outline-none transition-colors"
              />
              <button
                type="submit"
                className="bg-[#2F80ED] hover:bg-[#4FA3FF] text-white text-sm font-medium px-6 py-3 rounded-[4px] transition-colors whitespace-nowrap"
              >
                Subscribe Free
              </button>
            </form>
          )}

          <p className="text-[#8A99B3] text-xs mt-4">
            No spam, ever. Unsubscribe in one click.
          </p>
        </div>
      </div>
    </section>
  )
}
