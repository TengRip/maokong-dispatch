'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

// 計算矩形迴圈各邊的格子分配
function getLoopSegments(mode: 108 | 130) {
  // 頂邊、右邊、底邊、左邊
  if (mode === 108) return { top: 28, right: 26, bottom: 28, left: 26 }
  return { top: 34, right: 31, bottom: 34, left: 31 }
}

// 插槽元件
function LoopSlot({ index, carId, side }: { index: number; carId: string | null; side: 'top' | 'right' | 'bottom' | 'left' }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `main_line_slot_${index}`,
    data: { location: 'main_line', slot: index },
  })
  const { userRole, updateMainLinePosition, maintenanceUnits, cars } = useApp()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const isAdmin = userRole === 'admin'
  const maintenanceCarIds = new Set(maintenanceUnits.flatMap(u => u.car_ids))

  const handleDoubleClick = () => {
    if (!isAdmin) return
    setInputVal(carId ?? '')
    setEditing(true)
  }

  const handleInputConfirm = async () => {
    const val = inputVal.trim().toUpperCase()
    setEditing(false)
    if (val === '' || val === carId) return
    await updateMainLinePosition(index, val || null)
  }

  const isVertical = side === 'left' || side === 'right'
  const bg = isOver ? 'bg-blue-900/60' : carId ? 'bg-slate-700' : 'bg-slate-800/50'

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={handleDoubleClick}
      className={`
        relative flex items-center justify-center border border-slate-600 rounded
        ${isVertical ? 'w-9 h-7' : 'h-9 w-7'}
        ${bg} transition-colors cursor-default
      `}
      style={{ minWidth: isVertical ? 36 : 28, minHeight: isVertical ? 28 : 36 }}
    >
      {editing ? (
        <input
          autoFocus
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleInputConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleInputConfirm() }}
          className="w-full h-full text-center text-[10px] bg-slate-600 text-white outline-none rounded"
          maxLength={4}
        />
      ) : carId ? (
        <CarTag carId={carId} draggableId={`main_line_${index}_${carId}`} compact />
      ) : (
        <span className="text-slate-600 text-[8px]">{index + 1}</span>
      )}
    </div>
  )
}

export function MainLineLoop() {
  const { mainLine, userRole, updateMainLineMode, extractCarsFrom130To108, cars } = useApp()
  const { mode, positions } = mainLine
  const segments = getLoopSegments(mode)
  const isAdmin = userRole === 'admin'

  // 建立各邊格子索引
  const topSlots = Array.from({ length: segments.top }, (_, i) => i)
  const rightSlots = Array.from({ length: segments.right }, (_, i) => segments.top + i)
  const bottomSlots = Array.from({ length: segments.bottom }, (_, i) => segments.top + segments.right + i)
  const leftSlots = Array.from({ length: segments.left }, (_, i) => segments.top + segments.right + segments.bottom + i)

  // 108→130 切換：需要新增22個空格在右側
  const [showExtractModal, setShowExtractModal] = useState(false)
  const [extractStartCar, setExtractStartCar] = useState('')
  const [extractError, setExtractError] = useState('')

  const handleModeSwitch = async (newMode: 108 | 130) => {
    if (!isAdmin || newMode === mode) return
    if (newMode === 130) {
      // 直接擴展，右側會有22個空格
      await updateMainLineMode(130)
    } else {
      // 需要選起始車
      setShowExtractModal(true)
    }
  }

  const handleExtractConfirm = async () => {
    const cid = extractStartCar.trim().toUpperCase()
    if (!cid) { setExtractError('請輸入起始車號'); return }
    if (!positions.includes(cid)) { setExtractError('此車號不在正線上'); return }
    setShowExtractModal(false)
    setExtractStartCar('')
    setExtractError('')
    await extractCarsFrom130To108(cid)
  }

  const getSlotCar = (index: number) => positions[index] ?? null

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      {/* 模式切換 */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm">正線模式：</span>
        <div className="flex rounded-lg overflow-hidden border border-slate-600">
          <button
            onClick={() => handleModeSwitch(108)}
            disabled={!isAdmin}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 108 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            108 車
          </button>
          <button
            onClick={() => handleModeSwitch(130)}
            disabled={!isAdmin}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 130 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            130 車
          </button>
        </div>
        <span className="text-slate-500 text-xs">已排 {positions.filter(Boolean).length} 台</span>
      </div>

      {/* 矩形迴圈 */}
      <div className="relative flex flex-col items-center gap-0">

        {/* 頂邊（由右往左，表示回程：貓空→轉角） */}
        <div className="flex items-center gap-0.5">
          <div className="w-7 flex items-center justify-center">
            <span className="text-slate-500 text-xs rotate-180" style={{ writingMode: 'vertical-rl' }}>↑</span>
          </div>
          <div className="flex gap-0.5">
            {[...topSlots].reverse().map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} side="top" />
            ))}
          </div>
          <div className="w-7 flex items-center justify-center">
            <span className="text-slate-500 text-xs">↑</span>
          </div>
        </div>

        {/* 中間（左邊 + 空心 + 右邊） */}
        <div className="flex items-stretch gap-0.5">
          {/* 左邊（由下往上，表示去程：轉角→貓空） */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="text-blue-400 text-[9px] mb-0.5">←去程</span>
            {[...leftSlots].reverse().map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} side="left" />
            ))}
          </div>

          {/* 中央說明區 */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 min-w-[120px]">
            <div className="text-slate-600 text-xs text-center leading-relaxed">
              <div>⬆ 去程</div>
              <div className="text-[10px] text-slate-700 mt-2">轉角二站 → 貓空站</div>
              <div className="text-[10px] text-slate-700">貓空站 → 轉角二站</div>
              <div>⬇ 回程</div>
            </div>
          </div>

          {/* 右邊（由上往下，表示回程：貓空→轉角） */}
          <div className="flex flex-col gap-0.5 items-center">
            <span className="text-orange-400 text-[9px] mb-0.5">回程→</span>
            {rightSlots.map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} side="right" />
            ))}
          </div>
        </div>

        {/* 底邊（由左往右，表示去程：轉角→貓空） */}
        <div className="flex items-center gap-0.5">
          <div className="w-7 flex items-center justify-center">
            <span className="text-slate-500 text-xs">↓</span>
          </div>
          <div className="flex gap-0.5">
            {bottomSlots.map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} side="bottom" />
            ))}
          </div>
          <div className="w-7 flex items-center justify-center">
            <span className="text-slate-500 text-xs rotate-180" style={{ writingMode: 'vertical-rl' }}>↓</span>
          </div>
        </div>
      </div>

      {/* 130→108 抽車 Modal */}
      {showExtractModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-80 border border-slate-600 shadow-2xl">
            <h3 className="text-white font-bold mb-2">130 → 108 切換</h3>
            <p className="text-slate-400 text-sm mb-4">
              請輸入要抽出的<strong className="text-white">起始車號</strong>，系統將從該車起連續抽出 22 台放回轉角二站。
            </p>
            <input
              autoFocus
              value={extractStartCar}
              onChange={e => setExtractStartCar(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleExtractConfirm() }}
              placeholder="輸入起始車號（如：45）"
              className="w-full bg-slate-700 border border-slate-500 rounded px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-blue-500"
            />
            {extractError && <p className="text-red-400 text-xs mb-2">{extractError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleExtractConfirm}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-2 text-sm font-medium"
              >
                確認抽出
              </button>
              <button
                onClick={() => { setShowExtractModal(false); setExtractError('') }}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white rounded px-3 py-2 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
