import { Mic, LineChart, BarChart2, Eye, BookOpen, PieChart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  color: string
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Mic,
    color: '#2F80ED',
    title: 'Voice AI Assistant',
    description:
      'Say "Hey buddy" to activate hands-free analysis. Ask any trading question and get an educational spoken response while your charts stay front and center.',
  },
  {
    icon: LineChart,
    color: '#00C896',
    title: 'Technical Analysis',
    description:
      'Full interactive charts with SMA, EMA, Bollinger Bands, MACD, RSI, VWAP, Fibonacci, Monte Carlo simulation, Sharpe ratio, and more — all togglable.',
  },
  {
    icon: BarChart2,
    color: '#4FA3FF',
    title: 'Fundamental Analysis',
    description:
      'P/E, EPS, ROE, Beta, revenue, profit margins, and analyst ratings — with plain-English tooltips on every metric and an AI summary at the click of a button.',
  },
  {
    icon: Eye,
    color: '#F59E0B',
    title: 'Live Watchlist',
    description:
      'Track your target stocks with real-time price, % change, volume, and market cap. Auto-refreshes every 60 seconds. Click any ticker to open it in charts.',
  },
  {
    icon: BookOpen,
    color: '#A78BFA',
    title: 'Trade Journal',
    description:
      'Log every trade with entry, exit, shares, and notes. P&L is auto-calculated. See your win rate, average gain, and total performance at a glance.',
  },
  {
    icon: PieChart,
    color: '#FF4D4D',
    title: 'Portfolio Tracker',
    description:
      'Input your holdings and see live unrealized P&L, total value, cost basis, and an allocation pie chart — refreshed live from Yahoo Finance and Finnhub.',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-28 relative">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#1E2D4A] to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 border border-[#1E2D4A] bg-[#0F1729] rounded-[4px] px-3 py-1.5 mb-5">
            <span className="text-[11px] text-[#8A99B3] tracking-widest uppercase">
              Everything In One Place
            </span>
          </div>
          <h2
            className="text-4xl lg:text-5xl font-bold text-[#F0F4FF] mb-4"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            A complete trading{' '}
            <span className="text-[#2F80ED]">command center</span>
          </h2>
          <p className="text-[#8A99B3] text-lg max-w-xl mx-auto leading-relaxed">
            Every tool a serious trader needs, unified in one sharp interface.
            No tab-switching. No data gaps.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="bg-[#0F1729] border border-[#1E2D4A] hover:border-[#2F80ED]/40 rounded-[6px] p-6 group transition-all duration-200 hover:-translate-y-px"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.04)' }}
              >
                {/* Icon box */}
                <div
                  className="w-10 h-10 rounded-[4px] flex items-center justify-center mb-5"
                  style={{ backgroundColor: feature.color + '1A' }}
                >
                  <Icon size={18} style={{ color: feature.color }} />
                </div>

                <h3
                  className="text-[#F0F4FF] font-semibold text-base mb-2"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {feature.title}
                </h3>
                <p className="text-[#8A99B3] text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
