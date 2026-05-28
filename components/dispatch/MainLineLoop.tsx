'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'
import { StorageArea } from './StorageArea'
import { WeeklySchedulePanel } from './WeeklySchedulePanel'
import { MaintenancePanel } from './MaintenancePanel'
import { TestAreaPanel } from './TestAreaPanel'

// 格子尺寸
const SW = 34
const SH = 28
const GAP = 1
const RW = SW + GAP
const RH = SH + GAP

function getSegments(mode: 108 | 130) {
  // 108 = 26+28+26+28 ; 130 = 32+33+32+33
  return mode === 108
    ? { top: 26, right: 28, bottom: 26, left: 28 }
    : { top: 32, right: 33, bottom: 32, left: 33 }
}

function calcDims(top: number, side: number) {
  const loopWidth  = (top + 2) * SW + (top + 1) * GAP
  const loopHeight = (side + 2) * SH + (side + 1) * GAP
  return { loopWidth, loopHeight }
}

function topX(dPos: number)    { return RW + dPos * RW }
function bottomX(dPos: number) { return RW + dPos * RW }
function sideY(dPos: number)   { return RH + dPos * RH }

function LoopSlot({ index, carId }: { index: number; carId: string | null }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `main_line_slot_${index}`,
    data: { location: 'main_line', slot: index },
  })
  const { userRole, updateMainLinePosition, moveCar } = useApp()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const isAdmin = userRole === 'admin'

  const handleConfirm = async () => {
    const val = inputVal.trim().toUpperCase()
    setEditing(false)
    if (val === carId) return
    if (!val && carId) {
      await updateMainLinePosition(index, null)
      await moveCar(carId, 'zhuanjiaoer', undefined, 'main_line')
      return
    }
    await updateMainLinePosition(index, val || null)
  }

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => { if (isAdmin) { setInputVal(carId ?? ''); setEditing(true) } }}
      style={{ width: SW, height: SH }}
      className={`
        flex items-center justify-center rounded-sm border select-none cursor-default
        ${isOver
          ? 'border-blue-500 bg-blue-100'
          : carId ? 'border-slate-400 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}
      `}
    >
      {editing ? (
        <input autoFocus value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full h-full text-center text-[9px] bg-white text-slate-800 outline-none"
          maxLength={4}
        />
      ) : carId ? (
        <CarTag carId={carId} draggableId={`ml_${index}_${carId}`} compact />
      ) : (
        <span className="text-slate-400 text-[7px]">{index + 1}</span>
      )}
    </div>
  )
}

