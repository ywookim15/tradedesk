import { Monitor, Mic, Brain } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Step {
  number: string
  icon: LucideIcon
  title: string
  description: string
  highlight: boolean
}

const steps: Step[] = [
  {
    number: '01',
    icon: Monitor,
    title: 'Open TradeDesk on your second monitor',
    description:
      "Pull up TradeDesk alongside your primary charting platform. It's designed to live on a second screen so you never lose focus on your main setup.",
    highlight: false,
  },
  {
    number: '02',
    icon: Mic,
    title: 'Say "Hey buddy" to activate',
    description:
      'TradeDesk listens for your wake word. The moment it hears "Hey buddy," the AI activates and starts processing your spoken question — completely hands-free.',
    highlight: true,
  },
  {
    number: '03',
    icon: Brain,
    title: 'Get instant educational analysis',
    description:
      'Your question goes to the AI, which responds on-screen and aloud — always explaining the WHY behind every signal, never just telling you what to do.',
    highlight: false,
  },
]

export default function HowItWorks() {
  return (
    <section id="howitworks" className="py-28 relative">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#1E2D4A] to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 border border-[#1E2D4A] bg-[#0F1729] rounded-[4px] px-3 py-1.5 mb-5">
            <span className="text-[11px] text-[#8A99B3] tracking-widest uppercase">
              Simple As Saying Hello
            </span>
          </div>
          <h2
            className="text-4xl lg:text-5xl font-bold text-[#F0F4FF] mb-4"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            How it <span className="text-[#2F80ED]">works</span>
          </h2>
          <p className="text-[#8A99B3] text-lg max-w-xl mx-auto leading-relaxed">
            Three steps from setup to your first AI-powered market insight.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid md:grid-cols-3 gap-10 lg:gap-16">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.666%+2.5rem)] right-[calc(16.666%+2.5rem)] h-px bg-gradient-to-r from-[#1E2D4A] via-[#2F80ED]/25 to-[#1E2D4A]" />

          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.number}
                className="relative flex flex-col items-center text-center gap-5"
              >
                {/* Icon circle */}
                <div className="relative z-10">
                  <div
                    className="w-20 h-20 rounded-full border-2 bg-[#0F1729] flex items-center justify-center"
                    style={
                      step.highlight
                        ? {
                            borderColor: '#2F80ED',
                            boxShadow: '0 0 28px rgba(47,128,237,0.2)',
                          }
                        : { borderColor: '#1E2D4A' }
                    }
                  >
                    <Icon
                      size={28}
                      style={{ color: step.highlight ? '#2F80ED' : '#8A99B3' }}
                    />
                  </div>

                  {/* Step number badge */}
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#0A0F1E] border border-[#1E2D4A] flex items-center justify-center">
                    <span
                      className="text-[10px] font-bold text-[#2F80ED]"
                      style={{ fontFamily: 'var(--font-syne)' }}
                    >
                      {step.number}
                    </span>
                  </div>
                </div>

                <h3
                  className="text-[#F0F4FF] font-semibold text-lg leading-snug"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {step.title}
                </h3>
                <p className="text-[#8A99B3] text-sm leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* CTA under steps */}
        <div className="flex justify-center mt-16">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 text-sm text-[#2F80ED] hover:text-[#4FA3FF] transition-colors border border-[#1E2D4A] hover:border-[#2F80ED]/40 px-6 py-3 rounded-[4px]"
          >
            See plans &amp; pricing
            <span className="text-[#8A99B3]">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
