'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

interface StorageAreaProps {
  location: 'zhuanjiaoer' | 'maokong'
  label: string
  maxSlots: number
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function StorageArea({
  location, label, maxSlots, collapsible = false, defaultCollapsed = false,
}: StorageAreaProps) {
  const { cars } = useApp()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const { isOver, setNodeRef } = useDroppable({
    id: `storage_${location}`,
    data: { location },
  })

  const storedCars = Object.values(cars).filter(c => c.location === location)

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border transition-colors
        ${isOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}
      `}
    >
      <div className={`flex items-center justify-between px-2 ${collapsed ? 'py-1.5' : 'pt-2 px-2 pb-1'}`}>
        <span className="text-slate-700 text-xs font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[10px]">{storedCars.length}/{maxSlots}</span>
          {collapsible && (
            <button
              onClick={() => setCollapsed(v => !v)}
              className="text-slate-400 hover:text-slate-600 text-[10px] border border-slate-300 rounded px-1 py-0.5 leading-none transition-colors bg-white"
            >
              {collapsed ? '▼ 展開' : '▲ 收折'}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="px-2 pb-2 flex flex-wrap gap-1">
          {storedCars.map(car => (
            <CarTag key={car.id} carId={car.id} draggableId={`storage_${location}_${car.id}`} />
          ))}
          {storedCars.length === 0 && (
            <span className="text-slate-400 text-[10px]">（空）</span>
          )}
        </div>
      )}
    </div>
  )
}
