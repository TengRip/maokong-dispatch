export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppProvider } from '@/lib/store'
import { DragHandler } from '@/components/dispatch/DragHandler'
import { TopBar } from '@/components/dispatch/TopBar'
import { MainLineLoop } from '@/components/dispatch/MainLineLoop'
import { StorageArea } from '@/components/dispatch/StorageArea'
import { TestAreaPanel } from '@/components/dispatch/TestAreaPanel'
import { MaintenancePanel } from '@/components/dispatch/MaintenancePanel'
import { WeeklySchedulePanel } from '@/components/dispatch/WeeklySchedulePanel'

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
          <div className="flex flex-1 overflow-hidden">

            {/* 左側：轉角二站 + 測試區 + 維修排程 + 週排程 */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-2 p-2 overflow-y-auto border-r border-slate-300 bg-white">
              <StorageArea location="zhuanjiaoer" label="轉角二站 儲車區" maxSlots={40} collapsible />
              <div className="border-t border-slate-200 pt-2">
                <TestAreaPanel />
              </div>
              <div className="border-t border-slate-200 pt-2">
                <MaintenancePanel />
              </div>
              <div className="border-t border-slate-200 pt-2">
                <WeeklySchedulePanel />
              </div>
            </div>

            {/* 中央：正線迴圈 */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-slate-100">
              <MainLineLoop />
            </div>

            {/* 右側：貓空站（小角落） */}
            <div className="w-36 flex-shrink-0 p-2 border-l border-slate-300 bg-white">
              <StorageArea location="maokong" label="貓空站 儲車區" maxSlots={10} />
            </div>
          </div>
        </div>
      </DragHandler>
    </AppProvider>
  )
}
