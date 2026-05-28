export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppProvider } from '@/lib/store'
import { DragHandler } from '@/components/dispatch/DragHandler'
import { TopBar } from '@/components/dispatch/TopBar'
import { MainLayout } from '@/components/dispatch/MainLayout'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.user_metadata?.role as 'admin' | 'guest') ?? 'guest'

  return (
    <AppProvider userRole={role} userEmail={user.email ?? ''}>
      <DragHandler>
        <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
          <TopBar />
          <MainLayout />
        </div>
      </DragHandler>
    </AppProvider>
  )
}
