'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'

const LOCATION_LABELS: Record<string, string> = {
  zhuanjiaoer: '轉角二站',
  main_line: '正線',
  maokong: '貓空站',
  test_area: '自定義區',
  weekly_schedule: '週排程',
  unassigned: '未分配',
}

export function NotesPanel() {
  const { cars, updateCarNotes, userRole } = useApp()
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const isAdmin = userRole === 'admin'

  const handleDelete = async (carId: string) => {
    setDeletingId(carId)
    await updateCarNotes(carId, '')
    setDeletingId(null)
  }

  const carsWithNotes = Object.values(cars)
    .filter(c => c.notes && c.notes.trim())
    .sort((a, b) => {
      const na = parseInt(a.id), nb = parseInt(b.id)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.id.localeCompare(b.id)
    })

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="備註全覽"
        className="text-xs text-slate-300 hover:text-white bg-slate-600 hover:bg-slate-500 rounded px-2 py-1 transition-colors flex items-center gap-1"
      >
        📋
        {carsWithNotes.length > 0 && (
          <span className="bg-orange-500 text-white rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center leading-none">
            {carsWithNotes.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[480px] max-h-[75vh] flex flex-col">

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-slate-800 font-bold">📋 車廂備註</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {carsWithNotes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">目前沒有任何備註</p>
              ) : (
                <div className="space-y-2">
                  {carsWithNotes.map(car => (
                    <div key={car.id} className="flex gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-10">
                        <span className="font-bold text-slate-800 text-sm">{car.id}</span>
                        <span className="text-[10px] text-slate-400">{LOCATION_LABELS[car.location] ?? car.location}</span>
                      </div>
                      <div className="border-l border-slate-200 pl-3 flex-1 min-w-0">
                        <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap break-words">{car.notes}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(car.id)}
                          disabled={deletingId === car.id}
                          className="flex-shrink-0 text-slate-300 hover:text-red-500 disabled:opacity-40 transition-colors text-base leading-none self-start pt-0.5"
                          title="刪除備註"
                        >
                          {deletingId === car.id ? '…' : '🗑'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-3">
              <p className="text-slate-400 text-xs">共 {carsWithNotes.length} 筆備註｜右鍵車號可新增或編輯備註</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
