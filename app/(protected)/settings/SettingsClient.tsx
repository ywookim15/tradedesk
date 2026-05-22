'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, User, Lock, Palette, Zap, Trash2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Profile = {
  full_name: string | null
  plan: string | null
  theme: string | null
}

export default function SettingsClient() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile, setProfile]   = useState<Profile | null>(null)
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(true)

  // Display name
  const [name, setName]         = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  // Password
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [savingPw, setSavingPw]     = useState(false)
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  // Theme
  const [theme, setTheme]       = useState<'dark' | 'light'>('dark')
  const [savingTheme, setSavingTheme] = useState(false)

  // Stripe portal
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError, setPortalError]     = useState<string | null>(null)

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')

      const { data } = await supabase
        .from('profiles')
        .select('full_name, plan, theme')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
        setName((data as Profile).full_name ?? '')
        setTheme(((data as Profile).theme ?? 'dark') as 'dark' | 'light')
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    setNameMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name.trim() } as never)
        .eq('id', user.id)
      if (error) { setNameMsg({ ok: false, text: error.message }); return }
      setNameMsg({ ok: true, text: 'Display name updated.' })
    } catch {
      setNameMsg({ ok: false, text: 'Failed to update name.' })
    } finally {
      setSavingName(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) { setPwMsg({ ok: false, text: error.message }); return }
      setPwMsg({ ok: true, text: 'Password updated successfully.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch {
      setPwMsg({ ok: false, text: 'Failed to update password.' })
    } finally {
      setSavingPw(false)
    }
  }

  async function saveTheme(t: 'dark' | 'light') {
    setTheme(t)
    setSavingTheme(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ theme: t } as never).eq('id', user.id)
    } catch { /* silent */ } finally {
      setSavingTheme(false)
    }
  }

  async function openPortal() {
    setLoadingPortal(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setPortalError(data.error ?? 'Failed to open billing portal')
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('Network error')
    } finally {
      setLoadingPortal(false)
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('journal').delete().eq('user_id', user.id)
      await supabase.from('portfolio').delete().eq('user_id', user.id)
      await supabase.from('watchlist').delete().eq('user_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-[#0F1729] rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F0F4FF] p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Settings className="text-[#2F80ED]" size={22} />
          <h1 className="text-2xl font-bold font-sans tracking-tight">Settings</h1>
        </div>

        <div className="space-y-4">
          {/* Profile */}
          <section className="bg-[#0F1729] border border-[#1E2D4A] rounded p-5" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.08)' }}>
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-[#8A99B3]">
              <User size={14} />
              Display Name
            </div>
            <p className="text-xs text-[#8A99B3] mb-3">Email: {email}</p>
            <form onSubmit={saveName} className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
                className="flex-1 bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2F80ED]"
              />
              <button type="submit" disabled={savingName}
                className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                {savingName ? 'Saving...' : 'Save'}
              </button>
            </form>
            {nameMsg && (
              <p className={`text-xs mt-2 flex items-center gap-1 ${nameMsg.ok ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                {nameMsg.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                {nameMsg.text}
              </p>
            )}
          </section>

          {/* Password */}
          <section className="bg-[#0F1729] border border-[#1E2D4A] rounded p-5" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.08)' }}>
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-[#8A99B3]">
              <Lock size={14} />
              Change Password
            </div>
            <form onSubmit={savePassword} className="space-y-2">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password (not validated — Supabase handles this)"
                className="w-full bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2F80ED]"
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                required
                minLength={8}
                className="w-full bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2F80ED]"
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                required
                className="w-full bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2F80ED]"
              />
              <button type="submit" disabled={savingPw || !newPw}
                className="bg-[#2F80ED] hover:bg-[#4FA3FF] disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                {savingPw ? 'Updating...' : 'Update Password'}
              </button>
            </form>
            {pwMsg && (
              <p className={`text-xs mt-2 flex items-center gap-1 ${pwMsg.ok ? 'text-[#00C896]' : 'text-[#FF4D4D]'}`}>
                {pwMsg.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                {pwMsg.text}
              </p>
            )}
          </section>

          {/* Theme */}
          <section className="bg-[#0F1729] border border-[#1E2D4A] rounded p-5" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.08)' }}>
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-[#8A99B3]">
              <Palette size={14} />
              Theme {savingTheme && <span className="text-xs opacity-50 ml-2">Saving...</span>}
            </div>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => saveTheme(t)}
                  className={`px-5 py-2 rounded text-sm font-medium capitalize transition-colors border ${
                    theme === t
                      ? 'bg-[#2F80ED] border-[#2F80ED] text-white'
                      : 'bg-[#0A0F1E] border-[#1E2D4A] text-[#8A99B3] hover:border-[#2F80ED]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#8A99B3] mt-2">Full light mode coming soon — preference is saved.</p>
          </section>

          {/* Subscription */}
          <section className="bg-[#0F1729] border border-[#1E2D4A] rounded p-5" style={{ boxShadow: 'inset 0 0 0 1px rgba(47,128,237,0.08)' }}>
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-[#8A99B3]">
              <Zap size={14} />
              Subscription
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                profile?.plan === 'pro'
                  ? 'bg-[#2F80ED]/20 text-[#2F80ED] border border-[#2F80ED]/30'
                  : 'bg-[#8A99B3]/10 text-[#8A99B3] border border-[#8A99B3]/20'
              }`}>
                {profile?.plan === 'pro' ? 'PRO' : 'FREE'}
              </span>
              <span className="text-sm text-[#8A99B3]">
                {profile?.plan === 'pro' ? 'Unlimited AI queries & watchlist stocks' : '10 AI queries/day · 10 watchlist stocks'}
              </span>
            </div>
            {profile?.plan === 'pro' ? (
              <div>
                <button
                  onClick={openPortal}
                  disabled={loadingPortal}
                  className="flex items-center gap-2 bg-[#0A0F1E] border border-[#1E2D4A] hover:border-[#2F80ED] text-[#F0F4FF] px-4 py-2 rounded text-sm transition-colors"
                >
                  <ExternalLink size={13} />
                  {loadingPortal ? 'Opening...' : 'Manage Subscription'}
                </button>
                {portalError && <p className="text-xs text-[#FF4D4D] mt-2">{portalError}</p>}
              </div>
            ) : (
              <button
                onClick={() => router.push('/pricing')}
                className="bg-[#2F80ED] hover:bg-[#4FA3FF] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Upgrade to Pro →
              </button>
            )}
          </section>

          {/* Danger zone */}
          <section className="bg-[#0F1729] border border-[#FF4D4D]/20 rounded p-5">
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-[#FF4D4D]">
              <Trash2 size={14} />
              Danger Zone
            </div>
            <p className="text-xs text-[#8A99B3] mb-3">
              Permanently deletes your account, all journal entries, portfolio holdings, and watchlist. This cannot be undone.
            </p>
            <p className="text-xs text-[#8A99B3] mb-2">Type <span className="text-[#FF4D4D] font-mono">DELETE</span> to confirm:</p>
            <div className="flex gap-2">
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="bg-[#0A0F1E] border border-[#1E2D4A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#FF4D4D] w-36 font-mono"
              />
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 disabled:opacity-30 text-[#FF4D4D] border border-[#FF4D4D]/30 px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
