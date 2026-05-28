'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'

type TabId = 'users' | 'crystal' | 'colors'

interface UserRecord {
  id: string
  email: string
  role: 'admin' | 'guest'
  created_at: string
  last_sign_in_at?: string
}

// ── 帳號管理 Tab ──────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'guest'>('guest')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleAdd = async () => {
    if (!newEmail || !newPassword) { setMsg('請填入 Email 和密碼'); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
    })
    const data = await res.json()
    if (data.error) { setMsg(data.error) } else {
      setMsg('✓ 帳號已建立')
      setNewEmail(''); setNewPassword(''); setNewRole('guest')
      loadUsers()
    }
    setAdding(false)
  }

  const handleRoleChange = async (userId: string, role: 'admin' | 'guest') => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    loadUsers()
  }

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`確定要刪除帳號 ${email} 嗎？`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    loadUsers()
  }

  return (
    <div className="space-y-4">
      {/* 現有帳號 */}
      <div>
        <h3 className="text-slate-300 text-xs font-medium mb-2">現有帳號</h3>
        {loading ? (
          <p className="text-slate-500 text-xs">載入中…</p>
        ) : (
          <div className="space-y-1">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-slate-800 rounded px-3 py-2">
                <span className="flex-1 text-white text-xs">{u.email}</span>
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value as 'admin' | 'guest')}
                  className="text-xs bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-slate-200"
                >
                  <option value="admin">admin</option>
                  <option value="guest">guest</option>
                </select>
                <button
                  onClick={() => handleDelete(u.id, u.email || '')}
                  className="text-red-500 hover:text-red-400 text-xs px-1"
                >刪除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增帳號 */}
      <div className="border-t border-slate-700 pt-4">
        <h3 className="text-slate-300 text-xs font-medium mb-2">新增帳號</h3>
        <div className="space-y-2">
          <input
            value={newEmail} onChange={e => setNewEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
          />
          <input
            type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="密碼（至少 6 位）"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <select
              value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'guest')}
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs"
            >
              <option value="guest">guest（唯讀）</option>
              <option value="admin">admin（完整操作）</option>
            </select>
            <button
              onClick={handleAdd} disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-4 py-1.5 text-xs font-medium"
            >{adding ? '建立中…' : '新增'}</button>
          </div>
          {msg && <p className={`text-xs ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
        </div>
      </div>
    </div>
  )
}

// ── 水晶車設定 Tab ────────────────────────────────────────
function CrystalTab() {
  const { cars, updateCarStatus } = useApp()
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => {
    const s = new Set<string>()
    Object.values(cars).forEach(c => { if (c.type === 'crystal') s.add(c.id) })
    return s
  })
  const [saved, setSaved] = useState(false)

  const toggle = (id: string) => {
    setSaved(false)
    setPendingIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    const confirmed = confirm('水晶車設定後通常不變更，確認儲存嗎？')
    if (!confirmed) return

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    // 所有車先設為 regular，再把選中的設為 crystal
    await supabase.from('cars').update({ type: 'regular' }).neq('type', 'maintenance_vehicle')
    if (pendingIds.size > 0) {
      await supabase.from('cars').update({ type: 'crystal' }).in('id', Array.from(pendingIds))
    }
    setSaved(true)
  }

  const allIds = Array.from({ length: 147 }, (_, i) => String(i + 1))

  return (
    <div>
      <p className="text-slate-400 text-xs mb-3">點選車號標記為水晶車（黃色），再次點選取消。</p>
      <div className="flex flex-wrap gap-1 mb-4 max-h-[300px] overflow-y-auto">
        {allIds.map(id => {
          const isCrystal = pendingIds.has(id)
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`w-9 h-7 rounded text-xs font-bold border transition-colors ${
                isCrystal
                  ? 'bg-yellow-500 border-yellow-400 text-black'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
            >{id}</button>
          )
        })}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-slate-500 text-xs">已選 {pendingIds.size} 台水晶車</span>
        <button
          onClick={handleSave}
          className="bg-yellow-600 hover:bg-yellow-700 text-white rounded px-4 py-1.5 text-xs font-medium"
        >確認儲存</button>
        {saved && <span className="text-green-400 text-xs">✓ 已儲存</span>}
      </div>
    </div>
  )
}

// ── 狀態顏色 Tab ──────────────────────────────────────────
function ColorsTab() {
  const { statusColors } = useApp()
  const [colors, setColors] = useState({ ...statusColors })
  const [saved, setSaved] = useState(false)

  const labels: Record<string, string> = {
    available_regular: '可用車（一般車）',
    available_crystal: '可用車（水晶車）',
    maintenance_vehicle: '維修車',
    unavailable: '不可用車',
    scrapped: '報廢車',
    controlled: '管控車',
    maintenance_needed: '有維修需求',
    other: '其他',
  }

  const handleSave = async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.from('status_colors').update({ ...colors, updated_at: new Date().toISOString() }).eq('id', 1)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="space-y-2 mb-4">
        {Object.entries(labels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <label className="flex-1 text-slate-300 text-xs">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(colors as Record<string, string>)[key] || '#ffffff'}
                onChange={e => { setSaved(false); setColors(prev => ({ ...prev, [key]: e.target.value })) }}
                className="w-8 h-7 rounded cursor-pointer border border-slate-600"
              />
              <span className="text-slate-500 text-[10px] w-16">{(colors as Record<string, string>)[key]}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-xs font-medium"
        >儲存顏色</button>
        {saved && <span className="text-green-400 text-xs">✓ 已儲存</span>}
      </div>
    </div>
  )
}

// ── 主面板 ─────────────────────────────────────────────────
export function SettingsPanel() {
  const { userRole } = useApp()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('users')

  if (userRole !== 'admin') return null

  const tabs: { id: TabId; label: string }[] = [
    { id: 'users', label: '帳號管理' },
    { id: 'crystal', label: '水晶車設定' },
    { id: 'colors', label: '狀態顏色' },
  ]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="系統設定"
        className="text-slate-400 hover:text-white text-lg leading-none px-2 py-1 rounded hover:bg-slate-700 transition-colors"
      >⚙</button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
            {/* 標題列 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="text-white font-bold">系統設定</h2>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Tab 列 */}
            <div className="flex border-b border-slate-700 px-5 gap-1 pt-2">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${
                    tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >{t.label}</button>
              ))}
            </div>

            {/* 內容 */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'users' && <UsersTab />}
              {tab === 'crystal' && <CrystalTab />}
              {tab === 'colors' && <ColorsTab />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
