'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'
import { WeeklySchedulePanel } from './WeeklySchedulePanel'
import { MaintenancePanel } from './MaintenancePanel'
import { TestAreaPanel } from './TestAreaPanel'
import { BulletinBoard } from './BulletinBoard'

// 格子尺寸
const SW = 34
const SH = 28
const GAP = 1
const RW = SW + GAP
const RH = SH + GAP

function getSegments(mode: 108 | 130) {
  // 108 = 33+21+33+21（橫向長方形）; 130 = 40+25+40+25
  return mode === 108
    ? { top: 33, right: 21, bottom: 33, left: 21 }
    : { top: 40, right: 25, bottom: 40, left: 25 }
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

interface MainLineLoopProps {
  availableHeight: number
  availableWidth: number
}

export function MainLineLoop({ availableHeight, availableWidth }: MainLineLoopProps) {
  const { mainLine, userRole, updateMainLineMode, extractCarsFrom130To108 } = useApp()
  const { mode, positions } = mainLine
  const seg = getSegments(mode)
  const isAdmin = userRole === 'admin'

  const { loopWidth, loopHeight } = calcDims(seg.top, seg.right)

  // 依可用高度與寬度同時縮放，取較小值確保不超出任一方向，最小 0.5
  const scale = (availableHeight > 0 && availableWidth > 0)
    ? Math.max(0.5, Math.min(
        (availableHeight - 16) / loopHeight,
        (availableWidth - 16) / loopWidth
      ))
    : 1

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

  // 計算指定號碼（1-based）的槽位中心 x 座標；超出範圍回傳 null
  const slotCenterX = (slotNum: number): number | null => {
    const i = slotNum - 1
    const { left: L, bottom: B, right: R, top: T } = seg
    const total = L + B + R + T
    if (i < 0 || i >= total) return null
    if (i < L) return SW / 2
    if (i < L + B) return RW + (i - L) * RW + SW / 2
    if (i < L + B + R) return loopWidth - SW / 2
    const dPos = total - 1 - i   // 上排顯示順序反轉
    return RW + dPos * RW + SW / 2
  }
  const x112 = slotCenterX(112)  // 上排 ← 定位依據
  const x45  = slotCenterX(45)   // 下排 → 定位依據

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
    // 外層容器佔用縮放後的實際空間，讓佈局正確對齊
    <div style={{ width: loopWidth * scale, height: loopHeight * scale, flexShrink: 0 }}>
    <div className="select-none" style={{
      position: 'relative', width: loopWidth, height: loopHeight,
      transform: `scale(${scale})`, transformOrigin: 'top left',
    }}>

      {/* 外框 SVG（只畫邊框，箭頭另用 HTML 覆蓋） */}
      <svg style={{ position: 'absolute', inset: 0, width: loopWidth, height: loopHeight, overflow: 'visible', pointerEvents: 'none' }}>
        <rect x={SW/2} y={SH/2} width={loopWidth-SW} height={loopHeight-SH}
          fill="none" stroke="#94a3b8" strokeWidth="1.5" rx="6" />
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

      {/* 中央區塊：上方模式列 + 下方「箭頭 ｜ 面板 ｜ 箭頭」三欄 */}
      <div
        ref={centerRef}
        style={{
          position: 'absolute',
          left: RW, top: RH,
          width: loopWidth - 2 * RW,
          height: loopHeight - 2 * RH,
          background: isCenterOver ? 'rgba(219,234,254,0.7)' : 'rgba(248,250,252,0.5)',
          border: '1.5px solid rgba(148,163,184,0.5)',
          transition: 'background 0.15s',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {/* 頂列：正線模式切換 */}
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

        {/* 主體：[↓去程] ｜ [面板] ｜ [回程↑] */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* 左側去程大箭頭 */}
          <div style={{
            flexShrink: 0, width: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 42, color: '#3b82f6', fontWeight: 900, lineHeight: 1 }}>↓</span>
          </div>

          {/* 中間面板（可垂直捲動） */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

            {/* 週排程 + 維修排程 + 佈告欄（橫排，超寬可橫向捲） */}
            <div className="flex items-start gap-4 px-3 py-3 flex-shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              <div style={{ pointerEvents: 'auto' }} className="shrink-0">
                <WeeklySchedulePanel />
              </div>
              <div style={{ pointerEvents: 'auto' }} className="shrink-0">
                <MaintenancePanel mode="inline" />
              </div>
              <div style={{ pointerEvents: 'auto' }} className="shrink-0">
                <BulletinBoard />
              </div>
            </div>

            {/* 測試區 */}
            <div style={{ pointerEvents: 'auto' }}
              className="px-3 pb-3 border-t border-slate-200/60 pt-2 flex-shrink-0"
            >
              <TestAreaPanel mode="inline" />
            </div>

          </div>

          {/* 右側回程大箭頭 */}
          <div style={{
            flexShrink: 0, width: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 42, color: '#f97316', fontWeight: 900, lineHeight: 1 }}>↑</span>
          </div>

        </div>

      </div>

      {/* ← 方向指示：對齊 112 號格正下方（上排回程方向） */}
      {x112 !== null && (
        <div style={{
          position: 'absolute', left: x112 - 20, top: RH + 4,
          pointerEvents: 'none', zIndex: 9,
        }}>
          <span style={{ fontSize: 36, color: '#f97316', fontWeight: 900, lineHeight: 1 }}>←</span>
        </div>
      )}

      {/* → 方向指示：對齊 45 號格正上方（下排去程方向） */}
      {x45 !== null && (
        <div style={{
          position: 'absolute', left: x45 - 20, bottom: RH + 4,
          pointerEvents: 'none', zIndex: 9,
        }}>
          <span style={{ fontSize: 36, color: '#3b82f6', fontWeight: 900, lineHeight: 1 }}>→</span>
        </div>
      )}

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
    </div>
  )
}
