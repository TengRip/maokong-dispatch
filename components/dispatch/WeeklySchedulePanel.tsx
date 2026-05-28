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
    const slots = [...(weeklySchedule[day] ?? Array(10).fill(null))]
    slots[index] = val
    await updateWeeklySchedule(day, slots)
  }

  return (
    <div ref={setNodeRef}
      className={`w-10 h-8 flex items-center justify-center rounded border text-[10px] cursor-default
        ${isOver ? 'border-purple-400 bg-purple-50' : carId ? 'border-slate-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`}
    >
      {carId ? (
        <CarTag carId={carId} draggableId={`weekly_${day}_${index}_${carId}`} compact />
      ) : (
        <button onClick={handleClick}
          className={`w-full h-full flex items-center justify-center text-slate-300 text-[10px] ${isAdmin ? 'hover:text-slate-500 hover:bg-slate-100 cursor-pointer' : ''}`}
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
      <div className="text-slate-600 text-xs font-semibold mb-2">週排程區</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DAYS.map(({ key, label }) => {
          const slots: (string | null)[] = weeklySchedule[key] ?? Array(10).fill(null)
          return (
            <div key={key} className="flex-shrink-0">
              <div className="text-slate-500 text-[10px] text-center mb-1 font-semibold">週{label}</div>
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
