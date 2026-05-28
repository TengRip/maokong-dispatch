'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { CarTag } from './CarTag'
import type { MaintenanceUnit } from '@/types'

function MaintenanceUnitCard({ unit }: { unit: MaintenanceUnit }) {
  const { userRole, updateMaintenanceUnit, cars } = useApp()
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(unit.name)
  const [inputCar, setInputCar] = useState('')
  const [inputError, setInputError] = useState('')
  const isAdmin = userRole === 'admin'

  const saveName = async () => {
    setEditingName(false)
    if (nameVal !== unit.name) await updateMaintenanceUnit(unit.id, { name: nameVal })
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
    <div className="bg-white/80 rounded-lg border border-slate-300 p-2 flex-1">
      {editingName ? (
        <input
          autoFocus
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onBlur={saveName}
          onKeyDown={e => { if (e.key === 'Enter') saveName() }}
          className="w-full text-xs bg-slate-100 text-slate-900 px-1 rounded outline-none border border-blue-500 mb-1.5"
        />
      ) : (
        <div
          className={`text-xs font-medium text-purple-600 mb-1.5 ${isAdmin ? 'cursor-pointer hover:text-purple-200' : ''}`}
          onClick={() => isAdmin && setEditingName(true)}
        >
          {unit.name}
        </div>
      )}

      {/* 已登錄車號 */}
      <div className="flex flex-wrap gap-1 mb-1.5 min-h-[24px]">
        {unit.car_ids.map(cid => (
          <div key={cid} className="flex items-center gap-0.5">
            <CarTag carId={cid} draggableId={`maintenance_${unit.id}_${cid}`} compact />
            {isAdmin && (
              <button
                onClick={() => removeCar(cid)}
                className="text-slate-500 hover:text-red-400 text-[10px] leading-none"
              >×</button>
            )}
          </div>
        ))}
        {unit.car_ids.length === 0 && (
          <span className="text-slate-600 text-[10px]">（無排程）</span>
        )}
      </div>

      {/* 新增車號輸入 */}
      {isAdmin && (
        <div className="flex gap-1">
          <input
            value={inputCar}
            onChange={e => setInputCar(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCar() }}
            placeholder="輸入車號"
            className="flex-1 text-[10px] bg-slate-100 border border-slate-300 rounded px-1 py-0.5 text-slate-900 outline-none focus:border-purple-500"
            maxLength={4}
          />
          <button
            onClick={addCar}
            className="text-[10px] bg-purple-500 hover:bg-purple-400 text-slate-900 rounded px-1.5 py-0.5"
          >
            +
          </button>
        </div>
      )}
      {inputError && <p className="text-red-400 text-[10px] mt-0.5">{inputError}</p>}
    </div>
  )
}

export function MaintenancePanel() {
  const { maintenanceUnits, showMaintenancePanel, setShowMaintenancePanel, userRole } = useApp()

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-500 text-xs font-medium">維修排程區</span>
        <button
          onClick={() => setShowMaintenancePanel(!showMaintenancePanel)}
          className="text-[10px] text-slate-500 hover:text-slate-600 border border-slate-300 rounded px-1.5 py-0.5"
        >
          {showMaintenancePanel ? '收起 ▲' : '展開 ▼'}
        </button>
      </div>

      {showMaintenancePanel && (
        <div className="flex gap-2">
          {maintenanceUnits.map(unit => (
            <MaintenanceUnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  )
}
