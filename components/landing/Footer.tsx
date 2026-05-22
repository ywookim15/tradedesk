import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[#1E2D4A] bg-[#0A0F1E]">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
              <div className="w-7 h-7 bg-[#2F80ED] rounded-[4px] flex items-center justify-center group-hover:bg-[#4FA3FF] transition-colors">
                <TrendingUp size={14} className="text-white" />
              </div>
              <span
                className="font-bold text-sm tracking-wide"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                <span className="text-[#2F80ED]">TRADE</span>
                <span className="text-[#F0F4FF]">DESK</span>
              </span>
            </Link>
            <p className="text-[#8A99B3] text-sm leading-relaxed max-w-sm">
              An AI-powered trading command center for serious traders. Analyze
              markets, journal trades, and grow your knowledge — all in one
              professional platform.
            </p>
          </div>

          {/* Platform links */}
          <div>
            <h4
              className="text-[#F0F4FF] text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Platform
            </h4>
            <ul className="flex flex-col gap-3 text-sm text-[#8A99B3]">
              <li>
                <a href="#features" className="hover:text-[#F0F4FF] transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#howitworks" className="hover:text-[#F0F4FF] transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[#F0F4FF] transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Account links */}
          <div>
            <h4
              className="text-[#F0F4FF] text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Account
            </h4>
            <ul className="flex flex-col gap-3 text-sm text-[#8A99B3]">
              <li>
                <Link href="/login" className="hover:text-[#F0F4FF] transition-colors">
                  Log In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-[#F0F4FF] transition-colors">
                  Sign Up Free
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-[#F0F4FF] transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1E2D4A] pt-7 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[#8A99B3] text-xs">
            © {year} TradeDesk. All rights reserved.
          </p>
          <p className="text-[#8A99B3] text-xs">
            For educational purposes only — not financial advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
