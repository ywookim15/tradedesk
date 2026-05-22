// Shared wrapper for login and signup pages.
// Renders the deep navy background, grid pattern, radial glow, and centered logo.
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

interface AuthShellProps {
  children: React.ReactNode
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(47,128,237,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(47,128,237,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '44px 44px',
        }}
      />

      {/* Centre radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 640,
          height: 640,
          background:
            'radial-gradient(circle, rgba(47,128,237,0.07) 0%, transparent 65%)',
        }}
      />

      <div className="relative w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-8 group">
          <div className="w-9 h-9 bg-[#2F80ED] rounded-[4px] flex items-center justify-center group-hover:bg-[#4FA3FF] transition-colors">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span
            className="font-bold text-lg tracking-wide"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            <span className="text-[#2F80ED]">TRADE</span>
            <span className="text-[#F0F4FF]">DESK</span>
          </span>
        </Link>

        {/* Card */}
        <div
          className="w-full bg-[#0F1729] border border-[#1E2D4A] rounded-[6px] p-8"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.06)' }}
        >
          {children}
        </div>

        <p className="text-[#8A99B3] text-xs mt-5 text-center">
          For educational purposes only — not financial advice.
        </p>
      </div>
    </div>
  )
}
