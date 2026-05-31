'use client'

import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

export function RetiredArea() {
  const { cars } = useApp()
  const retiredCars = Object.values(cars)
    .filter(c => c.status === 'scrapped')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'scrapped' ? -1 : 1
      const na = parseInt(a.id), nb = parseInt(b.id)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.id.localeCompare(b.id)
    })

  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      <div className="flex items-center justify-between px-1.5 py-1">
        <span className="text-red-700 text-[10px] font-semibold">停用車廂</span>
        <span className="text-red-400 text-[9px]">{retiredCars.length} 台</span>
      </div>
      <div className="px-1.5 pb-1.5 flex flex-wrap gap-1">
        {retiredCars.map(car => (
          <div key={car.id} style={{ width: 34, height: 28 }}>
            <CarTag carId={car.id} draggableId={`retired_${car.id}`} compact />
          </div>
        ))}
        {retiredCars.length === 0 && (
          <span className="text-slate-400 text-[10px]">（無）</span>
        )}
      </div>
    </div>
  )
}