export function MainLineLoop() {
  const { mainLine, userRole, updateMainLineMode, extractCarsFrom130To108 } = useApp()
  const { mode, positions } = mainLine
  const seg = getSegments(mode)
  const isAdmin = userRole === 'admin'

  const { loopWidth, loopHeight } = calcDims(seg.top, seg.right)

  // 逆時針索引：左欄↓ → 下排→ → 右欄↑ → 上排←，slot 1 在左欄最上方
  const leftIdx   = Array.from({ length: seg.left }, (_, i) => i)
  const bottomIdx = Array.from({ length: seg.bottom }, (_, i) => seg.left + i)
  const rightIdx  = Array.from({ length: seg.right }, (_, i) => seg.left + seg.bottom + i)
  const topIdx    = Array.from({ length: seg.top }, (_, i) => seg.left + seg.bottom + seg.right + i)

  const getSlotCar = (i: number) => positions[i] ?? null
  const filled = positions.filter(Boolean).length

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

  return (
    <div className="select-none" style={{ position: 'relative', width: loopWidth, height: loopHeight }}>

      {/* 外框 SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: loopWidth, height: loopHeight, overflow: 'visible', pointerEvents: 'none' }}>
        <rect x={SW/2} y={SH/2} width={loopWidth-SW} height={loopHeight-SH}
          fill="none" stroke="#94a3b8" strokeWidth="1.5" rx="6" />
        <text x={SW/2} y={loopHeight/2-8} textAnchor="middle" fontSize="10" fill="#3b82f6">↓</text>
        <text x={SW/2} y={loopHeight/2+12} textAnchor="middle" fontSize="8" fill="#3b82f6">去程</text>
        <text x={loopWidth-SW/2} y={loopHeight/2-8} textAnchor="middle" fontSize="10" fill="#f97316">↑</text>
        <text x={loopWidth-SW/2} y={loopHeight/2+12} textAnchor="middle" fontSize="8" fill="#f97316">回程</text>
      </svg>

      {/* 左側：slot 1 在最上方，由上往下 */}
      {leftIdx.map((idx, dPos) => (
        <div key={`l${idx}`} style={{ position: 'absolute', left: 0, top: sideY(dPos) }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} />
        </div>
      ))}

      {/* 下排：由左往右 */}
      {bottomIdx.map((idx, dPos) => (
        <div key={`b${idx}`} style={{ position: 'absolute', left: bottomX(dPos), top: loopHeight - SH }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} />
        </div>
      ))}

      {/* 右側：reversed = 最高索引在最上方，方向由下往上 */}
      {[...rightIdx].reverse().map((idx, dPos) => (
        <div key={`r${idx}`} style={{ position: 'absolute', left: loopWidth - SW, top: sideY(dPos) }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} />
        </div>
      ))}

      {/* 上排：reversed = 最高索引在最左方，方向由右往左 */}
      {[...topIdx].reverse().map((idx, dPos) => (
        <div key={`t${idx}`} style={{ position: 'absolute', left: topX(dPos), top: 0 }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} />
        </div>
      ))}

      {/* 中央區塊：flex-col，上方模式控制 + 下方工具面板 */}
      <div
        ref={centerRef}
        style={{
          position: 'absolute',
          left: RW, top: RH,
          width: loopWidth - 2 * RW,
          height: loopHeight - 2 * RH,
          background: isCenterOver ? 'rgba(219,234,254,0.7)' : 'rgba(248,250,252,0.5)',
          transition: 'background 0.15s',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '4px',
          overflowY: 'auto',
        }}
      >
        {/* 頂列：正線模式切換（原本在外層，現移入） */}
        <div style={{ pointerEvents: 'auto', flexShrink: 0 }}
          className="flex items-center gap-3 px-4 py-2 border-b border-slate-200/60"
        >
          <span className="text-slate-500 text-xs">正線模式：</span>
          <div className="flex rounded overflow-hidden border border-slate-300">
            {([108, 130] as const).map(m => (
              <button key={m} onClick={() => handleModeSwitch(m)} disabled={!isAdmin}
                className={`px-4 py-1 text-xs font-medium transition-colors
                  ${mode === m ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              >{m} 車</button>
            ))}
          </div>
          <span className="text-slate-400 text-xs">已排 {filled} 台｜雙擊格子輸入車號</span>
          {isCenterOver && (
            <span className="text-blue-600 text-[10px] bg-white border border-blue-200 rounded px-2 py-0.5">
              放開→插入第一空格
            </span>
          )}
        </div>

        {/* 下方：方向標示 + 貓空站 + 週排程 + 維修排程（頂部對齊） */}
        <div className="flex items-start gap-4 px-4 py-3 flex-shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

          {/* 方向標示 */}
          <div className="text-center pointer-events-none shrink-0 pt-1">
            <div className="text-blue-500 text-xs font-medium mb-1">↓ 去程</div>
            <div className="text-slate-400 text-[10px] leading-5">轉角二站 ⇅ 貓空站</div>
            <div className="text-orange-500 text-xs font-medium mt-1">回程 ↑</div>
          </div>

          {/* 貓空站儲車區 */}
          <div style={{ pointerEvents: 'auto', width: 160 }} className="shrink-0">
            <StorageArea location="maokong" label="貓空站 儲車區" maxSlots={10} />
          </div>

          {/* 週排程 */}
          <div style={{ pointerEvents: 'auto' }} className="shrink-0">
            <WeeklySchedulePanel />
          </div>

          {/* 維修排程 A B C 橫排 */}
          <div style={{ pointerEvents: 'auto' }} className="shrink-0">
            <MaintenancePanel mode="inline" />
          </div>

        </div>

        {/* 下方：測試區（維修排程下方，換行推擠自動撐高） */}
        <div style={{ pointerEvents: 'auto' }}
          className="px-4 pb-3 border-t border-slate-200/60 pt-2 flex-shrink-0"
        >
          <TestAreaPanel mode="inline" />
        </div>

      </div>

      {/* 130→108 抽車 Modal */}
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
