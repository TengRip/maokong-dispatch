'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '@/lib/store'
import type { Car, TestArea, MaintenanceUnit } from '@/types'

interface SnapshotRow {
  id: string
  created_at: string
  label: string
  created_by: string
  main_line_data: { mode: number; positions: (string | null)[] }
  cars_data: Car[]
  test_areas_data: TestArea[]
  maintenance_data: MaintenanceUnit[]
  weekly_data: Record<string, unknown>
}

export function SnapshotPanel() {
  const { userRole, userEmail } = useApp()
  const supabase = createClient()
  const isAdmin = userRole === 'admin'

  const { saveSnapshot } = useApp()
  const [open, setOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<SnapshotRow | null>(null)
  const [password, setPassword] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState('')
  const [restoreSuccess, setRestoreSuccess] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SnapshotRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!isAdmin) return null

  const handleSave = async () => {
    const label = saveLabel.trim()
    if (!label) return
    setSaving(true)
    await saveSnapshot(label)
    setSaveOk(true)
    setSaveLabel('')
    setSaving(false)
    setTimeout(() => setSaveOk(false), 2000)
    loadSnapshots()
  }

  const loadSnapshots = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('snapshots')
      .select('id, created_at, label, created_by, main_line_data, cars_data, test_areas_data, maintenance_data, weekly_data')
      .order('created_at', { ascending: false })
      .limit(30)
    setSnapshots((data as SnapshotRow[]) ?? [])
    setLoading(false)
  }

  const handleOpen = () => {
    setOpen(true)
    loadSnapshots()
  }

  const handleRestore = async () => {
    if (!restoreTarget || !password) return
    setRestoring(true)
    setRestoreError('')

    // 用登入密碼驗證身份
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    })
    if (authError) {
      setRestoreError('密碼錯誤，請重試')
      setRestoring(false)
      return
    }

    const snap = restoreTarget
    const now = new Date().toISOString()

    try {
      // 還原正線
      await supabase.from('main_line').update({
        mode: snap.main_line_data.mode,
        positions: snap.main_line_data.positions,
        updated_at: now,
      }).eq('id', 1)

      // 還原所有車廂
      await supabase.from('cars').upsert(
        snap.cars_data.map(c => ({
          id: c.id,
          type: c.type,
          status: c.status,
          is_reference: c.is_reference,
          location: c.location,
          location_slot: c.location_slot ?? null,
          notes: c.notes ?? null,
          updated_at: now,
        }))
      )

      // 還原自定義區
      for (const ta of snap.test_areas_data) {
        await supabase.from('test_areas').update({
          name: ta.name, slots: ta.slots, notes: ta.notes, updated_at: now,
        }).eq('id', ta.id)
      }

      // 還原維修排程
      for (const mu of snap.maintenance_data) {
        await supabase.from('maintenance_units').update({
          name: mu.name, car_ids: mu.car_ids, updated_at: now,
        }).eq('id', mu.id)
      }

      // 還原週排程
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      const wsUpdate: Record<string, unknown> = { updated_at: now }
      days.forEach(d => { if (d in snap.weekly_data) wsUpdate[d] = snap.weekly_data[d] })
      await supabase.from('weekly_schedule').update(wsUpdate).eq('id', 1)

      // 寫入操作日誌
      await supabase.from('operation_logs').insert({
        user_email: userEmail,
        action: '還原快照',
        detail: snap.label,
      })

      setRestoreSuccess(true)
      setRestoreTarget(null)
      setPassword('')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      setRestoreError('還原失敗，請稍後再試')
      setRestoring(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('snapshots').delete().eq('id', deleteTarget.id)
    setSnapshots(prev => prev.filter(s => s.id !== deleteTarget.id))
    setDeleting(false)
    setDeleteTarget(null)
  }

  // 依台北日期分組
  const grouped = snapshots.reduce<Record<string, SnapshotRow[]>>((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString('zh-TW', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {})

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs bg-slate-500 hover:bg-slate-400 text-white rounded px-2 py-1"
      >
        📂 記錄
      </button>

      {/* 右側滑出 Panel */}
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-80 h-full bg-white shadow-2xl flex flex-col border-l border-slate-200">

            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <span className="font-semibold text-slate-700 text-sm">📂 班次記錄</span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* 儲存快照區 */}
            <div className="px-3 py-2.5 border-b border-slate-100 bg-blue-50 flex-shrink-0">
              <div className="text-xs font-medium text-blue-700 mb-1.5">💾 儲存當前狀態</div>
              <div className="flex gap-1.5">
                <input
                  value={saveLabel}
                  onChange={e => setSaveLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                  placeholder="輸入快照名稱，如：早班交接"
                  disabled={saving || saveOk}
                  className="flex-1 text-xs bg-white border border-blue-200 rounded px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400 placeholder-slate-300 disabled:opacity-50 min-w-0"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || saveOk || !saveLabel.trim()}
                  className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded px-3 py-1.5 font-medium shrink-0"
                >
                  {saveOk ? '✓' : saving ? '…' : '儲存'}
                </button>
              </div>
              {saveOk && <p className="text-green-600 text-[10px] mt-1">已儲存！</p>}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {loading && (
                <p className="text-slate-400 text-sm text-center py-10">載入中…</p>
              )}
              {!loading && snapshots.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-10">尚無班次記錄</p>
              )}

              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div className="text-xs text-slate-400 font-medium mb-1.5 px-0.5">{date}</div>
                  <div className="space-y-2">
                    {items.map(snap => {
                      const filled = snap.main_line_data.positions.filter(Boolean).length
                      const time = new Date(snap.created_at).toLocaleTimeString('zh-TW', {
                        timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit',
                      })
                      const isPreviewing = previewId === snap.id

                      return (
                        <div key={snap.id} className="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                          <div className="font-medium text-slate-800 text-sm">{snap.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{time} · {snap.created_by}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            正線 {snap.main_line_data.mode} 車 · 已排 {filled} 台
                          </div>

                          {isPreviewing && (
                            <div className="mt-2 p-2 bg-white rounded border border-slate-200 text-xs text-slate-600 space-y-1">
                              <div>
                                轉角二站：{snap.cars_data.filter(c => c.location === 'zhuanjiaoer').length} 台 ／
                                貓空站：{snap.cars_data.filter(c => c.location === 'maokong').length} 台
                              </div>
                              <div>
                                維修排程：{snap.maintenance_data.map(m => `${m.name}(${m.car_ids.length})`).join('、') || '（無）'}
                              </div>
                              <div>
                                報廢車：{snap.cars_data.filter(c => c.status === 'scrapped').length} 台
                              </div>
                            </div>
                          )}

                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => setPreviewId(isPreviewing ? null : snap.id)}
                              className="flex-1 text-xs bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded px-2 py-1"
                            >
                              {isPreviewing ? '收起' : '預覽'}
                            </button>
                            <button
                              onClick={() => { setRestoreTarget(snap); setPassword(''); setRestoreError(''); setRestoreSuccess(false) }}
                              className="flex-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded px-2 py-1"
                            >
                              還原
                            </button>
                            <button
                              onClick={() => setDeleteTarget(snap)}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-600 rounded px-2 py-1"
                              title="刪除此筆記錄"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* 刪除確認 Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!deleting) setDeleteTarget(null) }} />
          <div className="relative z-50 bg-white rounded-xl p-6 w-72 shadow-2xl border border-slate-200">
            <div className="text-3xl mb-2 text-center">🗑️</div>
            <h3 className="font-bold text-slate-800 text-center mb-1">刪除班次記錄</h3>
            <p className="text-slate-500 text-sm text-center mb-4">
              確定要刪除「{deleteTarget.label}」？<br />刪除後無法復原。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded px-3 py-2 text-sm"
              >取消</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded px-3 py-2 text-sm font-medium"
              >
                {deleting ? '刪除中…' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 密碼確認 Dialog */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!restoring) { setRestoreTarget(null); setPassword('') } }} />
          <div className="relative z-50 bg-white rounded-xl p-6 w-80 shadow-2xl border border-slate-200">
            <div className="text-3xl mb-2 text-center">⚠️</div>
            <h3 className="font-bold text-slate-800 text-center mb-1">還原「{restoreTarget.label}」</h3>
            <p className="text-slate-500 text-sm text-center mb-4">
              這會覆蓋目前所有排班資料。<br />請輸入您的登入密碼以確認操作。
            </p>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setRestoreError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleRestore() }}
              placeholder="登入密碼"
              disabled={restoring || restoreSuccess}
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm mb-2 outline-none focus:border-orange-400 disabled:opacity-50"
            />
            {restoreError && (
              <p className="text-red-500 text-xs mb-2 text-center">{restoreError}</p>
            )}
            {restoreSuccess && (
              <p className="text-green-600 text-xs mb-2 text-center font-medium">還原成功，即將重新載入…</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setRestoreTarget(null); setPassword(''); setRestoreError('') }}
                disabled={restoring || restoreSuccess}
                className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded px-3 py-2 text-sm"
              >取消</button>
              <button
                onClick={handleRestore}
                disabled={restoring || restoreSuccess || !password}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded px-3 py-2 text-sm font-medium"
              >
                {restoring ? '驗證中…' : '確認還原'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
