'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '@/lib/store'

export function BulletinBoard() {
  const { bulletin, updateBulletin, userRole } = useApp()
  const isAdmin = userRole === 'admin'

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(bulletin.title)
  const [dateVal, setDateVal] = useState(bulletin.date)
  const [contentVal, setContentVal] = useState(bulletin.content)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 同步其他人的 realtime 修改
  useEffect(() => { setTitleVal(bulletin.title) }, [bulletin.title])
  useEffect(() => { setDateVal(bulletin.date) }, [bulletin.date])
  useEffect(() => { setContentVal(bulletin.content) }, [bulletin.content])

  const debouncedSave = useCallback((updates: Parameters<typeof updateBulletin>[0]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => updateBulletin(updates), 600)
  }, [updateBulletin])

  const saveTitle = () => {
    setEditingTitle(false)
    const next = titleVal.trim() || '佈告欄'
    if (next !== bulletin.title) updateBulletin({ title: next })
    else setTitleVal(bulletin.title)
  }

  return (
    <div className="bg-amber-50 rounded-lg border border-amber-200 p-2 w-full flex flex-col gap-1.5">

      {/* 標題列 */}
      <div className="flex items-center gap-1 border-b border-amber-200 pb-1.5">
        {editingTitle ? (
          <input
            autoFocus
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') { setTitleVal(bulletin.title); setEditingTitle(false) }
            }}
            className="flex-1 text-xs bg-white text-slate-900 px-1.5 py-0.5 rounded outline-none border border-amber-400"
          />
        ) : (
          <>
            <span className="flex-1 text-xs font-bold text-amber-800">📋 {bulletin.title}</span>
            {isAdmin && (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-[10px] text-amber-400 hover:text-amber-600"
                title="改名"
              >✏</button>
            )}
          </>
        )}
      </div>

      {/* 日期 */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-amber-600 shrink-0 font-medium">日期</span>
        <input
          value={dateVal}
          onChange={e => { setDateVal(e.target.value); debouncedSave({ date: e.target.value }) }}
          placeholder="如：5/29 AM"
          disabled={!isAdmin}
          className="flex-1 text-[10px] bg-white border border-amber-200 rounded px-1.5 py-0.5 text-slate-700 outline-none focus:border-amber-400 placeholder-amber-300 disabled:bg-transparent disabled:border-transparent min-w-0"
        />
      </div>

      {/* 交接事項 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-amber-600 font-medium">交接事項</span>
        <textarea
          value={contentVal}
          onChange={e => { setContentVal(e.target.value); debouncedSave({ content: e.target.value }) }}
          placeholder={isAdmin ? '輸入交接備註…' : '（無內容）'}
          disabled={!isAdmin}
          rows={8}
          className="w-full text-[10px] bg-white border border-amber-200 rounded px-1.5 py-1 text-slate-700 outline-none focus:border-amber-400 resize-none placeholder-amber-300 disabled:bg-transparent disabled:border-transparent leading-relaxed"
        />
      </div>

    </div>
  )
}
