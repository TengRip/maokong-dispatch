'use client'

import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { StorageArea } from './StorageArea'
import { RetiredArea } from './RetiredArea'
import { MainLineLoop } from './MainLineLoop'
import { MaintenanceNotesSidebar } from './MaintenanceNotesSidebar'

// 收折時顯示的窄欄（兩個儲車區都保持可拖入）
function CollapsedStorageStrip() {
  const { cars } = useApp()
  const { isOver: isOverZje, setNodeRef: zjeRef } = useDroppable({
    id: 'storage_zhuanjiaoer',
    data: { location: 'zhuanjiaoer' },
  })
  const { isOver: isOverMk, setNodeRef: mkRef } = useDroppable({
    id: 'storage_maokong',
    data: { location: 'maokong' },
  })
  const countZje = Object.values(cars).filter(c => c.location === 'zhuanjiaoer').length
  const countMk = Object.values(cars).filter(c => c.location === 'maokong').length

  return (
    <div className="flex-1 flex flex-col">
      <div
        ref={zjeRef}
        className={`flex-1 flex flex-col items-center justify-start pt-3 gap-2 transition-colors ${isOverZje ? 'bg-blue-50' : ''}`}
      >
        <span className="text-[8px] text-slate-500 font-semibold" style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>
          轉角二站
        </span>
        <span className="text-xs text-slate-700 font-bold bg-slate-100 rounded w-6 h-6 flex items-center justify-center">
          {countZje}
        </span>
        {isOverZje && (
          <span className="text-[7px] text-blue-500 font-medium" style={{ writingMode: 'vertical-rl' }}>放開</span>
        )}
      </div>
      <div className="border-t border-slate-200 mx-1" />
      <div
        ref={mkRef}
        className={`flex-1 flex flex-col items-center justify-start pt-3 gap-2 transition-colors ${isOverMk ? 'bg-blue-50' : ''}`}
      >
        <span className="text-[8px] text-slate-500 font-semibold" style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>
          貓空站
        </span>
        <span className="text-xs text-slate-700 font-bold bg-slate-100 rounded w-6 h-6 flex items-center justify-center">
          {countMk}
        </span>
        {isOverMk && (
          <span className="text-[7px] text-blue-500 font-medium" style={{ writingMode: 'vertical-rl' }}>放開</span>
        )}
      </div>
    </div>
  )
}

export function MainLayout() {
  const [open, setOpen] = useState(true)
  const centerRef = useRef<HTMLDivElement>(null)
  const [centerSize, setCenterSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = centerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setCenterSize({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* 左側側欄 */}
      <div className={`flex-shrink-0 flex flex-col border-r border-slate-300 bg-white ${open ? 'w-40' : 'w-9'}`}>

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
            <StorageArea location="zhuanjiaoer" label="轉角二站 儲車區" collapsible />
            <StorageArea location="maokong" label="貓空站 儲車區" collapsible />
            <MaintenanceNotesSidebar />
            <RetiredArea />
          </div>
        ) : (
          <CollapsedStorageStrip />
        )}

      </div>

      {/* 中央：正線迴圈，依容器高寬自動縮放 */}
      <div ref={centerRef} className="flex-1 flex items-start justify-start p-4 overflow-auto bg-slate-100">
        <MainLineLoop availableHeight={centerSize.height} availableWidth={centerSize.width} />
      </div>

    </div>
  )
}
