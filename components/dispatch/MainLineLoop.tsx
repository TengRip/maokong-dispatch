'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

// 108：上30 右24 下30 左24；130：上36 右29 下36 左29
function getSegments(mode: 108 | 130) {
  return mode === 108
    ? { top: 30, right: 24, bottom: 30, left: 24 }
    : { top: 36, right: 29, bottom: 36, left: 29 }
}

// 22格追加至右側時的起始索引（模式切換用）
function getRightSideInsertStart(mode: 108 | 130) {
  const s = getSegments(mode)
  return s.top // 右側從 top 之後開始
}

function LoopSlot({
  index, carId, orientation,
}: {
  index: number; carId: string | null; orientation: 'h' | 'v'
}) {
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

  // 水平格：寬32高22；垂直格：寬26高22
  const cls = orientation === 'h'
    ? 'w-8 h-[22px] flex-shrink-0'
    : 'w-[26px] h-[22px] flex-shrink-0'

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => { if (isAdmin) { setInputVal(carId ?? ''); setEditing(true) } }}
      className={`
        ${cls} relative flex items-center justify-center rounded-sm border cursor-default
        transition-colors text-[9px] select-none
        ${isOver ? 'border-blue-400 bg-blue-900/50' : carId ? 'border-slate-500 bg-slate-700' : 'border-slate-700/60 bg-slate-800/30'}
      `}
    >
      {editing ? (
        <input
          autoFocus value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
          className="w-full h-full text-center text-[9px] bg-slate-600 text-white outline-none rounded-sm"
          maxLength={4}
        />
      ) : carId ? (
        <CarTag carId={carId} draggableId={`ml_${index}_${carId}`} compact />
      ) : (
        <span className="text-slate-700 text-[7px]">{index + 1}</span>
      )}
    </div>
  )
}

