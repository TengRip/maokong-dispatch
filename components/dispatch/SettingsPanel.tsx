'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'

type TabId = 'users' | 'crystal' | 'scrapped' | 'colors'

interface UserRecord {
  id: string
  email: string
  role: 'admin' | 'guest'
  created_at: string
}

// ── 帳號管理 ──────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'guest'>('guest')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newEmail || !newPassword) { setMsg('請填入 Email 和密碼'); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
    })
    const data = await res.json()
    setMsg(data.error ? `✗ ${data.error}` : '✓ 帳號已建立')
    if (!data.error) { setNewEmail(''); setNewPassword(''); load() }
    setAdding(false)
  }

  const handleRole = async (userId: string, role: string) => {
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) })
    load()
  }

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`確定刪除帳號 ${email}？`)) return
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-slate-600 text-xs font-semibold mb-2">現有帳號</h3>
        {loading ? <p className="text-slate-400 text-xs">載入中…</p> : (
          <div className="space-y-1.5">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <span className="flex-1 text-slate-800 text-xs">{u.email}</span>
                <select value={u.role} onChange={e => handleRole(u.id, e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded px-1 py-0.5 text-slate-700">
                  <option value="admin">admin</option>
                  <option value="guest">guest</option>
                </select>
                <button onClick={() => handleDelete(u.id, u.email || '')}
                  className="text-red-400 hover:text-red-600 text-xs">刪除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-slate-600 text-xs font-semibold mb-2">新增帳號</h3>
        <div className="space-y-2">
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email"
            className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-400" />
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="密碼（至少 6 位）"
            className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'guest')}
              className="flex-1 bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-700 text-xs">
              <option value="guest">guest（唯讀）</option>
              <option value="admin">admin（完整操作）</option>
            </select>
            <button onClick={handleAdd} disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-4 py-1.5 text-xs font-medium">
              {adding ? '建立中…' : '新增'}
            </button>
          </div>
          {msg && <p className={`text-xs ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
        </div>
      </div>
    </div>
  )
}

// ── 水晶車設定 ────────────────────────────────────────────
function CrystalTab() {
  const { cars } = useApp()
  const supabase = createClient()
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>()
    Object.values(cars).forEach(c => { if (c.type === 'crystal') s.add(c.id) })
    return s
  })
  const [saved, setSaved] = useState(false)

  const toggle = (id: string) => {
    setSaved(false)
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleSave = async () => {
    if (!confirm('確認儲存水晶車設定？')) return
    await supabase.from('cars').update({ type: 'regular' }).neq('type', 'maintenance_vehicle')
    if (selected.size > 0)
      await supabase.from('cars').update({ type: 'crystal' }).in('id', Array.from(selected))
    setSaved(true)
  }

  const ids = Array.from({ length: 147 }, (_, i) => String(i + 1))

  return (
    <div>
      <p className="text-slate-500 text-xs mb-1">點選車號切換水晶車（黃色），可修改後重新儲存。</p>
      <p className="text-slate-400 text-[10px] mb-3">已選 {selected.size} 台水晶車</p>
      <div className="flex flex-wrap gap-1 mb-4 max-h-[280px] overflow-y-auto pr-1">
        {ids.map(id => (
          <button key={id} onClick={() => toggle(id)}
            className={`w-9 h-7 rounded text-xs font-bold border transition-colors ${
              selected.has(id) ? 'bg-yellow-400 border-yellow-500 text-black' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}>{id}</button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="bg-yellow-500 hover:bg-yellow-600 text-white rounded px-4 py-1.5 text-xs font-medium">儲存水晶車設定</button>
        {saved && <span className="text-green-600 text-xs">✓ 已儲存</span>}
      </div>
    </div>
  )
}

// ── 報廢車管理 ────────────────────────────────────────────
function ScrappedTab() {
  const { cars } = useApp()
  const supabase = createClient()
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>()
    Object.values(cars).forEach(c => { if (c.status === 'scrapped') s.add(c.id) })
    return s
  })
  const [saved, setSaved] = useState(false)

  const toggle = (id: string) => {
    setSaved(false)
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleSave = async () => {
    if (selected.size > 0 && !confirm(`確認將 ${selected.size} 台設為報廢車（強制封鎖上線）？`)) return
    // 先清除所有報廢
    await supabase.from('cars').update({ status: 'available' }).eq('status', 'scrapped')
    // 設定選中的
    if (selected.size > 0)
      await supabase.from('cars').update({ status: 'scrapped' }).in('id', Array.from(selected))
    setSaved(true)
  }

  const ids = Array.from({ length: 147 }, (_, i) => String(i + 1))

  return (
    <div>
      <p className="text-slate-500 text-xs mb-1">點選車號設為報廢車（黑色），報廢車強制無法上線。</p>
      <p className="text-slate-400 text-[10px] mb-3">已選 {selected.size} 台報廢車</p>
      <div className="flex flex-wrap gap-1 mb-4 max-h-[280px] overflow-y-auto pr-1">
        {ids.map(id => (
          <button key={id} onClick={() => toggle(id)}
            className={`w-9 h-7 rounded text-xs font-bold border transition-colors ${
              selected.has(id) ? 'bg-gray-800 border-gray-900 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}>{id}</button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="bg-gray-700 hover:bg-gray-800 text-white rounded px-4 py-1.5 text-xs font-medium">儲存報廢設定</button>
        {saved && <span className="text-green-600 text-xs">✓ 已儲存</span>}
      </div>
    </div>
  )
}

// ── 狀態顏色 ──────────────────────────────────────────────
function ColorsTab() {
  const { statusColors } = useApp()
  const supabase = createClient()
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
    await supabase.from('status_colors').update({ ...colors, updated_at: new Date().toISOString() }).eq('id', 1)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="space-y-2 mb-4">
        {Object.entries(labels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="flex-1 text-slate-600 text-xs">{label}</span>
            <div className="flex items-center gap-2">
              <input type="color" value={(colors as Record<string, string>)[key] || '#ffffff'}
                onChange={e => { setSaved(false); setColors(p => ({ ...p, [key]: e.target.value })) }}
                className="w-8 h-7 rounded cursor-pointer border border-slate-300" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-xs font-medium">儲存顏色</button>
        {saved && <span className="text-green-600 text-xs">✓ 已儲存</span>}
      </div>
    </div>
  )
}

// ── 主面板 ────────────────────────────────────────────────
export function SettingsPanel() {
  const { userRole } = useApp()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('users')

  if (userRole !== 'admin') return null

  const tabs: { id: TabId; label: string }[] = [
    { id: 'users', label: '帳號管理' },
    { id: 'crystal', label: '水晶車' },
    { id: 'scrapped', label: '報廢車' },
    { id: 'colors', label: '狀態顏色' },
  ]

  return (
    <>
      <button onClick={() => setOpen(true)} title="系統設定"
        className="text-slate-300 hover:text-white text-lg leading-none px-2 py-1 rounded hover:bg-slate-600 transition-colors">⚙</button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[540px] max-h-[82vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-slate-800 font-bold">系統設定</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="flex border-b border-slate-200 px-5 gap-0.5 pt-2">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${
                    tab === t.id ? 'bg-slate-100 text-slate-800 border border-b-0 border-slate-200' : 'text-slate-500 hover:text-slate-700'
                  }`}>{t.label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-white">
              {tab === 'users' && <UsersTab />}
              {tab === 'crystal' && <CrystalTab />}
              {tab === 'scrapped' && <ScrappedTab />}
              {tab === 'colors' && <ColorsTab />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
