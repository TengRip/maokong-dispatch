'use client'

import { useDraggable } from '@dnd-kit/core'
import { useApp, useCarColor } from '@/lib/store'

interface CarTagProps {
  carId: string
  draggableId?: string   // 拖曳唯一 id（同車可能在多處，但邏輯上只有一個位置）
  compact?: boolean       // 小尺寸（用於正線格）
}

export function CarTag({ carId, draggableId, compact = false }: CarTagProps) {
  const { cars, userRole } = useApp()
  const color = useCarColor(carId)
  const car = cars[carId]
  const isAdmin = userRole === 'admin'

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId ?? `car-${carId}`,
    data: { carId },
    disabled: !isAdmin,
  })

  if (!car) return null

  const textColor = isLightColor(color) ? '#000' : '#fff'

  return (
    <div
      ref={setNodeRef}
      {...(isAdmin ? { ...listeners, ...attributes } : {})}
      style={{
        backgroundColor: color,
        color: textColor,
        opacity: isDragging ? 0.4 : 1,
        cursor: isAdmin ? 'grab' : 'default',
      }}
      className={`
        relative inline-flex items-center justify-center rounded font-bold select-none
        border border-white/20 shadow-sm transition-opacity
        ${compact ? 'text-[10px] w-8 h-6' : 'text-xs px-2 py-1 min-w-[2.5rem]'}
        ${isDragging ? 'z-50' : ''}
      `}
    >
      {carId}
      {car.is_reference && (
        <span className="absolute -top-1.5 -right-1 text-[8px] leading-none text-yellow-300 font-bold">★</span>
      )}
    </div>
  )
}

// 判斷顏色是否偏淺（決定文字用黑或白）
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.substr(0, 2), 16)
  const g = parseInt(h.substr(2, 2), 16)
  const b = parseInt(h.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}
