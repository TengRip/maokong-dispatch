'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { StorageArea } from './StorageArea'
import { MainLineLoop } from './MainLineLoop'

// 收折時顯示的窄欄（仍保持 zhuanjiaoer 可拖入）
function CollapsedStorageStrip() {
  const { cars } = useApp()
  const { isOver, setNodeRef } = useDroppable({
    id: 'storage_zhuanjiaoer',
    data: { location: 'zhuanjiaoer' },
  })
  const count = Object.values(cars).filter(c => c.location === 'zhuanjiaoer').length

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col items-center justify-start pt-3 gap-2 transition-colors ${isOver ? 'bg-blue-50' : ''}`}
    >
      <span className="text-[8px] text-slate-500 font-semibold" style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>
        轉角二站
      </span>
      <span className="text-xs text-slate-700 font-bold bg-slate-100 rounded w-6 h-6 flex items-center justify-center">
        {count}
      </span>
      {isOver && (
        <span className="text-[7px] text-blue-500 font-medium" style={{ writingMode: 'vertical-rl' }}>放開</span>
      )}
    </div>
  )
}

export function MainLayout() {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* 左側側欄 */}
      <div className={`flex-shrink-0 flex flex-col border-r border-slate-300 bg-white ${open ? 'w-52' : 'w-9'}`}>

        {/* 收折按鈕 */}
        <button
          onClick={() => setOpen(v => !v)}
          title={open ? '收折側欄' : '展開側欄'}
          className="flex-shrink-0 h-7 flex items-center justify-center border-b border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 text-xs transition-colors"
        >
          {open ? '◀' : '▶'}
        </button>

        {open ? (
          <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
            <StorageArea location="zhuanjiaoer" label="轉角二站 儲車區" maxSlots={40} collapsible />
          </div>
        ) : (
          <CollapsedStorageStrip />
        )}

      </div>

      {/* 中央：正線迴圈 */}
      <div className="flex-1 flex items-start justify-start p-4 overflow-auto bg-slate-100">
        <MainLineLoop />
      </div>

    </div>
  )
}
