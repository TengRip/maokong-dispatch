'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

// 各模式的格子分配
function getSegments(mode: 108 | 130) {
  return mode === 108
    ? { top: 30, right: 24, bottom: 30, left: 24 }
    : { top: 36, right: 29, bottom: 36, left: 29 }
}

// 每個格子的尺寸（px）
const SW = 32   // 格子寬
const SH = 24   // 格子高
const GAP = 1   // 間距

function LoopSlot({ index, carId }: { index: number; carId: string | null }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `main_line_slot_${index}`,
    data: { location: 'main_line', slot: index },
  })
  const { userRole, updateMainLinePosition } = useApp()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const isAdmin = userRole === 'admin'

  const handleConfirm = async () => {
    const val = inputVal.trim().toUpperCase()
    setEditing(false)
    if (!val || val === carId) return
    await updateMainLinePosition(index, val || null)
  }

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => { if (isAdmin) { setInputVal(carId ?? ''); setEditing(true) } }}
      style={{ width: SW, height: SH, flexShrink: 0 }}
      className={`
        relative flex items-center justify-center rounded-sm border cursor-default select-none
        ${isOver ? 'border-blue-400 bg-blue-100' : carId ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50'}
      `}
    >
      {editing ? (
        <input
          autoFocus value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full h-full text-center text-[9px] bg-white text-slate-800 outline-none border-0"
          maxLength={4}
        />
      ) : carId ? (
        <CarTag carId={carId} draggableId={`ml_${index}_${carId}`} compact />
      ) : (
        <span className="text-slate-300 text-[7px]">{index + 1}</span>
      )}
    </div>
  )
}

