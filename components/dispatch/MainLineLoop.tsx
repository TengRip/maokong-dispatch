'use client'

import { useState, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'
import { WeeklySchedulePanel } from './WeeklySchedulePanel'
import { MaintenancePanel } from './MaintenancePanel'
import { TestAreaPanel } from './TestAreaPanel'
import { BulletinBoard } from './BulletinBoard'

const GAP = 1

// 130 模式的實際像素尺寸作為固定參考（所有模式的迴圈面積維持此大小）
const REF_W = 1469
const REF_H = 782

// 週排程欄固定寬度（5天 × 48px + 4間距 × 8px + 左右 padding 24px）
const WEEKLY_COL_W = 296

function getSegments(mode: 108 | 130) {
  return mode === 108
    ? { top: 33, right: 21, bottom: 33, left: 21 }
    : { top: 40, right: 25, bottom: 40, left: 25 }
}

function getSlotSize(top: number, side: number) {
  const sw = (REF_W - (top + 1) * GAP) / (top + 2)
  const sh = (REF_H - (side + 1) * GAP) / (side + 2)
  return { sw, sh, rw: sw + GAP, rh: sh + GAP }
}

function LoopSlot({ index, carId, onWarn, sw, sh }: {
  index: number; carId: string | null; onWarn: (msg: string) => void
  sw: number; sh: number
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `main_line_slot_${index}`,
    data: { location: 'main_line', slot: index },
  })
  const { userRole, updateMainLinePosition, moveCar, cars, mainLine } = useApp()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const isAdmin = userRole === 'admin'

  const handleConfirm = async () => {
    const val = inputVal.trim().toUpperCase()
    setEditing(false)
    if (val === carId) return

    if (!val) {
      if (carId) {
        await updateMainLinePosition(index, null)
        await moveCar(carId, 'zhuanjiaoer', undefined, 'main_line')
      }
      return
    }

    if (!cars[val]) { onWarn(`找不到車號 ${val}`); return }

    const existingSlot = mainLine.positions.indexOf(val)
    if (existingSlot !== -1 && existingSlot !== index) {
      onWarn(`${val} 已在正線第 ${existingSlot + 1} 格，無法加入`)
      return
    }

    if (carId && carId !== val) await moveCar(carId, 'zhuanjiaoer', undefined, 'main_line')
    await updateMainLinePosition(index, val)
    await moveCar(val, 'main_line', index, cars[val].location)
  }

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => { if (isAdmin) { setInputVal(carId ?? ''); setEditing(true) } }}
      style={{ width: sw, height: sh }}
      className={`
        flex items-center justify-center rounded-sm border select-none cursor-default
        ${isOver
          ? 'border-blue-500 bg-blue-100'
          : carId ? 'border-slate-400 bg-white shadow-sm' : 'border-slate-300 bg-slate-200'}
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
        <span className="text-slate-500 text-[12px]">{index + 1}</span>
      )}
    </div>
  )
}

interface MainLineLoopProps {
  availableHeight: number
  availableWidth: number
}

export function MainLineLoop({ availableHeight, availableWidth }: MainLineLoopProps) {
  const { mainLine, cars, userRole, updateMainLineMode, extractCarsFrom130To108, switchDirectlyTo108 } = useApp()
  const { mode, positions } = mainLine
  const seg = getSegments(mode)
  const isAdmin = userRole === 'admin'

  const { sw, sh, rw, rh } = getSlotSize(seg.top, seg.right)

  const scale = (availableHeight > 0 && availableWidth > 0)
    ? Math.max(0.5, Math.min(
        (availableHeight - 16) / REF_H,
        (availableWidth - 16) / REF_W
      ))
    : 1

  const leftIdx   = Array.from({ length: seg.left },   (_, i) => i)
  const bottomIdx = Array.from({ length: seg.bottom },  (_, i) => seg.left + i)
  const rightIdx  = Array.from({ length: seg.right },   (_, i) => seg.left + seg.bottom + i)
  const topIdx    = Array.from({ length: seg.top },     (_, i) => seg.left + seg.bottom + seg.right + i)

  const getSlotCar = (i: number) => positions[i] ?? null
  const filled = positions.filter(Boolean).length

  const { isOver: isCenterOver, setNodeRef: centerRef } = useDroppable({
    id: 'main_line_auto',
    data: { location: 'main_line', slot: -1 },
  })

  const slotCenterX = (slotNum: number): number | null => {
    const i = slotNum - 1
    const { left: L, bottom: B, right: R, top: T } = seg
    const total = L + B + R + T
    if (i < 0 || i >= total) return null
    if (i < L) return sw / 2
    if (i < L + B) return rw + (i - L) * rw + sw / 2
    if (i < L + B + R) return REF_W - sw / 2
    const dPos = total - 1 - i
    return rw + dPos * rw + sw / 2
  }
  // 依目前模式動態計算上排/下排中間格的 x 座標作為方向箭頭位置
  const xTopArrow = slotCenterX(seg.left + seg.bottom + seg.right + Math.floor(seg.top / 2) + 1)
  const xBotArrow = slotCenterX(seg.left + Math.floor(seg.bottom / 2) + 1)

  const [showExtract, setShowExtract] = useState(false)
  const [extractStart, setExtractStart] = useState('')
  const [extractErr, setExtractErr] = useState('')
  const [warnMsg, setWarnMsg] = useState('')

  const handleModeSwitch = async (newMode: 108 | 130) => {
    if (!isAdmin || newMode === mode) return
    if (newMode === 130) {
      await updateMainLineMode(130)
    } else {
      if (filled <= 108) await switchDirectlyTo108()
      else setShowExtract(true)
    }
  }

  const extractCount = filled - 108

  const handleExtractConfirm = async () => {
    const cid = extractStart.trim().toUpperCase()
    if (!cid) { setExtractErr('請輸入起始車號'); return }
    if (!positions.includes(cid)) { setExtractErr('此車號不在正線上'); return }
    setShowExtract(false); setExtractStart(''); setExtractErr('')
    await extractCarsFrom130To108(cid, extractCount)
  }

  return (
    <div style={{ width: REF_W * scale, height: REF_H * scale, flexShrink: 0 }}>
    <div className="select-none" style={{
      position: 'relative', width: REF_W, height: REF_H,
      transform: `scale(${scale})`, transformOrigin: 'top left',
    }}>

      {/* 外框 SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: REF_W, height: REF_H, overflow: 'visible', pointerEvents: 'none' }}>
        <rect x={sw/2} y={sh/2} width={REF_W - sw} height={REF_H - sh}
          fill="none" stroke="#94a3b8" strokeWidth="1.5" rx="6" />
      </svg>

      {/* 左側：由上往下 */}
      {leftIdx.map((idx, dPos) => (
        <div key={`l${idx}`} style={{ position: 'absolute', left: 0, top: rh + dPos * rh }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} onWarn={setWarnMsg} sw={sw} sh={sh} />
        </div>
      ))}

      {/* 下排：由左往右 */}
      {bottomIdx.map((idx, dPos) => (
        <div key={`b${idx}`} style={{ position: 'absolute', left: rw + dPos * rw, top: REF_H - sh }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} onWarn={setWarnMsg} sw={sw} sh={sh} />
        </div>
      ))}

      {/* 右側：由下往上 */}
      {[...rightIdx].reverse().map((idx, dPos) => (
        <div key={`r${idx}`} style={{ position: 'absolute', left: REF_W - sw, top: rh + dPos * rh }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} onWarn={setWarnMsg} sw={sw} sh={sh} />
        </div>
      ))}

      {/* 上排：由右往左 */}
      {[...topIdx].reverse().map((idx, dPos) => (
        <div key={`t${idx}`} style={{ position: 'absolute', left: rw + dPos * rw, top: 0 }}>
          <LoopSlot index={idx} carId={getSlotCar(idx)} onWarn={setWarnMsg} sw={sw} sh={sh} />
        </div>
      ))}

      {/* 中央區塊 */}
      <div
        ref={centerRef}
        style={{
          position: 'absolute',
          left: rw, top: rh,
          width: REF_W - 2 * rw,
          height: REF_H - 2 * rh,
          background: isCenterOver ? 'rgba(219,234,254,0.7)' : 'rgba(248,250,252,0.5)',
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
          <span className="text-slate-400 text-xs">
            上線 {filled} 台｜雙擊格子輸入車號
          </span>
          {isCenterOver && (
            <span className="text-blue-600 text-[10px] bg-white border border-blue-200 rounded px-2 py-0.5">
              放開→插入第一空格
            </span>
          )}
        </div>

        {/* 主體：[↓] ｜ [週排程 | 自定義區+維修+佈告欄] ｜ [↑] */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* 左側去程箭頭 */}
          <div style={{ flexShrink: 0, width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 42, color: '#f97316', fontWeight: 900, lineHeight: 1 }}>↓</span>
          </div>

          {/* 內容區（外框） */}
          <div style={{ flex: 1, display: 'flex', border: '3px solid #94afc4', borderRadius: '6px', marginBottom: 40, overflow: 'hidden', minWidth: 0 }}>

            {/* 左欄：週排程（固定寬度，不可移動） */}
            <div style={{
              flexShrink: 0,
              width: WEEKLY_COL_W,
              borderRight: '2px solid #e2e8f0',
              padding: '10px 12px',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}>
              <WeeklySchedulePanel />
            </div>

            {/* 右欄：自定義區 + 維修排程 + 佈告欄 */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '10px 12px',
              overflowY: 'auto',
              minWidth: 0,
              pointerEvents: 'auto',
              gap: 8,
            }}>

              {/* 自定義區（flex-wrap，超出換第二排） */}
              <div style={{ flexShrink: 0 }}>
                <TestAreaPanel mode="inline" />
              </div>

              {/* 維修排程 + 佈告欄（同一水平） */}
              <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <div style={{ flexShrink: 0 }}>
                  <MaintenancePanel mode="inline" />
                </div>
                <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column' }}>
                  <BulletinBoard />
                </div>
              </div>

            </div>

          </div>

          {/* 右側回程箭頭 */}
          <div style={{ flexShrink: 0, width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 42, color: '#f97316', fontWeight: 900, lineHeight: 1 }}>↑</span>
          </div>

        </div>

      </div>

      {/* ← 方向指示（上排，由右往左） */}
      {xTopArrow !== null && (
        <div style={{ position: 'absolute', left: xTopArrow - 20, top: rh + 4, pointerEvents: 'none', zIndex: 9 }}>
          <span style={{ fontSize: 36, color: '#f97316', fontWeight: 900, lineHeight: 1 }}>←</span>
        </div>
      )}

      {/* → 方向指示（下排，由左往右） */}
      {xBotArrow !== null && (
        <div style={{ position: 'absolute', left: xBotArrow - 20, bottom: rh + 4, pointerEvents: 'none', zIndex: 9 }}>
          <span style={{ fontSize: 36, color: '#f97316', fontWeight: 900, lineHeight: 1 }}>→</span>
        </div>
      )}

      {/* 警告 Modal */}
      {warnMsg && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-72 border border-slate-200 shadow-xl text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-slate-800 font-medium text-sm mb-5">{warnMsg}</p>
            <button onClick={() => setWarnMsg('')}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded px-5 py-2 text-sm font-medium">確認</button>
          </div>
        </div>
      )}

      {/* 130→108 抽車 Modal */}
      {showExtract && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 border border-slate-200 shadow-xl">
            <h3 className="text-slate-800 font-bold mb-2">130 → 108 切換</h3>
            <p className="text-slate-500 text-sm mb-1">目前線上 <strong className="text-slate-800">{filled} 台</strong>，超出 <strong className="text-orange-600">{extractCount} 台</strong>。</p>
            <p className="text-slate-500 text-sm mb-4">請指定<strong className="text-slate-800">起始車號</strong>，系統將連續送回 <strong className="text-slate-800">{extractCount} 台</strong>；或直接略過（位置最後的 {extractCount} 台自動歸還）。</p>
            <input autoFocus value={extractStart} onChange={e => setExtractStart(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleExtractConfirm() }}
              placeholder="例如：45"
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-800 text-sm mb-2 focus:outline-none focus:border-blue-500"
            />
            {extractErr && <p className="text-red-500 text-xs mb-2">{extractErr}</p>}
            <div className="flex gap-2 mb-2">
              <button onClick={handleExtractConfirm} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded px-3 py-2 text-sm font-medium">確認抽出</button>
              <button onClick={() => { setShowExtract(false); setExtractErr('') }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-3 py-2 text-sm">取消</button>
            </div>
            <button
              onClick={async () => { setShowExtract(false); setExtractErr(''); await switchDirectlyTo108() }}
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-600 rounded px-3 py-2 text-sm"
            >略過抽車，直接切換</button>
          </div>
        </div>
      )}

    </div>
    </div>
  )
}
