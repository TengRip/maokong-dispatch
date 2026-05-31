'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { getCarOccupiedLabel } from '@/lib/utils'
import { CarTag } from './CarTag'

const DAYS = [
  { key: 'monday', label: '一' },
  { key: 'tuesday', label: '二' },
  { key: 'wednesday', label: '三' },
  { key: 'thursday', label: '四' },
  { key: 'friday', label: '五' },
]

function WeeklySlot({ day, index, carId, onWarn }: {
  day: string; index: number; carId: string | null; onWarn: (msg: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `weekly_${day}_${index}`,
    data: { location: 'weekly_schedule', day, slot: index },
  })
  const { userRole, weeklySchedule, updateWeeklySchedule, cars, mainLine, testAreas, moveCar } = useApp()
  const isAdmin = userRole === 'admin'

  const handleClick = async () => {
    if (!isAdmin) return
    const input = window.prompt('輸入車號（清空請留白）', carId ?? '')
    if (input === null) return
    const val = input.trim().toUpperCase() || null
    const existing = weeklySchedule[day] ?? []
    const slots = Array.from({ length: 14 }, (_, i) => existing[i] ?? null) as (string | null)[]

    if (!val) {
      // 清空：把原本的車歸回儲車區
      slots[index] = null
      await updateWeeklySchedule(day, slots)
      if (carId) await moveCar(carId, 'zhuanjiaoer', undefined, 'weekly_schedule')
      return
    }

    if (!cars[val]) { onWarn(`找不到車號 ${val}`); return }

    // 檢查是否已在同一週排程欄的其他格
    if (slots.includes(val) && slots.indexOf(val) !== index) {
      onWarn(`${val} 已在週${DAYS.find(d => d.key === day)?.label ?? day}排程的其他格，無法重複放入`); return
    }

    // 檢查是否已在其他排班區
    const occupied = getCarOccupiedLabel(val, mainLine, testAreas, weeklySchedule, undefined, day)
    if (occupied) { onWarn(`${val} 目前在${occupied}，請先將其移回儲車區`); return }

    slots[index] = val
    await updateWeeklySchedule(day, slots)
    // 同步更新 cars.location
    await moveCar(val, 'weekly_schedule', undefined, cars[val].location)
  }

  return (
    <div ref={setNodeRef}
      className={`w-12 h-9 flex items-center justify-center rounded border text-xs cursor-default
        ${isOver ? 'border-purple-400 bg-purple-50' : carId ? 'border-slate-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`}
    >
      {carId ? (
        <CarTag carId={carId} draggableId={`weekly_${day}_${index}_${carId}`} compact />
      ) : (
        <button onClick={handleClick}
          className={`w-full h-full flex items-center justify-center text-slate-300 text-xs ${isAdmin ? 'hover:text-slate-500 hover:bg-slate-100 cursor-pointer' : ''}`}
          title={isAdmin ? '點擊輸入車號' : ''}
        >+</button>
      )}
    </div>
  )
}

export function WeeklySchedulePanel() {
  const { weeklySchedule } = useApp()
  const [warnMsg, setWarnMsg] = useState('')

  return (
    <div>
      <div className="text-slate-600 text-base font-semibold mb-2">週排程區</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map(({ key, label }) => {
          const slots: (string | null)[] = Array.from({ length: 14 }, (_, i) => (weeklySchedule[key] ?? [])[i] ?? null)
          return (
            <div key={key} className="flex-shrink-0">
              <div className="text-slate-500 text-xs text-center mb-1 font-semibold">週{label}</div>
              <div className="flex flex-col gap-1">
                {slots.map((carId, i) => (
                  <WeeklySlot key={i} day={key} index={i} carId={carId} onWarn={setWarnMsg} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {warnMsg && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-72 border border-slate-200 shadow-xl text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-slate-800 font-medium text-sm mb-5">{warnMsg}</p>
            <button onClick={() => setWarnMsg('')}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded px-5 py-2 text-sm font-medium">確認</button>
          </div>
        </div>
      )}
    </div>
  )
}