export function MainLineLoop() {
  const { mainLine, userRole, updateMainLineMode, extractCarsFrom130To108 } = useApp()
  const { mode, positions } = mainLine
  const seg = getSegments(mode)
  const isAdmin = userRole === 'admin'

  // 各邊的格子索引
  const topIdx    = Array.from({ length: seg.top }, (_, i) => i)
  const rightIdx  = Array.from({ length: seg.right }, (_, i) => seg.top + i)
  const bottomIdx = Array.from({ length: seg.bottom }, (_, i) => seg.top + seg.right + i)
  const leftIdx   = Array.from({ length: seg.left }, (_, i) => seg.top + seg.right + seg.bottom + i)

  const getSlotCar = (i: number) => positions[i] ?? null

  const [showExtract, setShowExtract] = useState(false)
  const [extractStart, setExtractStart] = useState('')
  const [extractErr, setExtractErr] = useState('')

  const handleModeSwitch = async (newMode: 108 | 130) => {
    if (!isAdmin || newMode === mode) return
    if (newMode === 130) {
      await updateMainLineMode(130)
    } else {
      setShowExtract(true)
    }
  }

  const handleExtractConfirm = async () => {
    const cid = extractStart.trim().toUpperCase()
    if (!cid) { setExtractErr('請輸入起始車號'); return }
    if (!positions.includes(cid)) { setExtractErr('此車號不在正線上'); return }
    setShowExtract(false); setExtractStart(''); setExtractErr('')
    await extractCarsFrom130To108(cid)
  }

  const filled = positions.filter(Boolean).length

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* 模式切換列 */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-xs">正線模式：</span>
        <div className="flex rounded overflow-hidden border border-slate-600">
          {([108, 130] as const).map(m => (
            <button key={m}
              onClick={() => handleModeSwitch(m)}
              disabled={!isAdmin}
              className={`px-4 py-1 text-xs font-medium transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >{m} 車</button>
          ))}
        </div>
        <span className="text-slate-500 text-xs">已排 {filled} 台</span>
      </div>

      {/* 矩形迴圈本體 */}
      <div className="relative inline-flex flex-col items-center gap-0">

        {/* 上排：回程（貓空→轉角），由右往左 */}
        <div className="flex items-center gap-px">
          {/* 左上角 */}
          <div className="w-5 h-5 border-l-2 border-t-2 border-slate-500 rounded-tl-lg flex items-end justify-end">
            <span className="text-slate-500 text-[8px] leading-none mb-0.5 mr-0.5">↑</span>
          </div>
          <div className="flex gap-px items-center">
            {[...topIdx].reverse().map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} orientation="h" />
            ))}
          </div>
          {/* 右上角 */}
          <div className="w-5 h-5 border-r-2 border-t-2 border-slate-500 rounded-tr-lg flex items-end justify-start">
            <span className="text-slate-500 text-[8px] leading-none mb-0.5 ml-0.5">↑</span>
          </div>
        </div>

        {/* 中段：左側 + 中央說明 + 右側 */}
        <div className="flex items-stretch gap-0">
          {/* 左側：去程（轉角→貓空），由下往上 */}
          <div className="flex flex-col gap-px border-l-2 border-slate-500 pl-px">
            {[...leftIdx].reverse().map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} orientation="v" />
            ))}
          </div>

          {/* 中央說明區 */}
          <div className="flex flex-col items-center justify-center px-6 min-w-[160px]">
            <div className="text-center space-y-3">
              <div className="flex items-center gap-2 text-blue-400">
                <span className="text-base">↑</span>
                <span className="text-[10px]">去程</span>
              </div>
              <div className="text-slate-600 text-[9px] leading-relaxed text-center">
                <div>轉角二站</div>
                <div>⬆ ⬇</div>
                <div>貓空站</div>
              </div>
              <div className="flex items-center gap-2 text-orange-400">
                <span className="text-[10px]">回程</span>
                <span className="text-base">↓</span>
              </div>
            </div>
          </div>

          {/* 右側：回程（貓空→轉角），由上往下 */}
          <div className="flex flex-col gap-px border-r-2 border-slate-500 pr-px">
            {rightIdx.map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} orientation="v" />
            ))}
          </div>
        </div>

        {/* 下排：去程（轉角→貓空），由左往右 */}
        <div className="flex items-center gap-px">
          {/* 左下角 */}
          <div className="w-5 h-5 border-l-2 border-b-2 border-slate-500 rounded-bl-lg flex items-start justify-end">
            <span className="text-slate-500 text-[8px] leading-none mt-0.5 mr-0.5">↓</span>
          </div>
          <div className="flex gap-px items-center">
            {bottomIdx.map(i => (
              <LoopSlot key={i} index={i} carId={getSlotCar(i)} orientation="h" />
            ))}
          </div>
          {/* 右下角 */}
          <div className="w-5 h-5 border-r-2 border-b-2 border-slate-500 rounded-br-lg flex items-start justify-start">
            <span className="text-slate-500 text-[8px] leading-none mt-0.5 ml-0.5">↓</span>
          </div>
        </div>

      </div>

      {/* 方向說明標籤 */}
      <div className="flex gap-6 text-[10px]">
        <span className="text-blue-400">↑ 左側：去程（轉角→貓空）</span>
        <span className="text-orange-400">↓ 右側：回程（貓空→轉角）</span>
      </div>

      {/* 130→108 抽車 Modal */}
      {showExtract && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-80 border border-slate-600 shadow-2xl">
            <h3 className="text-white font-bold mb-2">130 → 108 切換</h3>
            <p className="text-slate-400 text-sm mb-4">
              輸入<strong className="text-white">起始車號</strong>，系統將從該車起連續抽出 22 台放回轉角二站。
            </p>
            <input
              autoFocus value={extractStart}
              onChange={e => setExtractStart(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleExtractConfirm() }}
              placeholder="例如：45"
              className="w-full bg-slate-700 border border-slate-500 rounded px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-blue-500"
            />
            {extractErr && <p className="text-red-400 text-xs mb-2">{extractErr}</p>}
            <div className="flex gap-2">
              <button onClick={handleExtractConfirm} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-2 text-sm font-medium">確認抽出</button>
              <button onClick={() => { setShowExtract(false); setExtractErr('') }} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white rounded px-3 py-2 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
