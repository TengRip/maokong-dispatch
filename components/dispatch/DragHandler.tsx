'use client'

import { useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay,
  useSensor, useSensors, PointerSensor,
  pointerWithin,
} from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

interface PendingMove {
  carId: string
  toLocation: string
  toSlot?: number
  fromLocation?: string
  reason: string
  toAreaId?: number   // 測試區 areaId
  toDay?: string      // 週排程 day
}

export function DragHandler({ children }: { children: React.ReactNode }) {
  const {
    cars, mainLine, maintenanceUnits, testAreas, weeklySchedule,
    updateMainLinePosition, updateTestArea, updateWeeklySchedule,
    moveCar, logOperation, userRole,
  } = useApp()

  const isAdmin = userRole === 'admin'
  const [activeCarId, setActiveCarId] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const maintenanceCarIds = new Set(maintenanceUnits.flatMap(u => u.car_ids))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
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

    let toLocation: string = dest.location
    let toSlot: number | undefined = dest.slot
    const toAreaId: number | undefined = dest.areaId
    const toDay: string | undefined = dest.day

    // 中央自動插入：找第一個空格
    if (toLocation === 'main_line' && toSlot === -1) {
      const firstEmpty = mainLine.positions.findIndex(p => p === null)
      if (firstEmpty === -1) return
      toSlot = firstEmpty
    }

    // 報廢車：強制封鎖上正線
    if (toLocation === 'main_line' && car.status === 'scrapped') return

    // 有維修需求 或 在週排程 → 上正線需警告
    const hasMaintenance = maintenanceCarIds.has(carId)
    const isInWeekly = car.location === 'weekly_schedule'

    if (toLocation === 'main_line' && (hasMaintenance || isInWeekly)) {
      const reason = hasMaintenance ? '本列車有維修需求' : '本列車在週排程中'
      setPendingMove({ carId, toLocation, toSlot, fromLocation: car.location, reason, toAreaId, toDay })
      return
    }

    await executeMove(carId, toLocation, toSlot, car.location, toAreaId, toDay)
  }

  const executeMove = async (
    carId: string,
    toLocation: string,
    toSlot: number | undefined,
    fromLocation: string,
    toAreaId?: number,
    toDay?: string,
  ) => {
    // 追蹤清除來源後的週排程狀態，避免 stale closure 造成同車重複顯示
    let latestWeeklySchedule = weeklySchedule

    // ── 清除來源槽位 ──────────────────────────────────
    if (fromLocation === 'main_line') {
      const idx = mainLine.positions.indexOf(carId)
      if (idx !== -1) await updateMainLinePosition(idx, null)

    } else if (fromLocation === 'test_area') {
      const fromArea = testAreas.find(a => a.slots.includes(carId))
      if (fromArea) {
        const newSlots = [...fromArea.slots] as (string | null)[]
        const idx = newSlots.indexOf(carId)
        if (idx !== -1) { newSlots[idx] = null; await updateTestArea(fromArea.id, { slots: newSlots }) }
      }

    } else if (fromLocation === 'weekly_schedule') {
      for (const [day, slots] of Object.entries(weeklySchedule)) {
        const idx = (slots as (string | null)[]).indexOf(carId)
        if (idx !== -1) {
          const newSlots = [...slots] as (string | null)[]
          newSlots[idx] = null
          await updateWeeklySchedule(day, newSlots)
          latestWeeklySchedule = { ...latestWeeklySchedule, [day]: newSlots }
          break
        }
      }
    }

    // ── 更新目標槽位（若目標格已有其他車，先把它移回轉角二站）──
    if (toLocation === 'main_line' && toSlot !== undefined) {
      const displaced = mainLine.positions[toSlot]
      if (displaced && displaced !== carId) {
        await moveCar(displaced, 'zhuanjiaoer', undefined, 'main_line')
      }
      await updateMainLinePosition(toSlot, carId)

    } else if (toLocation === 'test_area' && toAreaId !== undefined && toSlot !== undefined) {
      const area = testAreas.find(a => a.id === toAreaId)
      if (area) {
        const displaced = area.slots[toSlot]
        if (displaced && displaced !== carId) {
          await moveCar(displaced, 'zhuanjiaoer', undefined, 'test_area')
        }
        const newSlots = [...area.slots] as (string | null)[]
        newSlots[toSlot] = carId
        await updateTestArea(toAreaId, { slots: newSlots })
      }

    } else if (toLocation === 'weekly_schedule' && toDay && toSlot !== undefined) {
      const slots = [...(latestWeeklySchedule[toDay] ?? Array(10).fill(null))] as (string | null)[]
      const displaced = slots[toSlot]
      if (displaced && displaced !== carId) {
        await moveCar(displaced, 'zhuanjiaoer', undefined, 'weekly_schedule')
      }
      slots[toSlot] = carId
      await updateWeeklySchedule(toDay, slots)
    }

    await moveCar(carId, toLocation, toSlot, fromLocation)
  }

  const confirmPendingMove = async () => {
    if (!pendingMove) return
    await executeMove(
      pendingMove.carId, pendingMove.toLocation, pendingMove.toSlot,
      pendingMove.fromLocation ?? '', pendingMove.toAreaId, pendingMove.toDay,
    )
    await logOperation('確認上線（有警告）', pendingMove.carId, pendingMove.fromLocation, 'main_line')
    setPendingMove(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={e => setActiveCarId(e.active.data.current?.carId ?? null)}
      onDragEnd={handleDragEnd}
    >
      {children}

      <DragOverlay dropAnimation={null}>
        {activeCarId ? <CarTag carId={activeCarId} draggableId="overlay" /> : null}
      </DragOverlay>

      {pendingMove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 border border-orange-300 shadow-2xl">
            <div className="text-orange-500 text-2xl text-center mb-3">⚠</div>
            <h3 className="text-slate-800 font-bold text-center mb-3">上線警告</h3>
            <p className="text-slate-600 text-sm text-center mb-4">
              {pendingMove.reason}，請問是否確認上線？
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-slate-500 text-sm">車號：</span>
              <CarTag carId={pendingMove.carId} />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmPendingMove}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded px-3 py-2 text-sm font-medium">確認上線</button>
              <button onClick={() => setPendingMove(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-3 py-2 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  )
}
