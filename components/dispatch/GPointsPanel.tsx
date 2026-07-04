'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { G_POINTS, getGPointIndex } from '@/lib/gPoints'

function GPointCell({ label, index }: { label: string; index: number | null }) {
  const { userRole, mainLine, cars, recalibrateMainLine } = useApp()
  const isAdmin = userRole === 'admin'
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [warn, setWarn] = useState('')

  const carId = index !== null ? mainLine.positions[index] ?? null : null

  const handleConfirm = async () => {
    setEditing(false)
    const input = val.trim().toUpperCase()
    if (!input || index === null) return

    if (!cars[input]) { setWarn(`找不到車號 ${input}`); return }
    if (!mainLine.positions.includes(input)) { setWarn(`${input} 目前不在正線上，無法用來校正`); return }

    const ok = await recalibrateMainLine(index, input)
    if (!ok) setWarn('校正失敗，請重試')
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{label}</span>

      {index === null ? (
        <div className="w-16 h-11 flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-300 text-xs">
          待補
        </div>
      ) : editing ? (
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') setEditing(false) }}
          className="w-16 h-11 text-center text-sm border border-blue-400 rounded outline-none"
          maxLength={4}
        />
      ) : (
        <button
          onClick={() => { if (isAdmin) { setVal(carId ?? ''); setEditing(true) } }}
          title={isAdmin ? '點擊校正此位置車號' : undefined}
          className={`w-16 h-11 flex items-center justify-center rounded border text-base font-semibold
            ${carId ? 'border-slate-400 bg-white text-slate-800' : 'border-dashed border-slate-300 bg-slate-50 text-slate-300'}
            ${isAdmin ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'}`}
        >
          {carId ?? '空'}
        </button>
      )}

      {warn && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-72 border border-slate-200 shadow-xl text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-slate-800 font-medium text-sm mb-5">{warn}</p>
            <button onClick={() => setWarn('')}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded px-5 py-2 text-sm font-medium">確認</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function GPointsPanel() {
  const { mainLine } = useApp()
  const [open, setOpen] = useState(false)
  const upPoints = G_POINTS.filter(p => p.side === 'up')
  const downPoints = G_POINTS.filter(p => p.side === 'down' || p.side === 'single')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-300 hover:text-white bg-slate-600 hover:bg-slate-500 rounded px-2 py-1 transition-colors"
        title="G 點校正"
      >
        📍 G點校正
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[600px] max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-slate-800 font-bold">📍 G 點校正</h2>
              <button onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <p className="text-slate-500 text-xs">
                控制員回報車廂經過某支柱位置的車號後，點擊對應格子輸入，系統會自動環形位移整條正線校正偏移。
              </p>

              <div className="flex items-start gap-4">
                <span className="text-xs text-slate-400 w-12 flex-shrink-0 pt-3">上坡側</span>
                <div className="flex flex-wrap gap-4">
                  {upPoints.map(p => (
                    <GPointCell key={p.key} label={p.label} index={getGPointIndex(p, mainLine.mode)} />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-xs text-slate-400 w-12 flex-shrink-0 pt-3">下坡側</span>
                <div className="flex flex-wrap gap-4">
                  {downPoints.map(p => (
                    <GPointCell key={p.key} label={p.label} index={getGPointIndex(p, mainLine.mode)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
