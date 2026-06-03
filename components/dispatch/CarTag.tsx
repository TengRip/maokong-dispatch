'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable } from '@dnd-kit/core'
import { useApp, useCarColor } from '@/lib/store'

interface CarTagProps {
  carId: string
  draggableId?: string
  compact?: boolean
  noContextMenu?: boolean  // 用於維修排程等「標示用途」，不開右鍵選單
  mainLine?: boolean       // 正線格子：字體加大
}

const STATUS_LABELS: Record<string, string> = {
  available:    '✅ 可用',
  unavailable:  '🔴 不可用',
  controlled:   '🟠 管控',
  other:        '🟢 其他',
}

export function CarTag({ carId, draggableId, compact = false, noContextMenu = false, mainLine = false }: CarTagProps) {
  const {
    cars, mainLine, testAreas, weeklySchedule,
    userRole, moveCar, updateCarStatus, setReferencecar,
    updateMainLinePosition, updateTestArea, updateWeeklySchedule,
    highlightedCarIds, updateCarNotes,
  } = useApp()
  const color = useCarColor(carId)
  const car = cars[carId]
  const isAdmin = userRole === 'admin'

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId ?? `car-${carId}`,
    data: { carId },
    disabled: !isAdmin,
  })

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [showNotesDialog, setShowNotesDialog] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [noteTooltipPos, setNoteTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const initialNoteRef = useRef('')   // 記錄開啟 dialog 當下的備註，決定是否顯示刪除按鈕

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [menu])

  if (!car) return null

  const textColor = isLightColor(color) ? '#000' : '#fff'

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isAdmin || noContextMenu) return
    e.preventDefault()
    e.stopPropagation()
    const MENU_W = 168
    const MENU_H = 260
    const x = e.clientX + MENU_W > window.innerWidth  ? e.clientX - MENU_W : e.clientX + 2
    const y = e.clientY + MENU_H > window.innerHeight ? e.clientY - MENU_H : e.clientY + 2
    setMenu({ x, y })
  }

  const handleMoveToStorage = async () => {
    setMenu(null)
    // 依來源清除原槽位
    if (car.location === 'main_line') {
      const slot = mainLine.positions.indexOf(carId)
      if (slot !== -1) await updateMainLinePosition(slot, null)
    } else if (car.location === 'test_area') {
      const fromArea = testAreas.find(a => a.slots.includes(carId))
      if (fromArea) {
        const newSlots = [...fromArea.slots] as (string | null)[]
        const idx = newSlots.indexOf(carId)
        if (idx !== -1) { newSlots[idx] = null; await updateTestArea(fromArea.id, { slots: newSlots }) }
      }
    } else if (car.location === 'weekly_schedule') {
      // 清除該車廂在所有週排程天數中的全部出現（含重複），不用 break
      for (const [day, slots] of Object.entries(weeklySchedule)) {
        const daySlots = slots as (string | null)[]
        if (daySlots.includes(carId)) {
          const newSlots = daySlots.map(s => (s === carId ? null : s))
          await updateWeeklySchedule(day, newSlots)
        }
      }
    }
    await moveCar(carId, 'zhuanjiaoer', undefined, car.location)
  }

  const handleSetReference = async () => {
    setMenu(null)
    await setReferencecar(carId, car.is_reference)
  }

  const handleOpenNotesEdit = () => {
    setMenu(null)
    const existing = car.notes ?? ''
    setNoteInput(existing)
    initialNoteRef.current = existing
    setShowNotesDialog(true)
  }

  const handleSaveNotes = async () => {
    setShowNotesDialog(false)
    await updateCarNotes(carId, noteInput.trim())
  }

  const handleStatus = async (status: 'available' | 'unavailable' | 'controlled' | 'other') => {
    setMenu(null)
    await updateCarStatus(carId, status)
  }

  return (
    <>
      <div
        ref={(el) => { setNodeRef(el); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el }}
        {...(isAdmin ? { ...listeners, ...attributes } : {})}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => {
          if (!car.notes || !cardRef.current) return
          const r = cardRef.current.getBoundingClientRect()
          setNoteTooltipPos({ x: r.left + r.width / 2, y: r.top - 6 })
        }}
        onMouseLeave={() => setNoteTooltipPos(null)}
        style={{
          backgroundColor: color,
          color: textColor,
          opacity: isDragging ? 0.4 : 1,
          cursor: isAdmin ? 'grab' : 'default',
        }}
        className={`
          relative inline-flex items-center justify-center rounded-sm font-bold select-none
          border border-white/20 shadow-sm transition-opacity
          ${compact ? `${mainLine ? 'text-base' : 'text-sm'} w-full h-full` : 'text-xs px-2 py-1 min-w-[2.5rem]'}
          ${isDragging ? 'z-50' : ''}
          ${highlightedCarIds.includes(carId) ? 'car-highlight' : ''}
        `}
      >
        {carId}
        {car.is_reference && (
          <span
            className="absolute -top-2.5 -right-2 text-base leading-none font-black"
            style={{ color: '#ef4444', filter: 'drop-shadow(0 0 3px white) drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)' }}
          >★</span>
        )}
        {car.notes && (
          <span className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-orange-400 z-10 pointer-events-none" />
        )}
      </div>

      {/* 備註懸停氣泡 */}
      {noteTooltipPos && car.notes && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: noteTooltipPos.x,
            top: noteTooltipPos.y,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 9998,
            maxWidth: 220,
            pointerEvents: 'none',
          }}
          className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-pre-wrap"
        >
          <span className="text-orange-300 font-semibold text-[10px] block mb-0.5">📝 {carId}</span>
          {car.notes}
        </div>,
        document.body
      )}

      {/* 備註編輯 Dialog */}
      {showNotesDialog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-80 border border-slate-200 shadow-xl">
            <h3 className="text-slate-800 font-bold mb-3">車號 {carId} 備註</h3>
            <textarea
              autoFocus
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNotes() }}
              placeholder="輸入備註… (Ctrl+Enter 儲存)"
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm mb-3 focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
            <div className="flex gap-2 mb-2">
              <button onClick={handleSaveNotes}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 text-sm font-medium">
                儲存
              </button>
              <button onClick={() => setShowNotesDialog(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-3 py-2 text-sm">
                取消
              </button>
            </div>
            {initialNoteRef.current && (
              <button
                onClick={() => { initialNoteRef.current = ''; setShowNotesDialog(false); updateCarNotes(carId, '') }}
                className="w-full bg-red-500 hover:bg-red-600 text-white rounded px-3 py-2 text-sm font-medium"
              >
                🗑️ 刪除備註
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 右鍵選單（portal 掛在 body，避免 stacking context 問題） */}
      {menu && isAdmin && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[160px] text-slate-800"
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          {/* 車號標題 */}
          <div className="px-3 py-1 text-[10px] text-slate-400 border-b border-slate-100 mb-1 font-semibold">
            車號 {carId}
          </div>

          {/* 移至轉角二站（已在轉角二站則反白停用） */}
          <button
            onClick={car.location !== 'zhuanjiaoer' ? handleMoveToStorage : undefined}
            disabled={car.location === 'zhuanjiaoer'}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2
              ${car.location === 'zhuanjiaoer'
                ? 'text-slate-300 cursor-not-allowed'
                : 'hover:bg-blue-50 hover:text-blue-700'}`}
          >
            ← 移至轉角二站
          </button>

          {/* 設為/取消基準車 */}
          <button
            onClick={handleSetReference}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-yellow-50 hover:text-yellow-700 flex items-center gap-2"
          >
            {car.is_reference ? '☆ 取消基準車' : '★ 設為基準車'}
          </button>

          {/* 備註 */}
          <button
            onClick={handleOpenNotesEdit}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2"
          >
            ✏️ {car.notes ? '編輯備註' : '新增備註'}
            {car.notes && <span className="ml-auto text-[9px] text-orange-400 truncate max-w-[80px]">{car.notes}</span>}
          </button>

          {/* 狀態切換 */}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <div className="px-3 py-0.5 text-[10px] text-slate-400">狀態</div>
            {(Object.entries(STATUS_LABELS) as [keyof typeof STATUS_LABELS, string][]).map(([s, label]) => (
              <button
                key={s}
                onClick={() => handleStatus(s as 'available' | 'unavailable' | 'controlled' | 'other')}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 flex items-center gap-2
                  ${car.status === s ? 'font-bold text-slate-900' : 'text-slate-600'}`}
              >
                {label}
                {car.status === s && <span className="ml-auto text-[9px] text-slate-400">目前</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.substr(0, 2), 16)
  const g = parseInt(h.substr(2, 2), 16)
  const b = parseInt(h.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}
