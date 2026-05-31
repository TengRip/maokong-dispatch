'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import type { MaintenanceUnit } from '@/types'

function MaintenanceCarChip({ carId }: { carId: string }) {
  return (
    <div
      style={{ width: 34, height: 28 }}
      className="flex items-center justify-center rounded-sm border border-dashed border-purple-400 bg-white text-purple-600 text-xs font-bold select-none"
    >
      {carId}
    </div>
  )
}

function MaintenanceUnitCard({ unit }: { unit: MaintenanceUnit }) {
  const { userRole, updateMaintenanceUnit, cars } = useApp()
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(unit.name)
  const [inputCar, setInputCar] = useState('')
  const [inputError, setInputError] = useState('')
  const isAdmin = userRole === 'admin'

  const saveName = async () => {
    setEditingName(false)
    if (nameVal.trim() && nameVal !== unit.name)
      await updateMaintenanceUnit(unit.id, { name: nameVal.trim() })
    else setNameVal(unit.name)
  }

  const addCar = async () => {
    const cid = inputCar.trim().toUpperCase()
    setInputError('')
    if (!cid) return
    if (!cars[cid]) { setInputError('車號不存在'); return }
    if (unit.car_ids.includes(cid)) { setInputError('已在此單位'); return }
    await updateMaintenanceUnit(unit.id, { car_ids: [...unit.car_ids, cid] })
    setInputCar('')
  }

  const removeCar = async (cid: string) => {
    await updateMaintenanceUnit(unit.id, { car_ids: unit.car_ids.filter(id => id !== cid) })
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-2">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-2">
        {editingName ? (
          <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
            onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(unit.name); setEditingName(false) } }}
            className="flex-1 text-xs bg-slate-100 text-slate-900 px-1 py-0.5 rounded outline-none border border-blue-500"
          />
        ) : (
          <span className="text-sm font-semibold text-purple-700">{unit.name}</span>
        )}
        {isAdmin && !editingName && (
          <button onClick={() => setEditingName(true)}
            className="text-base leading-none p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 ml-1">✏️</button>
        )}
      </div>

      {/* 已登錄車號（34×28 格子，每排最多 6 台換行） */}
      <div className="mb-2 min-h-[28px]">
        {unit.car_ids.length === 0
          ? <span className="text-slate-400 text-[10px]">（無排程）</span>
          : <div style={{ display: 'grid', gridTemplateColumns: `repeat(${unit.id === 3 ? 3 : unit.id === 2 ? 4 : 5}, max-content)`, gap: 4 }}>
              {[...unit.car_ids].sort((a, b) => {
                const na = parseInt(a), nb = parseInt(b)
                if (!isNaN(na) && !isNaN(nb)) return na - nb
                if (!isNaN(na)) return -1
                if (!isNaN(nb)) return 1
                return a.localeCompare(b)
              }).map(cid => (
                <div key={cid} className="flex items-center gap-0.5">
                  <MaintenanceCarChip carId={cid} />
                  {isAdmin && (
                    <button
                      onClick={() => removeCar(cid)}
                      className="text-red-400 hover:text-red-600 text-sm leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-red-50"
                    >×</button>
                  )}
                </div>
              ))}
            </div>
        }
      </div>

      {/* 新增輸入 */}
      {isAdmin && (
        <div className="flex gap-1">
          <input value={inputCar} onChange={e => setInputCar(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCar() } }}
            placeholder="輸入車號 Enter 新增"
            className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-slate-900 outline-none focus:border-purple-400"
            maxLength={4}
          />
          <button onClick={addCar}
            className="text-xs bg-purple-500 hover:bg-purple-600 text-white rounded px-2 py-1">+</button>
        </div>
      )}
      {inputError && <p className="text-red-500 text-xs mt-0.5">{inputError}</p>}
    </div>
  )
}

interface MaintenancePanelProps {
  // inline 模式：標題常駐展開、A B C 橫排（用於迴圈中央）
  mode?: 'sidebar' | 'inline'
}

export function MaintenancePanel({ mode = 'sidebar' }: MaintenancePanelProps) {
  const { maintenanceUnits, showMaintenancePanel, setShowMaintenancePanel } = useApp()

  if (mode === 'inline') {
    return (
      <div>
        <div className="text-slate-600 text-base font-semibold mb-2">維修排程區</div>
        <div className="flex flex-row gap-2">
          {maintenanceUnits.map(unit => (
            <MaintenanceUnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-600 text-xs font-semibold">維修排程區</span>
        <button onClick={() => setShowMaintenancePanel(!showMaintenancePanel)}
          className="text-[10px] text-slate-500 hover:text-slate-700 border border-slate-300 rounded px-1.5 py-0.5 bg-white">
          {showMaintenancePanel ? '收起 ▲' : '展開 ▼'}
        </button>
      </div>
      {showMaintenancePanel && (
        <div className="flex flex-col gap-2">
          {maintenanceUnits.map(unit => (
            <MaintenanceUnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  )
}
