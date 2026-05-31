'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '@/lib/store'

const FS_KEY = 'maokong_bulletin_fontsize'
const FS_MIN = 10
const FS_MAX = 22
const FS_DEFAULT = 14

export function BulletinBoard() {
  const { bulletin, updateBulletin, userRole } = useApp()
  const isAdmin = userRole === 'admin'

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(bulletin.title)
  const [contentVal, setContentVal] = useState(bulletin.content)
  const [fontSize, setFontSize] = useState(FS_DEFAULT)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(FS_KEY)
    if (saved) setFontSize(Number(saved))
  }, [])

  useEffect(() => { setTitleVal(bulletin.title) }, [bulletin.title])
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

  const changeFontSize = (delta: number) => {
    setFontSize(prev => {
      const next = Math.min(FS_MAX, Math.max(FS_MIN, prev + delta))
      localStorage.setItem(FS_KEY, String(next))
      return next
    })
  }

  return (
    <div className="bg-amber-50 rounded-lg border border-amber-200 p-2 flex flex-col gap-1.5 w-full h-full" style={{ resize: 'vertical', overflow: 'auto', minWidth: 144, minHeight: 120 }}>

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
            <span className="flex-1 text-base font-bold text-amber-800">📋 {bulletin.title}</span>
            {isAdmin && (
              <button onClick={() => setEditingTitle(true)} className="text-xs text-amber-400 hover:text-amber-600" title="改名">✏</button>
            )}
          </>
        )}

        {/* 字級調整 */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => changeFontSize(-1)}
            disabled={fontSize <= FS_MIN}
            className="w-5 h-5 flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded text-sm leading-none disabled:opacity-30"
            title="縮小字體"
          >−</button>
          <span className="text-[10px] text-amber-500 w-6 text-center">{fontSize}</span>
          <button
            onClick={() => changeFontSize(1)}
            disabled={fontSize >= FS_MAX}
            className="w-5 h-5 flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded text-sm leading-none disabled:opacity-30"
            title="放大字體"
          >+</button>
        </div>
      </div>

      {/* 交接事項 */}
      <div className="flex flex-col gap-0.5 flex-1 min-h-0">
        <span className="text-xs text-amber-600 font-medium">交接事項</span>
        <textarea
          value={contentVal}
          onChange={e => { setContentVal(e.target.value); debouncedSave({ content: e.target.value }) }}
          placeholder={isAdmin ? '輸入交接備註…' : '（無內容）'}
          disabled={!isAdmin}
          style={{ fontSize }}
          className="w-full flex-1 min-h-0 bg-white border border-amber-200 rounded px-1.5 py-1 text-slate-700 outline-none focus:border-amber-400 resize-none placeholder-amber-300 disabled:bg-transparent disabled:border-transparent leading-relaxed"
        />
      </div>

    </div>
  )
}
