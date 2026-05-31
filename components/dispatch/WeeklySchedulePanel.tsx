'use client'

import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

const DAYS = [
  { key: 'monday', label: '一' },
  { key: 'tuesday', label: '二' },
  { key: 'wednesday', label: '三' },
  { key: 'thursday', label: '四' },
  { key: 'friday', label: '五' },
]

function WeeklySlot({ day, index, carId }: { day: string; index: number; carId: string | null }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `weekly_${day}_${index}`,
    data: { location: 'weekly_schedule', day, slot: index },
  })
  const { userRole, weeklySchedule, updateWeeklySchedule } = useApp()
  const isAdmin = userRole === 'admin'

  const handleClick = async () => {
    if (!isAdmin) return
    const input = window.prompt('輸入車號（清空請留白）', carId ?? '')
    if (input === null) return
    const val = input.trim().toUpperCase() || null
    const existing = weeklySchedule[day] ?? []
    const slots = Array.from({ length: 14 }, (_, i) => existing[i] ?? null) as (string | null)[]
    slots[index] = val
    await updateWeeklySchedule(day, slots)
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
                  <WeeklySlot key={i} day={key} index={i} carId={carId} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
