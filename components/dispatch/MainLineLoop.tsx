'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

const SW = 36   // 格子寬 px
const SH = 30   // 格子高 px
const GAP = 1   // 間距 px

function getSegments(mode: 108 | 130) {
  return mode === 108
    ? { top: 30, right: 24, bottom: 30, left: 24 }
    : { top: 36, right: 29, bottom: 36, left: 29 }
}

// 正確寬度：含兩個角落格子 + 上排所有格子 + 全部間距
function calcLoopWidth(topCount: number) {
  return (topCount + 2) * SW + (topCount + 1) * GAP
}

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
      className={`
        relative flex items-center justify-center rounded-sm border cursor-default select-none
        ${isOver ? 'border-blue-500 bg-blue-100' : carId ? 'border-slate-400 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}
      `}
      style={{ width: SW, height: SH, flexShrink: 0 }}
    >
      {editing ? (
        <input autoFocus value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full h-full text-center text-[9px] bg-white text-slate-800 outline-none border-0"
          maxLength={4}
        />
      ) : carId ? (
        <CarTag carId={carId} draggableId={`ml_${index}_${carId}`} compact />
      ) : (
        <span className="text-slate-200 text-[7px]">{index + 1}</span>
      )}
    </div>
  )
}

function Corner({ tl, tr, bl, br }: { tl?: boolean; tr?: boolean; bl?: boolean; br?: boolean }) {
  const arrow = (tl || tr) ? '↑' : '↓'
  const cls = [
    'flex items-center justify-center border-2 border-slate-400',
    tl ? 'rounded-tl-lg border-r-0 border-b-0' : '',
    tr ? 'rounded-tr-lg border-l-0 border-b-0' : '',
    bl ? 'rounded-bl-lg border-r-0 border-t-0' : '',
    br ? 'rounded-br-lg border-l-0 border-t-0' : '',
  ].join(' ')
  return (
    <div className={cls} style={{ width: SW, height: SH, flexShrink: 0 }}>
      <span className="text-slate-300 text-[9px]">{arrow}</span>
    </div>
  )
}

export function MainLineLoop() {
  const { mainLine, userRole, updateMainLineMode, extractCarsFrom130To108 } = useApp()
  const { mode, positions } = mainLine
  const seg = getSegments(mode)
  const isAdmin = userRole === 'admin'
  const loopWidth = calcLoopWidth(seg.top)

  const topIdx    = Array.from({ length: seg.top }, (_, i) => i)
  const rightIdx  = Array.from({ length: seg.right }, (_, i) => seg.top + i)
  const bottomIdx = Array.from({ length: seg.bottom }, (_, i) => seg.top + seg.right + i)
  const leftIdx   = Array.from({ length: seg.left }, (_, i) => seg.top + seg.right + seg.bottom + i)

  const getSlotCar = (i: number) => positions[i] ?? null
  const filled = positions.filter(Boolean).length

  // 中央大面積拖放目標（自動插入第一個空格）
  const { isOver: isCenterOver, setNodeRef: centerRef } = useDroppable({
    id: 'main_line_auto',
    data: { location: 'main_line', slot: -1 },
  })

  const [showExtract, setShowExtract] = useState(false)
  const [extractStart, setExtractStart] = useState('')
  const [extractErr, setExtractErr] = useState('')

  const handleModeSwitch = async (newMode: 108 | 130) => {
    if (!isAdmin || newMode === mode) return
    if (newMode === 130) await updateMainLineMode(130)
    else setShowExtract(true)
  }

  const handleExtractConfirm = async () => {
    const cid = extractStart.trim().toUpperCase()
    if (!cid) { setExtractErr('請輸入起始車號'); return }
    if (!positions.includes(cid)) { setExtractErr('此車號不在正線上'); return }
    setShowExtract(false); setExtractStart(''); setExtractErr('')
    await extractCarsFrom130To108(cid)
  }

  // 側邊欄高度（不含 paddingTop）
  const sideSlotH = seg.right * (SH + GAP) - GAP

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
        <span className="text-slate-400 text-xs">已排 {filled} 台</span>
      </div>

      {/* 矩形迴圈 — loopWidth 確保三排完全對齊 */}
      <div style={{ width: loopWidth }}>

        {/* 上排：回程（貓空→轉角），由右往左 */}
        <div className="flex items-center" style={{ gap: GAP }}>
          <Corner tl />
          {[...topIdx].reverse().map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          <Corner tr />
        </div>

        {/* 中段 */}
        <div className="flex" style={{ height: sideSlotH + GAP }}>

          {/* 左側：去程，由下往上 */}
          <div className="flex flex-col border-l-2 border-slate-400"
            style={{ width: SW, flexShrink: 0, paddingTop: GAP, gap: GAP }}>
            {[...leftIdx].reverse().map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          </div>

          {/* 中央大拖放目標 */}
          <div ref={centerRef}
            className="flex-1 flex flex-col items-center justify-center"
            style={{
              background: isCenterOver ? '#EFF6FF' : '#F8FAFC',
              borderTop: 'none', borderBottom: 'none',
              borderLeft: '1px solid #E2E8F0',
              borderRight: '1px solid #E2E8F0',
              transition: 'background 0.15s',
            }}>
            <div className="text-center space-y-2">
              <div className="text-blue-500 text-xs font-medium">↑ 去程</div>
              <div className="text-slate-400 text-[10px] leading-5">
                <div>轉角二站</div>
                <div>⇅</div>
                <div>貓空站</div>
              </div>
              <div className="text-orange-500 text-xs font-medium">回程 ↓</div>
              {isCenterOver && (
                <div className="text-blue-500 text-[10px] bg-blue-50 rounded px-2 py-0.5 border border-blue-200 mt-1">
                  放開→插入第一空格
                </div>
              )}
            </div>
          </div>

          {/* 右側：回程，由上往下 */}
          <div className="flex flex-col border-r-2 border-slate-400"
            style={{ width: SW, flexShrink: 0, paddingTop: GAP, gap: GAP }}>
            {rightIdx.map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          </div>
        </div>

        {/* 下排：去程（轉角→貓空），由左往右 */}
        <div className="flex items-center" style={{ gap: GAP }}>
          <Corner bl />
          {bottomIdx.map(i => <LoopSlot key={i} index={i} carId={getSlotCar(i)} />)}
          <Corner br />
        </div>

      </div>

      {/* 方向說明 */}
      <div className="flex gap-8 text-[10px]">
        <span className="text-blue-500 font-medium">↑ 左側：去程（轉角二站→貓空站）</span>
        <span className="text-orange-500 font-medium">↓ 右側：回程（貓空站→轉角二站）</span>
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
