'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

interface StorageAreaProps {
  location: 'zhuanjiaoer' | 'maokong'
  label: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function StorageArea({
  location, label, collapsible = false, defaultCollapsed = false,
}: StorageAreaProps) {
  const { cars } = useApp()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const { isOver, setNodeRef } = useDroppable({
    id: `storage_${location}`,
    data: { location },
  })

  const storedCars = Object.values(cars).filter(
    c => c.location === location && c.status !== 'scrapped'
  )
  // 洞車、雙握車不列入台數計算
  const countedCars = storedCars.filter(c => c.type !== 'dong' && c.type !== 'shuangwo')

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border transition-colors
        ${isOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}
      `}
    >
      <div className="px-1.5 pt-1.5 pb-0.5 flex items-center justify-between">
        <span className="text-slate-700 text-xs font-semibold">{label}</span>
        <span className="text-slate-400 text-[9px]">{countedCars.length} 台</span>
      </div>
      {collapsible && (
        <div className="px-1.5 pb-1">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="w-[110px] text-slate-400 hover:text-slate-600 text-[9px] border border-slate-300 rounded px-1 py-0.5 leading-none transition-colors bg-white"
          >
            {collapsed ? '▼ 展開列車' : '▲ 收折列車'}
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="px-1.5 pb-1.5 flex flex-wrap gap-1">
          {storedCars.map(car => (
            <div key={car.id} style={{ width: 34, height: 28 }}>
              <CarTag carId={car.id} draggableId={`storage_${location}_${car.id}`} compact />
            </div>
          ))}
          {storedCars.length === 0 && (
            <span className="text-slate-400 text-[10px]">（空）</span>
          )}
        </div>
      )}
    </div>
  )
}
