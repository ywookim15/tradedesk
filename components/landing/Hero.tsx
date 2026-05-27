import Link from 'next/link'
import DashboardMockup from './DashboardMockup'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(47,128,237,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(47,128,237,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial glow — left of center */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '40%',
          left: '20%',
          transform: 'translate(-50%, -50%)',
          width: 700,
          height: 700,
          background:
            'radial-gradient(circle, rgba(47,128,237,0.07) 0%, transparent 65%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* ── Left: text ── */}
        <div className="flex flex-col gap-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 self-start border border-[#1E2D4A] bg-[#0F1729] rounded-[4px] px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C896] animate-pulse" />
            <span className="text-[11px] text-[#8A99B3] tracking-widest uppercase">
              AI-Powered Trading Platform
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl lg:text-6xl xl:text-[4.25rem] font-extrabold leading-[1.04] tracking-tight text-[#F0F4FF]"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Your AI Trading{' '}
            <span
              className="text-[#2F80ED]"
              style={{
                textShadow: '0 0 40px rgba(47,128,237,0.35)',
              }}
            >
              Command
            </span>{' '}
            Center.
          </h1>

          {/* Sub-headline */}
          <p className="text-base lg:text-lg text-[#8A99B3] leading-relaxed max-w-lg">
            Voice-activated AI assistant. Real-time charts with 20+ indicators.
            Fundamental analysis, watchlist, portfolio tracker, and trade journal —
            all in one professional platform built for serious traders.
          </p>

          {/* Quick stats */}
          <div className="flex gap-8 pt-1">
            {[
              { value: '20+', label: 'Analysis Tools' },
              { value: 'Free', label: 'To Start' },
              { value: 'Voice AI', label: 'Hands-Free' },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  className="text-xl font-bold text-[#2F80ED]"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {stat.value}
                </div>
                <div className="text-xs text-[#8A99B3] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-[#2F80ED] hover:bg-[#4FA3FF] text-white font-semibold text-sm px-8 py-3.5 rounded-[4px] transition-colors"
            >
              Get Started Free
            </Link>
            <a
              href="#howitworks"
              className="inline-flex items-center justify-center border border-[#1E2D4A] hover:border-[#2F80ED]/60 text-[#8A99B3] hover:text-[#F0F4FF] font-medium text-sm px-8 py-3.5 rounded-[4px] transition-colors"
            >
              See How It Works
            </a>
          </div>

          {/* Trust note */}
          <p className="text-xs text-[#8A99B3]">
            No credit card required &nbsp;·&nbsp; Free forever plan available
          </p>
        </div>

        {/* ── Right: dashboard mockup ── */}
        <div className="hidden lg:flex justify-center items-center">
          <DashboardMockup />
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 inset-x-0 h-36 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, #0A0F1E 20%, transparent)',
        }}
      />
    </section>
  )
}
