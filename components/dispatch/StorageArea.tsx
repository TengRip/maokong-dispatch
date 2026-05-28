'use client'

import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

interface StorageAreaProps {
  location: 'zhuanjiaoer' | 'maokong'
  label: string
  maxSlots: number
}

export function StorageArea({ location, label, maxSlots }: StorageAreaProps) {
  const { cars } = useApp()
  const { isOver, setNodeRef } = useDroppable({
    id: `storage_${location}`,
    data: { location },
  })

  const storedCars = Object.values(cars).filter(c => c.location === location)

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg border transition-colors p-2
        ${isOver ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-800/50'}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-300 text-xs font-medium">{label}</span>
        <span className="text-slate-500 text-[10px]">{storedCars.length}/{maxSlots}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {storedCars.map(car => (
          <CarTag key={car.id} carId={car.id} draggableId={`storage_${location}_${car.id}`} />
        ))}
        {/* 空格提示 */}
        {storedCars.length === 0 && (
          <span className="text-slate-600 text-[10px]">（空）</span>
        )}
      </div>
    </div>
  )
}
