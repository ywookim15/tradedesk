'use client'

import Link from 'next/link'
import { Mic, ArrowRight } from 'lucide-react'

export default function AIBriefWidget() {
  return (
    <div
      className="mt-4 bg-[#0F1729] border border-[#2F80ED]/25 rounded-[6px] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      style={{
        animation:  'fadeUp 0.4s ease both',
        animationDelay: '400ms',
        boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.1), 0 0 32px rgba(47,128,237,0.05)',
      }}
    >
      <div className="flex items-start gap-4">
        {/* Mic glow */}
        <div
          className="w-10 h-10 rounded-full bg-[#2F80ED]/15 flex items-center justify-center shrink-0"
          style={{ boxShadow: '0 0 16px rgba(47,128,237,0.2)' }}
        >
          <Mic size={18} className="text-[#2F80ED]" />
        </div>

        <div>
          <h3
            className="text-sm font-semibold text-[#F0F4FF] mb-0.5"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            AI Daily Brief
          </h3>
          <p className="text-xs text-[#8A99B3] leading-relaxed max-w-sm">
            Ask your AI assistant for today&apos;s market brief. Say{' '}
            <span className="text-[#F0F4FF]">&ldquo;Hey buddy, what&apos;s moving today?&rdquo;</span>{' '}
            or type your question.
          </p>
        </div>
      </div>

      <Link
        href="/assistant"
        className="flex items-center gap-2 bg-[#2F80ED] hover:bg-[#4FA3FF] text-white text-xs font-semibold px-4 py-2.5 rounded-[4px] transition-colors whitespace-nowrap shrink-0"
      >
        Open Assistant
        <ArrowRight size={13} />
      </Link>
    </div>
  )
}
