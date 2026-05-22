'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Normalise the Supabase error message to be user-friendly
      if (
        error.message.toLowerCase().includes('invalid login') ||
        error.message.toLowerCase().includes('invalid credentials')
      ) {
        setError('Invalid email or password. Please try again.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    // Refresh server components so middleware picks up the new session cookie
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AuthShell>
      {/* Heading */}
      <div className="mb-7">
        <h1
          className="text-2xl font-bold text-[#F0F4FF] mb-1.5"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          Sign in
        </h1>
        <p className="text-[#8A99B3] text-sm">
          Welcome back. Your command center awaits.
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
        {/* Email */}
        <div>
          <label className="block text-[11px] text-[#8A99B3] uppercase tracking-widest mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-[#0A0F1E] border border-[#1E2D4A] focus:border-[#2F80ED] text-[#F0F4FF] placeholder-[#8A99B3] text-sm px-4 py-3 rounded-[4px] outline-none transition-colors"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-[11px] text-[#8A99B3] uppercase tracking-widest mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0A0F1E] border border-[#1E2D4A] focus:border-[#2F80ED] text-[#F0F4FF] placeholder-[#8A99B3] text-sm px-4 py-3 pr-11 rounded-[4px] outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A99B3] hover:text-[#F0F4FF] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Inline error */}
        {error && (
          <div className="flex items-start gap-2.5 bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-[4px] px-3 py-2.5">
            <AlertCircle size={14} className="text-[#FF4D4D] shrink-0 mt-0.5" />
            <p className="text-[#FF4D4D] text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-[4px] transition-colors mt-1 flex items-center justify-center gap-2"
        >
          {loading && (
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {/* Footer link */}
      <p className="text-center text-sm text-[#8A99B3] mt-6">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="text-[#2F80ED] hover:text-[#4FA3FF] transition-colors font-medium"
        >
          Sign up free →
        </Link>
      </p>
    </AuthShell>
  )
}
