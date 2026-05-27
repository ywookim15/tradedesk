import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, plan, theme')
    .eq('id', user.id)
    .single()

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--td-bg, #0A0F1E)' }}
    >
      <Sidebar
        user={{
          email:   user.email,
          profile: profile as { full_name: string | null; plan: 'free' | 'pro'; theme: 'dark' | 'light' } | null,
        }}
      />
      {/* pb-16 on mobile reserves space for the bottom tab bar */}
      <main
        className="flex-1 overflow-y-auto pb-16 md:pb-0"
        style={{ backgroundColor: 'var(--td-bg, #0A0F1E)', color: 'var(--td-text, #F0F4FF)' }}
      >
        {children}
      </main>
    </div>
  )
}
