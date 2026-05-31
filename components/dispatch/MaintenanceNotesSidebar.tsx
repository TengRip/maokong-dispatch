'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '@/lib/store'

export function MaintenanceNotesSidebar() {
  const { bulletin, updateBulletin, userRole } = useApp()
  const isAdmin = userRole === 'admin'
  const [val, setVal] = useState(bulletin.maintenance_notes)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setVal(bulletin.maintenance_notes) }, [bulletin.maintenance_notes])

  const handleChange = useCallback((v: string) => {
    setVal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => updateBulletin({ maintenance_notes: v }), 600)
  }, [updateBulletin])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-600">貓空站維修車活動日</span>
      <textarea
        value={val}
        onChange={e => handleChange(e.target.value)}
        disabled={!isAdmin}
        placeholder={isAdmin ? '輸入維修需求…' : '（無內容）'}
        rows={5}
        className="w-full text-base bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 outline-none focus:border-blue-400 resize-none placeholder-slate-300 disabled:bg-transparent disabled:border-transparent leading-relaxed"
      />
    </div>
  )
}
