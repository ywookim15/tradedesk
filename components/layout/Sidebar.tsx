'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  TrendingUp, LayoutDashboard, Mic, BarChart2,
  Eye, Briefcase, BookOpen, Settings, LogOut,
  ChevronLeft, ChevronRight, Sun, Moon, Radar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export interface SidebarUser {
  email?: string
  profile: {
    full_name: string | null
    plan: 'free' | 'pro'
    theme: 'dark' | 'light'
  } | null
}

const NAV = [
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/assistant',      icon: Mic,             label: 'AI Assistant' },
  { href: '/stock-analysis', icon: BarChart2,       label: 'Stock Analysis' },
  { href: '/scanner',        icon: Radar,           label: 'Scanner' },
  { href: '/watchlist',      icon: Eye,             label: 'Watchlist' },
  { href: '/portfolio',      icon: Briefcase,       label: 'Portfolio' },
  { href: '/journal',        icon: BookOpen,        label: 'Trade Journal' },
]

const MOBILE_NAV = [
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Dash' },
  { href: '/assistant',      icon: Mic,             label: 'AI' },
  { href: '/stock-analysis', icon: BarChart2,       label: 'Analysis' },
  { href: '/scanner',        icon: Radar,           label: 'Scanner' },
  { href: '/watchlist',      icon: Eye,             label: 'Watch' },
]

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('td-sidebar-collapsed')
    if (saved !== null) setCollapsed(saved === 'true')
    const savedTheme = localStorage.getItem('td-theme') ?? (user.profile?.theme ?? 'dark')
    setIsDark(savedTheme === 'dark')
  }, [user.profile?.theme])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('td-sidebar-collapsed', String(next))
  }

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('td-theme', next ? 'dark' : 'light')
    // Full light-mode CSS implementation is wired in globals.css via the .light class
    document.documentElement.classList.toggle('light', !next)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const name = user.profile?.full_name || user.email?.split('@')[0] || 'Trader'
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const plan = user.profile?.plan ?? 'free'

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen shrink-0 border-r backdrop-blur-sm transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
        )}
        style={{
          borderColor: 'var(--td-border, #1E2D4A)',
          backgroundColor: 'color-mix(in srgb, var(--td-bg, #0A0F1E) 80%, transparent)',
        }}
      >
        {/* Logo row */}
        <div
          className={cn(
            'flex items-center h-14 border-b border-[#1E2D4A] px-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {collapsed ? (
            <Link href="/dashboard">
              <div className="w-7 h-7 bg-[#2F80ED] rounded-[4px] flex items-center justify-center">
                <TrendingUp size={14} className="text-white" />
              </div>
            </Link>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#2F80ED] rounded-[4px] flex items-center justify-center shrink-0">
                <TrendingUp size={14} className="text-white" />
              </div>
              <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-syne)' }}>
                <span className="text-[#2F80ED]">TRADE</span>
                <span className="text-[#F0F4FF]">DESK</span>
              </span>
            </Link>
          )}
          <button
            onClick={toggleCollapse}
            className="text-[#8A99B3] hover:text-[#F0F4FF] p-1 rounded-[4px] hover:bg-[#1E2D4A] transition-colors"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-3 px-2.5 py-2.5 rounded-[4px] text-sm transition-all group',
                  active
                    ? 'bg-[#2F80ED]/10 text-[#2F80ED]'
                    : 'text-[#8A99B3] hover:text-[#F0F4FF] hover:bg-[#1E2D4A]/50',
                )}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#2F80ED] rounded-r-full" />
                )}
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {collapsed && (
                  <div className="pointer-events-none absolute left-full ml-2.5 px-2 py-1 bg-[#0F1729] border border-[#1E2D4A] rounded-[4px] text-xs text-[#F0F4FF] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                    {label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-[#1E2D4A] p-2 flex flex-col gap-0.5">
          {/* Settings */}
          <Link
            href="/settings"
            className={cn(
              'relative flex items-center gap-3 px-2.5 py-2.5 rounded-[4px] text-sm transition-all group',
              pathname === '/settings'
                ? 'bg-[#2F80ED]/10 text-[#2F80ED]'
                : 'text-[#8A99B3] hover:text-[#F0F4FF] hover:bg-[#1E2D4A]/50',
            )}
          >
            <Settings size={16} className="shrink-0" />
            {!collapsed && <span>Settings</span>}
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-2.5 px-2 py-1 bg-[#0F1729] border border-[#1E2D4A] rounded-[4px] text-xs text-[#F0F4FF] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                Settings
              </div>
            )}
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-[4px] text-sm text-[#8A99B3] hover:text-[#F0F4FF] hover:bg-[#1E2D4A]/50 transition-all w-full group relative"
          >
            {isDark ? <Moon size={16} className="shrink-0" /> : <Sun size={16} className="shrink-0" />}
            {!collapsed && <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>}
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-2.5 px-2 py-1 bg-[#0F1729] border border-[#1E2D4A] rounded-[4px] text-xs text-[#F0F4FF] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                Toggle Theme
              </div>
            )}
          </button>

          {/* User info */}
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 mt-1">
              <div className="w-7 h-7 rounded-full bg-[#2F80ED]/15 border border-[#2F80ED]/25 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#2F80ED]">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#F0F4FF] truncate font-medium leading-none mb-1">{name}</p>
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-sm',
                    plan === 'pro'
                      ? 'bg-[#2F80ED]/20 text-[#2F80ED]'
                      : 'bg-[#1E2D4A] text-[#8A99B3]',
                  )}
                >
                  {plan.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-[4px] text-sm text-[#8A99B3] hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/8 transition-all w-full group relative"
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Log Out</span>}
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-2.5 px-2 py-1 bg-[#0F1729] border border-[#1E2D4A] rounded-[4px] text-xs text-[#F0F4FF] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                Log Out
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0A0F1E]/95 backdrop-blur-md border-t border-[#1E2D4A] flex">
        {MOBILE_NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors',
                active ? 'text-[#2F80ED]' : 'text-[#8A99B3]',
              )}
            >
              <Icon size={18} />
              <span className="text-[9px]">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
