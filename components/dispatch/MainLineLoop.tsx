'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'

// 格子尺寸
const SW = 34   // 寬
const SH = 28   // 高
const GAP = 1   // 間距
const RW = SW + GAP  // 水平單位
const RH = SH + GAP  // 垂直單位

function getSegments(mode: 108 | 130) {
  // 108 = 30+24+30+24 ; 130 = 36+29+36+29
  return mode === 108
    ? { top: 30, right: 24, bottom: 30, left: 24 }
    : { top: 36, right: 29, bottom: 36, left: 29 }
}

// loopWidth = 左角 + top格子 + 右角 = (top+2)個SW + (top+1)個GAP
function calcDims(top: number, side: number) {
  const loopWidth  = (top + 2) * SW + (top + 1) * GAP
  const loopHeight = (side + 2) * SH + (side + 1) * GAP
  return { loopWidth, loopHeight }
}

// 各槽的絕對座標（確保完美對齊）
function topX(dPos: number)    { return RW + dPos * RW }          // 上排第 dPos 格 x
function bottomX(dPos: number) { return RW + dPos * RW }          // 下排第 dPos 格 x
function sideY(dPos: number)   { return RH + dPos * RH }          // 側邊第 dPos 格 y

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
        <span className="text-slate-200 text-[7px]">{index + 1}</span>
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

  // 各邊索引
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

      {/* ── 矩形迴圈（絕對定位，每格座標精確計算）── */}
      <div style={{ position: 'relative', width: loopWidth, height: loopHeight }}>

        {/* 邊框線（用 SVG 畫清楚的矩形邊框） */}
        <svg style={{ position: 'absolute', inset: 0, width: loopWidth, height: loopHeight, overflow: 'visible', pointerEvents: 'none' }}>
          {/* 外框矩形（只畫邊線，不填色） */}
          <rect x={SW/2} y={SH/2} width={loopWidth-SW} height={loopHeight-SH}
            fill="none" stroke="#94a3b8" strokeWidth="1.5" rx="6" />
          {/* 去程箭頭（左側中間往上） */}
          <text x={SW/2} y={loopHeight/2-8} textAnchor="middle" fontSize="10" fill="#3b82f6">↑</text>
          <text x={SW/2} y={loopHeight/2+12} textAnchor="middle" fontSize="8" fill="#3b82f6">去程</text>
          {/* 回程箭頭（右側中間往下） */}
          <text x={loopWidth-SW/2} y={loopHeight/2-8} textAnchor="middle" fontSize="10" fill="#f97316">↓</text>
          <text x={loopWidth-SW/2} y={loopHeight/2+12} textAnchor="middle" fontSize="8" fill="#f97316">回程</text>
        </svg>

        {/* 上排：回程（貓空→轉角），由右往左顯示 */}
        {[...topIdx].reverse().map((idx, dPos) => (
          <div key={`t${idx}`} style={{ position: 'absolute', left: topX(dPos), top: 0 }}>
            <LoopSlot index={idx} carId={getSlotCar(idx)} />
          </div>
        ))}

        {/* 右側：回程，由上往下 */}
        {rightIdx.map((idx, dPos) => (
          <div key={`r${idx}`} style={{ position: 'absolute', left: loopWidth - SW, top: sideY(dPos) }}>
            <LoopSlot index={idx} carId={getSlotCar(idx)} />
          </div>
        ))}

        {/* 下排：去程（轉角→貓空），由左往右 */}
        {bottomIdx.map((idx, dPos) => (
          <div key={`b${idx}`} style={{ position: 'absolute', left: bottomX(dPos), top: loopHeight - SH }}>
            <LoopSlot index={idx} carId={getSlotCar(idx)} />
          </div>
        ))}

        {/* 左側：去程，由下往上（reversed = 最上面是最高索引） */}
        {[...leftIdx].reverse().map((idx, dPos) => (
          <div key={`l${idx}`} style={{ position: 'absolute', left: 0, top: sideY(dPos) }}>
            <LoopSlot index={idx} carId={getSlotCar(idx)} />
          </div>
        ))}

        {/* 中央大面積拖放目標 */}
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
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
        >
          <div className="text-center pointer-events-none">
            <div className="text-blue-500 text-xs font-medium mb-1">↑ 去程</div>
            <div className="text-slate-400 text-[10px] leading-5">
              <div>轉角二站 ⇅ 貓空站</div>
            </div>
            <div className="text-orange-500 text-xs font-medium mt-1">回程 ↓</div>
            {isCenterOver && (
              <div className="text-blue-600 text-[10px] bg-white border border-blue-200 rounded px-2 py-0.5 mt-2">
                放開→插入第一空格
              </div>
            )}
          </div>
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
