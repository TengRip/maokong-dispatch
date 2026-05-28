'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { SettingsPanel } from './SettingsPanel'

export function TopBar() {
  const { userRole, userEmail, saveSnapshot, cars, maintenanceUnits } = useApp()
  const [searchVal, setSearchVal] = useState('')
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [showSnapshotInput, setShowSnapshotInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = userRole === 'admin'
  const maintenanceCarIds = new Set(maintenanceUnits.flatMap(u => u.car_ids))

  const handleSearch = () => {
    const cid = searchVal.trim().toUpperCase()
    if (!cid) return
    const car = cars[cid]
    if (!car) { setSearchResult('找不到此車號'); return }
    const locationMap: Record<string, string> = {
      main_line: '正線區',
      zhuanjiaoer: '轉角二站儲車區',
      maokong: '貓空站儲車區',
      test_area: '測試區',
      weekly_schedule: '週排程區',
      unassigned: '未分配',
    }
    const loc = locationMap[car.location] ?? car.location
    const extra = car.location_slot !== null && car.location_slot !== undefined ? `（格 ${car.location_slot + 1}）` : ''
    const maintenance = maintenanceCarIds.has(cid) ? ' ⚠ 有維修需求' : ''
    setSearchResult(`${cid}：${loc}${extra}${maintenance}`)
  }

  const handleSaveSnapshot = async () => {
    if (!snapshotLabel.trim()) return
    setSaving(true)
    await saveSnapshot(snapshotLabel.trim())
    setSaving(false)
    setSnapshotLabel('')
    setShowSnapshotInput(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-700 border-b border-slate-600 flex-shrink-0 shadow-sm">
      {/* 標題 */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-lg">🚡</span>
        <span className="text-white font-bold text-sm whitespace-nowrap">貓空纜車調度</span>
      </div>

      {/* 搜尋車號 */}
      <div className="flex items-center gap-1">
        <input
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); setSearchResult(null) }}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          placeholder="搜尋車號…"
          className="w-24 text-xs bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
          maxLength={4}
        />
        <button
          onClick={handleSearch}
          className="text-xs bg-slate-500 hover:bg-slate-400 text-white rounded px-2 py-1"
        >
          搜尋
        </button>
        {searchResult && (
          <span className="text-xs text-yellow-300 ml-1">{searchResult}</span>
        )}
      </div>

      <div className="flex-1" />

      {/* 儲存快照 */}
      {isAdmin && (
        <div className="flex items-center gap-1">
          {showSnapshotInput ? (
            <>
              <input
                autoFocus
                value={snapshotLabel}
                onChange={e => setSnapshotLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveSnapshot() }}
                placeholder="班次說明…"
                className="w-32 text-xs bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white placeholder-slate-400 focus:outline-none focus:border-green-400"
              />
              <button
                onClick={handleSaveSnapshot}
                disabled={saving || !snapshotLabel.trim()}
                className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded px-2 py-1"
              >
                {saving ? '儲存中…' : '確認'}
              </button>
              <button
                onClick={() => setShowSnapshotInput(false)}
                className="text-xs bg-slate-500 hover:bg-slate-400 text-white rounded px-2 py-1"
              >
                取消
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowSnapshotInput(true)}
              className="text-xs bg-green-600 hover:bg-green-500 text-white rounded px-2 py-1"
            >
              💾 儲存班次
            </button>
          )}
        </div>
      )}

      {/* 設定按鈕 + 帳號資訊 */}
      <div className="flex items-center gap-2 ml-2">
        <SettingsPanel />
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isAdmin ? 'bg-blue-500 text-white' : 'bg-slate-500 text-slate-200'}`}>
          {isAdmin ? 'admin' : 'guest'}
        </span>
        <span className="text-slate-300 text-xs hidden lg:block">{userEmail}</span>
        <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-white">
          登出
        </button>
      </div>
    </div>
  )
}
