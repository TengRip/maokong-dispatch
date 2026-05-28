'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

interface StorageAreaProps {
  location: 'zhuanjiaoer' | 'maokong'
  label: string
  maxSlots: number
  collapsible?: boolean   // 是否可收折
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
        ${isOver ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-800/50'}
      `}
    >
      {/* 標題列（永遠顯示，拖曳目標仍有效） */}
      <div className={`flex items-center justify-between px-2 ${collapsed ? 'py-1.5' : 'pt-2 px-2 pb-1'}`}>
        <span className="text-slate-300 text-xs font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[10px]">{storedCars.length}/{maxSlots}</span>
          {collapsible && (
            <button
              onClick={() => setCollapsed(v => !v)}
              className="text-slate-500 hover:text-slate-300 text-[10px] border border-slate-600 rounded px-1 py-0.5 leading-none transition-colors"
              title={collapsed ? '展開' : '收折'}
            >
              {collapsed ? '▼ 展開' : '▲ 收折'}
            </button>
          )}
        </div>
      </div>

      {/* 車廂列表（可收折） */}
      {!collapsed && (
        <div className="px-2 pb-2 flex flex-wrap gap-1">
          {storedCars.map(car => (
            <CarTag key={car.id} carId={car.id} draggableId={`storage_${location}_${car.id}`} />
          ))}
          {storedCars.length === 0 && (
            <span className="text-slate-600 text-[10px]">（空）</span>
          )}
        </div>
      )}
    </div>
  )
}
