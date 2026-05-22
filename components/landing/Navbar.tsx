'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X, TrendingUp } from 'lucide-react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0A0F1E]/90 backdrop-blur-md border-b border-[#1E2D4A]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-[#2F80ED] rounded-[4px] flex items-center justify-center group-hover:bg-[#4FA3FF] transition-colors">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span
            className="font-bold text-base tracking-wide"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            <span className="text-[#2F80ED]">TRADE</span>
            <span className="text-[#F0F4FF]">DESK</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="#features" className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors">
            Features
          </a>
          <a href="#howitworks" className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors">
            How It Works
          </a>
          <a href="#pricing" className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors">
            Pricing
          </a>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[#8A99B3] hover:text-[#F0F4FF] px-4 py-2 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-[#2F80ED] hover:bg-[#4FA3FF] text-white px-5 py-2 rounded-[4px] font-medium transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden text-[#8A99B3] hover:text-[#F0F4FF] transition-colors"
          aria-label="Toggle navigation"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0F1729] border-b border-[#1E2D4A] px-6 py-5 flex flex-col gap-4 text-sm">
          <a
            href="#features"
            className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors py-1"
            onClick={() => setOpen(false)}
          >
            Features
          </a>
          <a
            href="#howitworks"
            className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors py-1"
            onClick={() => setOpen(false)}
          >
            How It Works
          </a>
          <a
            href="#pricing"
            className="text-[#8A99B3] hover:text-[#F0F4FF] transition-colors py-1"
            onClick={() => setOpen(false)}
          >
            Pricing
          </a>
          <div className="border-t border-[#1E2D4A] pt-4 flex flex-col gap-3">
            <Link href="/login" className="text-[#8A99B3]" onClick={() => setOpen(false)}>
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-[#2F80ED] text-white px-5 py-2.5 rounded-[4px] text-center font-medium"
              onClick={() => setOpen(false)}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
