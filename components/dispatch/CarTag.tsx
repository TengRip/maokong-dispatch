'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable } from '@dnd-kit/core'
import { useApp, useCarColor } from '@/lib/store'

interface CarTagProps {
  carId: string
  draggableId?: string
  compact?: boolean
  noContextMenu?: boolean  // 用於維修排程等「標示用途」，不開右鍵選單
}

const STATUS_LABELS: Record<string, string> = {
  available:    '✅ 可用',
  unavailable:  '🔴 不可用',
  controlled:   '🟠 管控',
  other:        '🟢 其他',
}

export function CarTag({ carId, draggableId, compact = false, noContextMenu = false }: CarTagProps) {
  const {
    cars, mainLine, testAreas, weeklySchedule,
    userRole, moveCar, updateCarStatus, setReferencecar,
    updateMainLinePosition, updateTestArea, updateWeeklySchedule,
    highlightedCarId,
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

  const handleStatus = async (status: 'available' | 'unavailable' | 'controlled' | 'other') => {
    setMenu(null)
    await updateCarStatus(carId, status)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        {...(isAdmin ? { ...listeners, ...attributes } : {})}
        onContextMenu={handleContextMenu}
        style={{
          backgroundColor: color,
          color: textColor,
          opacity: isDragging ? 0.4 : 1,
          cursor: isAdmin ? 'grab' : 'default',
        }}
        className={`
          relative inline-flex items-center justify-center rounded-sm font-bold select-none
          border border-white/20 shadow-sm transition-opacity
          ${compact ? 'text-xs w-full h-full' : 'text-sm px-2 py-1 min-w-[2.5rem]'}
          ${isDragging ? 'z-50' : ''}
          ${highlightedCarId === carId ? 'car-highlight' : ''}
        `}
      >
        {carId}
        {car.is_reference && (
          <span className="absolute -top-2 -right-1.5 text-sm leading-none text-yellow-400 font-black drop-shadow">★</span>
        )}
      </div>

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
