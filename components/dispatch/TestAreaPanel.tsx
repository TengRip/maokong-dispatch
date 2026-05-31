'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { getCarOccupiedLabel } from '@/lib/utils'
import { CarTag } from './CarTag'
import type { TestArea } from '@/types'

function TestAreaSlot({ areaId, slotIndex, carId, onWarn }: {
  areaId: number; slotIndex: number; carId: string | null; onWarn: (msg: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `test_area_${areaId}_slot_${slotIndex}`,
    data: { location: 'test_area', areaId, slot: slotIndex },
  })
  const { userRole, updateTestArea, testAreas, cars, mainLine, weeklySchedule, moveCar } = useApp()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const isAdmin = userRole === 'admin'

  const handleConfirm = async () => {
    const val = inputVal.trim().toUpperCase()
    setEditing(false)
    if (val === carId) return
    const area = testAreas.find(a => a.id === areaId)
    if (!area) return

    // 補齊 9 格
    const newSlots = Array.from({ length: 9 }, (_, i) => area.slots[i] ?? null) as (string | null)[]

    if (!val) {
      // 清空格子：把原本的車歸回儲車區
      newSlots[slotIndex] = null
      await updateTestArea(areaId, { slots: newSlots })
      if (carId) await moveCar(carId, 'zhuanjiaoer', undefined, 'test_area')
      return
    }

    if (!cars[val]) { onWarn(`找不到車號 ${val}`); return }

    // 檢查是否已在同一自定義區的其他格
    const sameAreaSlot = area.slots.indexOf(val)
    if (sameAreaSlot !== -1 && sameAreaSlot !== slotIndex) {
      onWarn(`${val} 已在此自定義區第 ${sameAreaSlot + 1} 格，無法重複放入`); return
    }

    // 檢查是否已在其他排班區
    const occupied = getCarOccupiedLabel(val, mainLine, testAreas, weeklySchedule, areaId)
    if (occupied) { onWarn(`${val} 目前在${occupied}，請先將其移回儲車區`); return }

    // 若原格有車，先送回儲車區
    if (carId) await moveCar(carId, 'zhuanjiaoer', undefined, 'test_area')
    newSlots[slotIndex] = val
    await updateTestArea(areaId, { slots: newSlots })
    // 同步更新 cars.location
    await moveCar(val, 'test_area', undefined, cars[val].location)
  }

  return (
    <div ref={setNodeRef}
      className={`w-10 h-8 flex items-center justify-center rounded border text-[10px] cursor-default
        ${isOver ? 'border-blue-400 bg-blue-50' : carId ? 'border-slate-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`}
    >
      {editing ? (
        <input autoFocus value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full h-full text-center text-[10px] bg-white text-slate-800 outline-none"
          maxLength={4}
        />
      ) : carId ? (
        <div className="w-full h-full" onDoubleClick={() => isAdmin && (() => { setInputVal(carId); setEditing(true) })()}>
          <CarTag carId={carId} draggableId={`test_area_${areaId}_${slotIndex}_${carId}`} compact />
        </div>
      ) : (
        <button onClick={() => isAdmin && (() => { setInputVal(''); setEditing(true) })()}
          className={`w-full h-full flex items-center justify-center text-slate-300 text-[10px] ${isAdmin ? 'hover:text-slate-500 hover:bg-slate-100 cursor-pointer' : ''}`}
          title={isAdmin ? '點擊輸入車號' : ''}
        >+</button>
      )}
    </div>
  )
}

function TestAreaCard({ area }: { area: TestArea }) {
  const { userRole, updateTestArea } = useApp()
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(area.name)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesVal, setNotesVal] = useState(area.notes)
  const [warnMsg, setWarnMsg] = useState('')
  const isAdmin = userRole === 'admin'

  const saveName = async () => {
    setEditingName(false)
    if (nameVal.trim() && nameVal !== area.name) await updateTestArea(area.id, { name: nameVal.trim() })
    else setNameVal(area.name)
  }

  const saveNotes = async () => {
    setEditingNotes(false)
    if (notesVal !== area.notes) await updateTestArea(area.id, { notes: notesVal })
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-2 w-36">
      {/* 名稱列 */}
      <div className="flex items-center gap-1 mb-1.5">
        {editingName ? (
          <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
            onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(area.name); setEditingName(false) } }}
            className="flex-1 text-xs bg-slate-100 text-slate-900 px-1 py-0.5 rounded outline-none border border-blue-500"
          />
        ) : (
          <>
            <span className="flex-1 text-xs font-semibold text-slate-700">
              {area.name || `自定義區 ${area.id}`}
            </span>
            {isAdmin && (
              <button onClick={() => setEditingName(true)} className="text-[10px] text-slate-400 hover:text-slate-600" title="改名">✏</button>
            )}
          </>
        )}
      </div>

      {/* 9 個車格（3×3） */}
      <div className="grid grid-cols-3 gap-1 mb-1.5">
        {Array.from({ length: 9 }, (_, i) => area.slots[i] ?? null).map((carId, i) => (
          <TestAreaSlot key={i} areaId={area.id} slotIndex={i} carId={carId} onWarn={setWarnMsg} />
        ))}
      </div>

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

      {/* 備註：標題列固定顯示編輯按鈕，內容獨立一行避免覆蓋 */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-slate-400">備註</span>
          {isAdmin && !editingNotes && (
            <button onClick={() => { setNotesVal(area.notes); setEditingNotes(true) }}
              className="text-[10px] text-slate-400 hover:text-slate-600 flex-shrink-0" title="編輯備註">✏</button>
          )}
        </div>
        {editingNotes ? (
          <textarea autoFocus value={notesVal} onChange={e => setNotesVal(e.target.value)}
            onBlur={saveNotes}
            className="w-full text-[10px] bg-slate-50 text-slate-600 px-1 py-0.5 rounded outline-none border border-blue-400 resize-none"
            rows={2}
          />
        ) : (
          <p className="text-[10px] text-blue-600 break-words whitespace-pre-wrap">
            {area.notes || '（無備註）'}
          </p>
        )}
      </div>
    </div>
  )
}

interface TestAreaPanelProps {
  mode?: 'sidebar' | 'inline'
}

export function TestAreaPanel({ mode = 'sidebar' }: TestAreaPanelProps) {
  const { testAreas, visibleTestAreas, setVisibleTestAreas, userRole } = useApp()
  const isAdmin = userRole === 'admin'

  const header = (
    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
      <span className="text-slate-600 text-base font-semibold">自定義區</span>
      <div className="flex items-center gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
          <button key={n} onClick={() => isAdmin && setVisibleTestAreas(n)}
            className={`w-5 h-5 text-[10px] rounded ${visibleTestAreas === n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >{n}</button>
        ))}
      </div>
    </div>
  )

  if (mode === 'inline') {
    return (
      <div>
        {header}
        {/* 橫排：最多六區，超過自動換行 */}
        <div className="flex flex-wrap gap-2">
          {testAreas.slice(0, visibleTestAreas).map(area => (
            <TestAreaCard key={area.id} area={area} />
          ))}
          {visibleTestAreas === 0 && (
            <span className="text-slate-400 text-[10px]">（已隱藏）</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {header}
      {testAreas.slice(0, visibleTestAreas).map(area => (
        <TestAreaCard key={area.id} area={area} />
      ))}
    </div>
  )
}
