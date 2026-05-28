'use client'

import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

const DAYS = [
  { key: 'monday', label: '週一' },
  { key: 'tuesday', label: '週二' },
  { key: 'wednesday', label: '週三' },
  { key: 'thursday', label: '週四' },
  { key: 'friday', label: '週五' },
]

function WeeklySlot({ day, index, carId }: { day: string; index: number; carId: string | null }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `weekly_${day}_${index}`,
    data: { location: 'weekly_schedule', day, slot: index },
  })
  const { userRole, weeklySchedule, updateWeeklySchedule } = useApp()
  const isAdmin = userRole === 'admin'

  const handleDoubleClick = async () => {
    if (!isAdmin) return
    const input = window.prompt('輸入車號（清空請留白）', carId ?? '')
    if (input === null) return
    const val = input.trim().toUpperCase() || null
    const slots = [...(weeklySchedule[day] ?? Array(10).fill(null))]
    slots[index] = val
    await updateWeeklySchedule(day, slots)
  }

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={handleDoubleClick}
      className={`
        w-10 h-8 flex items-center justify-center rounded border text-[10px]
        ${isOver ? 'border-purple-500 bg-purple-900/30' : carId ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-white/40'}
        cursor-default
      `}
    >
      {carId ? (
        <CarTag carId={carId} draggableId={`weekly_${day}_${index}_${carId}`} compact />
      ) : (
        <span className="text-slate-700 text-[8px]">{index + 1}</span>
      )}
    </div>
  )
}

export function WeeklySchedulePanel() {
  const { weeklySchedule } = useApp()

  return (
    <div>
      <div className="text-slate-500 text-xs font-medium mb-2">週排程區</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map(({ key, label }) => {
          const slots: (string | null)[] = weeklySchedule[key] ?? Array(10).fill(null)
          return (
            <div key={key} className="flex-shrink-0">
              <div className="text-slate-400 text-[10px] text-center mb-1 font-medium">{label}</div>
              <div className="flex flex-col gap-0.5">
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
