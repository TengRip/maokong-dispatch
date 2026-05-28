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
    <div
      ref={setNodeRef}
      onDoubleClick={() => { if (isAdmin) { setInputVal(carId ?? ''); setEditing(true) } }}
      className={`
        w-10 h-8 flex items-center justify-center rounded border text-[10px]
        ${isOver ? 'border-blue-500 bg-blue-900/30' : carId ? 'border-slate-500 bg-slate-700' : 'border-slate-700 bg-slate-800/40'}
        cursor-default
      `}
    >
      {editing ? (
        <input
          autoFocus
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
          className="w-full h-full text-center text-[10px] bg-slate-600 text-white outline-none rounded"
          maxLength={4}
        />
      ) : carId ? (
        <CarTag carId={carId} draggableId={`test_area_${areaId}_${slotIndex}_${carId}`} compact />
      ) : (
        <span className="text-slate-700">—</span>
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
    if (nameVal !== area.name) await updateTestArea(area.id, { name: nameVal })
  }

  const saveNotes = async () => {
    setEditingNotes(false)
    if (notesVal !== area.notes) await updateTestArea(area.id, { notes: notesVal })
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-600 p-2">
      <div className="flex items-center gap-1 mb-1.5">
        {editingName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            className="flex-1 text-xs bg-slate-700 text-white px-1 rounded outline-none border border-blue-500"
          />
        ) : (
          <span
            className={`text-xs font-medium text-slate-200 flex-1 ${isAdmin ? 'cursor-pointer hover:text-white' : ''}`}
            onClick={() => isAdmin && setEditingName(true)}
          >
            {area.name || `測試區 ${area.id}`}
          </span>
        )}
      </div>

      {/* 6 個車格 */}
      <div className="flex gap-1 mb-1.5">
        {area.slots.map((carId, i) => (
          <TestAreaSlot key={i} areaId={area.id} slotIndex={i} carId={carId} />
        ))}
      </div>

      {/* 備註 */}
      {editingNotes ? (
        <textarea
          autoFocus
          value={notesVal}
          onChange={e => setNotesVal(e.target.value)}
          onBlur={saveNotes}
          className="w-full text-[10px] bg-slate-700 text-slate-300 px-1 rounded outline-none border border-blue-500 resize-none"
          rows={2}
        />
      ) : (
        <p
          className={`text-[10px] text-slate-500 truncate ${isAdmin ? 'cursor-pointer hover:text-slate-400' : ''}`}
          onClick={() => isAdmin && setEditingNotes(true)}
        >
          {area.notes || '點擊新增備註…'}
        </p>
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
        <span className="text-slate-400 text-xs font-medium">測試區</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-500 text-[10px]">顯示：</span>
          {[0, 1, 2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              onClick={() => isAdmin && setVisibleTestAreas(n)}
              className={`w-5 h-5 text-[10px] rounded ${
                visibleTestAreas === n ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {testAreas.slice(0, visibleTestAreas).map(area => (
        <TestAreaCard key={area.id} area={area} />
      ))}
    </div>
  )
}