export function MainLineLoop() {
  const { mainLine, userRole, updateMainLineMode, extractCarsFrom130To108 } = useApp()
  const { mode, positions } = mainLine
  const seg = getSegments(mode)
  const isAdmin = userRole === 'admin'

  // 計算固定寬度（由上排格子數決定）
  const loopWidth = seg.top * (SW + GAP) - GAP

  const topIdx    = Array.from({ length: seg.top }, (_, i) => i)
  const rightIdx  = Array.from({ length: seg.right }, (_, i) => seg.top + i)
  const bottomIdx = Array.from({ length: seg.bottom }, (_, i) => seg.top + seg.right + i)
  const leftIdx   = Array.from({ length: seg.left }, (_, i) => seg.top + seg.right + seg.bottom + i)

  const getSlotCar = (i: number) => positions[i] ?? null
  const filled = positions.filter(Boolean).length

  const [showExtract, setShowExtract] = useState(false)
  const [extractStart, setExtractStart] = useState('')
  const [extractErr, setExtractErr] = useState('')

  const handleModeSwitch = async (newMode: 108 | 130) => {
    if (!isAdmin || newMode === mode) return
    if (newMode === 130) { await updateMainLineMode(130) }
    else { setShowExtract(true) }
  }

  const handleExtractConfirm = async () => {
    const cid = extractStart.trim().toUpperCase()
    if (!cid) { setExtractErr('請輸入起始車號'); return }
    if (!positions.includes(cid)) { setExtractErr('此車號不在正線上'); return }
    setShowExtract(false); setExtractStart(''); setExtractErr('')
    await extractCarsFrom130To108(cid)
  }

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* 模式切換 */}
      <div className="flex items-center gap-3">
        <span className="text-slate-500 text-xs">正線模式：</span>
        <div className="flex rounded overflow-hidden border border-slate-300">
          {([108, 130] as const).map(m => (
            <button key={m} onClick={() => handleModeSwitch(m)} disabled={!isAdmin}
              className={`px-4 py-1 text-xs font-medium transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >{m} 車</button>
          ))}
        </div>
        <span className="text-slate-400 text-xs">已排 {filled} 台｜雙擊格子輸入車號</span>
      </div>

      {/* 矩形迴圈 — 固定寬度確保上下排與左右側對齊 */}
      <div style={{ width: loopWidth }}>

        {/* 上排：回程（貓空→轉角），由右往左顯示 */}
        <div className="flex items-center" style={{ gap: GAP }}>
          <div style={{ width: SW, height: SH, flexShrink: 0 }}
            className="flex items-end justify-center border-l-2 border-t-2 border-slate-400 rounded-tl-md">
            <span className="text-slate-400 text-[8px] mb-0.5">↑</span>
          </div>
          <div className="flex flex-1" style={{ gap: GAP }}>
            {[...topIdx].reverse().map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          </div>
          <div style={{ width: SW, height: SH, flexShrink: 0 }}
            className="flex items-end justify-center border-r-2 border-t-2 border-slate-400 rounded-tr-md">
            <span className="text-slate-400 text-[8px] mb-0.5">↑</span>
          </div>
        </div>

        {/* 中段：左側 + 中央說明 + 右側 */}
        <div className="flex" style={{ gap: 0 }}>
          {/* 左側：去程（轉角→貓空），由下往上 */}
          <div className="flex flex-col border-l-2 border-slate-400" style={{ gap: GAP, paddingTop: GAP }}>
            {[...leftIdx].reverse().map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          </div>

          {/* 中央說明 */}
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/60 border-y border-slate-200/50">
            <div className="text-center space-y-2">
              <div className="flex items-center gap-2 text-blue-500 text-xs">
                <span className="text-sm">↑</span><span>去程</span>
              </div>
              <div className="text-slate-400 text-[10px] leading-5">
                <div>轉角二站</div>
                <div>⇅</div>
                <div>貓空站</div>
              </div>
              <div className="flex items-center gap-2 text-orange-500 text-xs">
                <span>回程</span><span className="text-sm">↓</span>
              </div>
            </div>
          </div>

          {/* 右側：回程（貓空→轉角），由上往下 */}
          <div className="flex flex-col border-r-2 border-slate-400" style={{ gap: GAP, paddingTop: GAP }}>
            {rightIdx.map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          </div>
        </div>

        {/* 下排：去程（轉角→貓空），由左往右 */}
        <div className="flex items-center" style={{ gap: GAP }}>
          <div style={{ width: SW, height: SH, flexShrink: 0 }}
            className="flex items-start justify-center border-l-2 border-b-2 border-slate-400 rounded-bl-md">
            <span className="text-slate-400 text-[8px] mt-0.5">↓</span>
          </div>
          <div className="flex flex-1" style={{ gap: GAP }}>
            {bottomIdx.map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          </div>
          <div style={{ width: SW, height: SH, flexShrink: 0 }}
            className="flex items-start justify-center border-r-2 border-b-2 border-slate-400 rounded-br-md">
            <span className="text-slate-400 text-[8px] mt-0.5">↓</span>
          </div>
        </div>

      </div>

      {/* 方向說明 */}
      <div className="flex gap-6 text-[10px]">
        <span className="text-blue-500">↑ 左側：去程（轉角二站→貓空站）</span>
        <span className="text-orange-500">↓ 右側：回程（貓空站→轉角二站）</span>
      </div>

      {/* 抽車 Modal */}
      {showExtract && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 border border-slate-200 shadow-xl">
            <h3 className="text-slate-800 font-bold mb-2">130 → 108 切換</h3>
            <p className="text-slate-500 text-sm mb-4">輸入<strong className="text-slate-800">起始車號</strong>，連續抽出 22 台放回轉角二站。</p>
            <input autoFocus value={extractStart} onChange={e => setExtractStart(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleExtractConfirm() }}
              placeholder="例如：45"
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm mb-2 focus:outline-none focus:border-blue-500"
            />
            {extractErr && <p className="text-red-500 text-xs mb-2">{extractErr}</p>}
            <div className="flex gap-2">
              <button onClick={handleExtractConfirm} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded px-3 py-2 text-sm font-medium">確認抽出</button>
              <button onClick={() => { setShowExtract(false); setExtractErr('') }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-3 py-2 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
