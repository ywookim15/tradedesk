'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
import { createClient } from '@/lib/supabase/client'

function getPasswordStrength(pw: string): number {
  if (pw.length === 0) return 0
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9!@#$%^&*]/.test(pw)) score++
  return score
}

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColor = ['', '#FF4D4D', '#F59E0B', '#4FA3FF', '#00C896']

export default function SignupPage() {
  const router = useRouter()
  const [fullName,     setFullName]     = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [emailSent,    setEmailSent]    = useState(false)

  const strength = getPasswordStrength(password)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Client-side guards
    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    email.trim(),
        password: password,
        options: {
          data: { full_name: fullName.trim() },
        },
      })

      if (signUpError) {
        // Surface the real Supabase error message
        const msg = signUpError.message
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
          setError('An account with this email already exists. Try signing in.')
        } else if (msg.toLowerCase().includes('invalid email')) {
          setError('Please enter a valid email address.')
        } else if (msg.toLowerCase().includes('password')) {
          setError('Password is too weak. Try adding numbers or symbols.')
        } else {
          setError(msg)
        }
        setLoading(false)
        return
      }

      // Supabase email enumeration protection: when enabled, a duplicate-email
      // signup returns { user: { identities: [] }, session: null, error: null }.
      // An empty identities array means the email is already taken.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError('An account with this email already exists. Try signing in.')
        setLoading(false)
        return
      }

      // Session present → email confirmation is disabled → go to dashboard immediately
      if (data.session) {
        router.push('/dashboard')
        router.refresh()
        return
      }

      // User created, session null → confirmation email was sent
      if (data.user) {
        setEmailSent(true)
        setLoading(false)
        return
      }

      // Fallback: something unexpected happened
      setError('Signup failed — please try again.')
      setLoading(false)

    } catch (caught: unknown) {
      const msg = caught instanceof Error ? caught.message : 'Unexpected error. Please try again.'
      setError(msg)
      setLoading(false)
    }
  }

  // ── Email-sent confirmation screen ───────────────────────────────────────────
  if (emailSent) {
    return (
      <AuthShell>
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-[#00C896]/10 border border-[#00C896]/30 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={26} className="text-[#00C896]" />
          </div>
          <h2
            className="text-2xl font-bold text-[#F0F4FF] mb-2"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Check your email
          </h2>
          <p className="text-[#8A99B3] text-sm leading-relaxed mb-1">
            We sent a confirmation link to
          </p>
          <p className="text-[#F0F4FF] text-sm font-medium mb-6">{email}</p>
          <p className="text-[#8A99B3] text-xs mb-7">
            Click the link in the email to activate your account. Check your spam
            folder if you don&apos;t see it within a minute.
          </p>
          <p className="text-[#8A99B3] text-xs mb-5">
            Or, to skip email confirmation:&nbsp;
            <span className="text-[#F0F4FF]">
              Supabase Dashboard → Authentication → Providers → Email → disable &quot;Confirm email&quot;
            </span>
          </p>
          <Link
            href="/login"
            className="text-sm text-[#2F80ED] hover:text-[#4FA3FF] transition-colors font-medium"
          >
            ← Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  // ── Sign-up form ─────────────────────────────────────────────────────────────
  return (
    <AuthShell>
      <div className="mb-7">
        <h1
          className="text-2xl font-bold text-[#F0F4FF] mb-1.5"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          Create your account
        </h1>
        <p className="text-[#8A99B3] text-sm">Free forever. No credit card required.</p>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-4" noValidate>
        {/* Full name */}
        <div>
          <label className="block text-[11px] text-[#8A99B3] uppercase tracking-widest mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Johnson"
            className="w-full bg-[#0A0F1E] border border-[#1E2D4A] focus:border-[#2F80ED] text-[#F0F4FF] placeholder-[#8A99B3] text-sm px-4 py-3 rounded-[4px] outline-none transition-colors"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-[11px] text-[#8A99B3] uppercase tracking-widest mb-1.5">
            Email
          </label>
          <input
            type="email"
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
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

          {password.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{ backgroundColor: strength >= level ? strengthColor[strength] : '#1E2D4A' }}
                  />
                ))}
              </div>
              <span
                className="text-[11px] font-medium w-12 text-right"
                style={{ color: strengthColor[strength] }}
              >
                {strengthLabel[strength]}
              </span>
            </div>
          )}
        </div>

        {/* Inline error */}
        {error && (
          <div className="flex items-start gap-2.5 bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-[4px] px-3 py-2.5">
            <AlertCircle size={14} className="text-[#FF4D4D] shrink-0 mt-0.5" />
            <p className="text-[#FF4D4D] text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <p className="text-[#8A99B3] text-xs leading-relaxed">
          By creating an account you agree that TradeDesk provides educational tools only — not financial advice.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-[4px] transition-colors flex items-center justify-center gap-2"
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
          {loading ? 'Creating account…' : 'Create Free Account'}
        </button>
      </form>

      <p className="text-center text-sm text-[#8A99B3] mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-[#2F80ED] hover:text-[#4FA3FF] transition-colors font-medium">
          Sign in →
        </Link>
      </p>
    </AuthShell>
  )
}
