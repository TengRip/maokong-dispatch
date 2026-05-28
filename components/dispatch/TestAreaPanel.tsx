'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'
import type { TestArea } from '@/types'

function TestAreaSlot({ areaId, slotIndex, carId }: { areaId: number; slotIndex: number; carId: string | null }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `test_area_${areaId}_slot_${slotIndex}`,
    data: { location: 'test_area', areaId, slot: slotIndex },
  })
  const { userRole, updateTestArea, testAreas } = useApp()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const isAdmin = userRole === 'admin'

  const handleConfirm = async () => {
    const val = inputVal.trim().toUpperCase()
    setEditing(false)
    if (val === carId) return
    const area = testAreas.find(a => a.id === areaId)
    if (!area) return
    const newSlots = [...area.slots] as (string | null)[]
    newSlots[slotIndex] = val || null
    await updateTestArea(areaId, { slots: newSlots })
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
        <div onDoubleClick={() => isAdmin && (() => { setInputVal(carId); setEditing(true) })()}>
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
    <div className="bg-white rounded-lg border border-slate-200 p-2">
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
              {area.name || `測試區 ${area.id}`}
            </span>
            {isAdmin && (
              <button onClick={() => setEditingName(true)} className="text-[10px] text-slate-400 hover:text-slate-600" title="改名">✏</button>
            )}
          </>
        )}
      </div>

      {/* 6 個車格（可拖入，或點 + 輸入） */}
      <div className="flex gap-1 mb-1.5">
        {area.slots.map((carId, i) => (
          <TestAreaSlot key={i} areaId={area.id} slotIndex={i} carId={carId} />
        ))}
      </div>

      {/* 備註 */}
      {editingNotes ? (
        <textarea autoFocus value={notesVal} onChange={e => setNotesVal(e.target.value)}
          onBlur={saveNotes}
          className="w-full text-[10px] bg-slate-50 text-slate-600 px-1 py-0.5 rounded outline-none border border-blue-400 resize-none"
          rows={2}
        />
      ) : (
        <div className="flex items-center gap-1">
          <p className="flex-1 text-[10px] text-slate-400 truncate">
            {area.notes || '（無備註）'}
          </p>
          {isAdmin && (
            <button onClick={() => { setNotesVal(area.notes); setEditingNotes(true) }}
              className="text-[10px] text-slate-400 hover:text-slate-600 flex-shrink-0" title="編輯備註">✏</button>
          )}
        </div>
      )}
    </div>
  )
}

export function TestAreaPanel() {
  const { testAreas, visibleTestAreas, setVisibleTestAreas, userRole } = useApp()
  const isAdmin = userRole === 'admin'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-600 text-xs font-semibold">測試區</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[10px]">顯示：</span>
          {[0, 1, 2, 3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => isAdmin && setVisibleTestAreas(n)}
              className={`w-5 h-5 text-[10px] rounded ${visibleTestAreas === n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >{n}</button>
          ))}
        </div>
      </div>

      {testAreas.slice(0, visibleTestAreas).map(area => (
        <TestAreaCard key={area.id} area={area} />
      ))}
    </div>
  )
}
