'use client'

import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

interface PendingMove {
  carId: string
  toLocation: string
  toSlot?: number
  fromLocation?: string
  reason: string
}

export function DragHandler({ children }: { children: React.ReactNode }) {
  const { cars, maintenanceUnits, updateMainLinePosition, moveCar, logOperation, userRole } = useApp()
  const isAdmin = userRole === 'admin'
  const [activeCarId, setActiveCarId] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const maintenanceCarIds = new Set(maintenanceUnits.flatMap(u => u.car_ids))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCarId(null)
    if (!isAdmin) return

    const { active, over } = event
    if (!over) return

    const carId = active.data.current?.carId as string
    if (!carId) return

    const car = cars[carId]
    if (!car) return

    const dest = over.data.current
    if (!dest) return

    const toLocation: string = dest.location
    const toSlot: number | undefined = dest.slot

    // 報廢車：完全封鎖上正線
    if (toLocation === 'main_line' && car.status === 'scrapped') return

    // 維修需求或週排程車 → 上正線需警告
    const hasMaintenance = maintenanceCarIds.has(carId)
    const isInWeekly = car.location === 'weekly_schedule'

    if (toLocation === 'main_line' && (hasMaintenance || isInWeekly)) {
      const reason = hasMaintenance ? '本列車有維修需求' : '本列車在週排程中'
      setPendingMove({ carId, toLocation, toSlot, fromLocation: car.location, reason })
      return
    }

    await executeMove(carId, toLocation, toSlot, car.location)
  }

  const executeMove = async (
    carId: string,
    toLocation: string,
    toSlot: number | undefined,
    fromLocation: string
  ) => {
    if (toLocation === 'main_line' && toSlot !== undefined) {
      await updateMainLinePosition(toSlot, carId)
    }
    await moveCar(carId, toLocation, toSlot, fromLocation)
  }

  const confirmPendingMove = async () => {
    if (!pendingMove) return
    await executeMove(pendingMove.carId, pendingMove.toLocation, pendingMove.toSlot, pendingMove.fromLocation ?? '')
    await logOperation('確認上線（有警告）', pendingMove.carId, pendingMove.fromLocation, 'main_line')
    setPendingMove(null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={e => setActiveCarId(e.active.data.current?.carId ?? null)}
      onDragEnd={handleDragEnd}
    >
      {children}

      {/* 拖曳中的懸浮顯示 */}
      <DragOverlay>
        {activeCarId ? <CarTag carId={activeCarId} draggableId="overlay" /> : null}
      </DragOverlay>

      {/* 上線警告 Modal */}
      {pendingMove && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-80 border border-orange-600 shadow-2xl">
            <div className="text-orange-400 text-2xl text-center mb-3">⚠</div>
            <h3 className="text-white font-bold text-center mb-3">上線警告</h3>
            <p className="text-slate-300 text-sm text-center mb-4">
              {pendingMove.reason}，請問是否確認上線？
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-slate-400 text-sm">車號：</span>
              <CarTag carId={pendingMove.carId} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmPendingMove}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-2 text-sm font-medium"
              >
                確認上線
              </button>
              <button
                onClick={() => setPendingMove(null)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white rounded px-3 py-2 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  )
}
