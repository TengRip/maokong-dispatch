'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Car, MainLineState, TestArea, MaintenanceUnit, WeeklySchedule, StatusColors } from '@/types'

interface AppState {
  cars: Record<string, Car>
  mainLine: MainLineState
  testAreas: TestArea[]
  maintenanceUnits: MaintenanceUnit[]
  weeklySchedule: WeeklySchedule
  statusColors: StatusColors
  showMaintenancePanel: boolean
  visibleTestAreas: number   // 顯示幾個測試區 (0~6)
  userRole: 'admin' | 'guest'
  userEmail: string
}

interface AppActions {
  moveCar: (carId: string, toLocation: string, toSlot?: number, fromLocation?: string, fromSlot?: number) => Promise<void>
  updateCarStatus: (carId: string, status: Car['status']) => Promise<void>
  setReferencecar: (carId: string) => Promise<void>
  updateMainLineMode: (mode: 108 | 130) => Promise<void>
  updateMainLinePosition: (index: number, carId: string | null) => Promise<void>
  extractCarsFrom130To108: (startCarId: string) => Promise<void>
  updateTestArea: (areaId: number, updates: Partial<TestArea>) => Promise<void>
  updateMaintenanceUnit: (unitId: number, updates: Partial<MaintenanceUnit>) => Promise<void>
  updateWeeklySchedule: (day: string, slots: (string | null)[]) => Promise<void>
  setShowMaintenancePanel: (show: boolean) => void
  setVisibleTestAreas: (count: number) => void
  saveSnapshot: (label: string) => Promise<void>
  logOperation: (action: string, carId?: string, from?: string, to?: string, detail?: string) => Promise<void>
}

const AppContext = createContext<(AppState & AppActions) | null>(null)

export function AppProvider({ children, userRole, userEmail }: {
  children: React.ReactNode
  userRole: 'admin' | 'guest'
  userEmail: string
}) {
  const supabase = createClient()
  const isAdmin = userRole === 'admin'

  const [cars, setCars] = useState<Record<string, Car>>({})
  const [mainLine, setMainLine] = useState<MainLineState>({ mode: 108, positions: [] })
  const [testAreas, setTestAreas] = useState<TestArea[]>([])
  const [maintenanceUnits, setMaintenanceUnits] = useState<MaintenanceUnit[]>([])
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({})
  const [statusColors, setStatusColors] = useState<StatusColors>({
    available_regular: '#3B82F6',
    available_crystal: '#EAB308',
    maintenance_vehicle: '#6B7280',
    unavailable: '#EF4444',
    scrapped: '#111827',
    controlled: '#F97316',
    maintenance_needed: '#8B5CF6',
    other: '#22C55E',
  })
  const [showMaintenancePanel, setShowMaintenancePanel] = useState(false)
  const [visibleTestAreas, setVisibleTestAreas] = useState(3)

  // 初始化載入資料
  useEffect(() => {
    loadAllData()
    setupRealtime()
  }, [])

  async function loadAllData() {
    const [
      { data: carsData },
      { data: mlData },
      { data: taData },
      { data: muData },
      { data: wsData },
      { data: scData },
    ] = await Promise.all([
      supabase.from('cars').select('*'),
      supabase.from('main_line').select('*').single(),
      supabase.from('test_areas').select('*').order('id'),
      supabase.from('maintenance_units').select('*').order('id'),
      supabase.from('weekly_schedule').select('*').single(),
      supabase.from('status_colors').select('*').single(),
    ])

    if (carsData) {
      const map: Record<string, Car> = {}
      carsData.forEach((c: Car) => { map[c.id] = c })
      setCars(map)
    }
    if (mlData) setMainLine({ mode: mlData.mode, positions: mlData.positions })
    if (taData) setTestAreas(taData)
    if (muData) setMaintenanceUnits(muData)
    if (wsData) {
      const { id, updated_at, ...days } = wsData
      setWeeklySchedule(days)
    }
    if (scData) {
      const { id, updated_at, ...colors } = scData
      setStatusColors(colors as StatusColors)
    }
  }

  function setupRealtime() {
    // 監聽各表格變更，只更新對應的 state（避免整體 reload）
    const channel = supabase.channel('dispatch-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const c = payload.new as Car
          setCars(prev => ({ ...prev, [c.id]: c }))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'main_line' }, (payload) => {
        const ml = payload.new as { mode: number; positions: (string | null)[] }
        setMainLine({ mode: ml.mode as 108 | 130, positions: ml.positions })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'test_areas' }, (payload) => {
        const ta = payload.new as TestArea
        setTestAreas(prev => prev.map(a => a.id === ta.id ? ta : a))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maintenance_units' }, (payload) => {
        const mu = payload.new as MaintenanceUnit
        setMaintenanceUnits(prev => prev.map(u => u.id === mu.id ? mu : u))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'weekly_schedule' }, (payload) => {
        const ws = payload.new as Record<string, unknown>
        const { id, updated_at, ...days } = ws
        setWeeklySchedule(days as unknown as WeeklySchedule)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'status_colors' }, (payload) => {
        const sc = payload.new as Record<string, unknown>
        const { id, updated_at, ...colors } = sc
        setStatusColors(colors as unknown as StatusColors)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  // 取得維修中車號集合
  const maintenanceCarIds = new Set(
    maintenanceUnits.flatMap(u => u.car_ids)
  )

  // 計算車廂的實際顯示狀態（考慮維修排程覆蓋）
  function getEffectiveStatus(car: Car): Car['status'] {
    if (maintenanceCarIds.has(car.id) && car.status !== 'scrapped') {
      return 'maintenance_needed'
    }
    return car.status
  }

  const logOperation = useCallback(async (
    action: string, carId?: string, from?: string, to?: string, detail?: string
  ) => {
    await supabase.from('operation_logs').insert({
      user_email: userEmail,
      action,
      car_id: carId,
      from_location: from,
      to_location: to,
      detail,
    })
  }, [userEmail, supabase])

  const moveCar = useCallback(async (
    carId: string,
    toLocation: string,
    toSlot?: number,
    fromLocation?: string,
    fromSlot?: number
  ) => {
    if (!isAdmin) return
    const car = cars[carId]
    if (!car) return

    // 報廢車不能上正線
    if (toLocation === 'main_line' && car.status === 'scrapped') return

    // 樂觀更新：立即更新本地 state
    setCars(prev => ({
      ...prev,
      [carId]: { ...prev[carId], location: toLocation as Car['location'], location_slot: toSlot ?? undefined }
    }))

    // 背景送 Supabase
    const { error } = await supabase.from('cars').update({
      location: toLocation,
      location_slot: toSlot ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', carId)

    if (error) {
      // 失敗則回滾
      setCars(prev => ({ ...prev, [carId]: car }))
      console.error('moveCar 失敗:', error)
      return
    }

    logOperation('移動車廂', carId, fromLocation, toLocation, `格位 ${toSlot ?? '-'}`)
  }, [cars, isAdmin, supabase, logOperation])

  const updateCarStatus = useCallback(async (carId: string, status: Car['status']) => {
    if (!isAdmin) return
    await supabase.from('cars').update({ status, updated_at: new Date().toISOString() }).eq('id', carId)
    await logOperation('更新狀態', carId, undefined, undefined, status)
  }, [isAdmin, supabase, logOperation])

  const setReferencecar = useCallback(async (carId: string) => {
    if (!isAdmin) return
    // 先清除現有基準車
    await supabase.from('cars').update({ is_reference: false }).eq('is_reference', true)
    // 設定新基準車
    await supabase.from('cars').update({ is_reference: true }).eq('id', carId)
    await logOperation('設定基準車', carId)
  }, [isAdmin, supabase, logOperation])

  const updateMainLineMode = useCallback(async (mode: 108 | 130) => {
    if (!isAdmin) return
    await supabase.from('main_line').update({ mode, updated_at: new Date().toISOString() }).eq('id', 1)
    await logOperation('切換正線模式', undefined, undefined, undefined, `${mode} 車模式`)
  }, [isAdmin, supabase, logOperation])

  const updateMainLinePosition = useCallback(async (index: number, carId: string | null) => {
    if (!isAdmin) return
    const newPositions = [...mainLine.positions]
    while (newPositions.length <= index) newPositions.push(null)

    // 若該車已經在正線其他位置，先清掉原位（避免重複）
    if (carId) {
      const oldIdx = newPositions.indexOf(carId)
      if (oldIdx !== -1 && oldIdx !== index) newPositions[oldIdx] = null
    }

    newPositions[index] = carId

    // 樂觀更新
    const prevPositions = mainLine.positions
    setMainLine(prev => ({ ...prev, positions: newPositions }))

    const { error } = await supabase.from('main_line').update({
      positions: newPositions,
      updated_at: new Date().toISOString()
    }).eq('id', 1)

    if (error) {
      // 回滾
      setMainLine(prev => ({ ...prev, positions: prevPositions }))
      console.error('updateMainLinePosition 失敗:', error)
    }
  }, [isAdmin, mainLine.positions, supabase])

  const extractCarsFrom130To108 = useCallback(async (startCarId: string) => {
    if (!isAdmin) return
    const positions = [...mainLine.positions]
    const startIndex = positions.indexOf(startCarId)
    if (startIndex === -1) return

    const extractedIds: string[] = []
    const totalSlots = positions.length

    // 環形抽出連續22台
    for (let i = 0; i < 22; i++) {
      const idx = (startIndex + i) % totalSlots
      if (positions[idx]) {
        extractedIds.push(positions[idx]!)
        positions[idx] = null
      }
    }

    // 重整：移除 null，保持有效車號順序，補回正線
    const remaining = positions.filter(p => p !== null)
    const newPositions = remaining.slice(0, 108)

    await supabase.from('main_line').update({
      mode: 108,
      positions: newPositions,
      updated_at: new Date().toISOString()
    }).eq('id', 1)

    // 抽出的車移到轉角二站
    for (const cid of extractedIds) {
      await supabase.from('cars').update({ location: 'zhuanjiaoer', location_slot: null }).eq('id', cid)
    }

    await logOperation('130→108 抽車', startCarId, 'main_line', 'zhuanjiaoer', `抽出 ${extractedIds.join(', ')}`)
  }, [isAdmin, mainLine.positions, supabase, logOperation])

  const updateTestArea = useCallback(async (areaId: number, updates: Partial<TestArea>) => {
    if (!isAdmin) return
    await supabase.from('test_areas').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', areaId)
  }, [isAdmin, supabase])

  const updateMaintenanceUnit = useCallback(async (unitId: number, updates: Partial<MaintenanceUnit>) => {
    if (!isAdmin) return
    await supabase.from('maintenance_units').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', unitId)
    await logOperation('更新維修排程', undefined, undefined, undefined, `單位 ${unitId}`)
  }, [isAdmin, supabase, logOperation])

  const updateWeeklySchedule = useCallback(async (day: string, slots: (string | null)[]) => {
    if (!isAdmin) return
    await supabase.from('weekly_schedule').update({
      [day]: slots,
      updated_at: new Date().toISOString()
    }).eq('id', 1)
  }, [isAdmin, supabase])

  const saveSnapshot = useCallback(async (label: string) => {
    if (!isAdmin) return
    const [{ data: carsData }, { data: mlData }, { data: taData }, { data: muData }, { data: wsData }] = await Promise.all([
      supabase.from('cars').select('*'),
      supabase.from('main_line').select('*').single(),
      supabase.from('test_areas').select('*'),
      supabase.from('maintenance_units').select('*'),
      supabase.from('weekly_schedule').select('*').single(),
    ])

    await supabase.from('snapshots').insert({
      label,
      trigger: 'manual',
      main_line_data: mlData,
      cars_data: carsData,
      test_areas_data: taData,
      maintenance_data: muData,
      weekly_data: wsData,
      created_by: userEmail,
    })
    await logOperation('手動儲存快照', undefined, undefined, undefined, label)
  }, [isAdmin, supabase, userEmail, logOperation])

  return (
    <AppContext.Provider value={{
      cars, mainLine, testAreas, maintenanceUnits, weeklySchedule, statusColors,
      showMaintenancePanel, visibleTestAreas, userRole, userEmail,
      moveCar, updateCarStatus, setReferencecar, updateMainLineMode,
      updateMainLinePosition, extractCarsFrom130To108,
      updateTestArea, updateMaintenanceUnit, updateWeeklySchedule,
      setShowMaintenancePanel, setVisibleTestAreas,
      saveSnapshot, logOperation,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// 取得車廂顏色（考慮維修排程覆蓋）
export function useCarColor(carId: string) {
  const { cars, maintenanceUnits, statusColors } = useApp()
  const car = cars[carId]
  if (!car) return '#64748b'

  const maintenanceCarIds = new Set(maintenanceUnits.flatMap(u => u.car_ids))

  if (car.status === 'scrapped') return statusColors.scrapped
  if (car.status === 'unavailable') return statusColors.unavailable
  if (maintenanceCarIds.has(carId)) return statusColors.maintenance_needed
  if (car.status === 'controlled') return statusColors.controlled
  if (car.status === 'other') return statusColors.other

  // 正常可用時顯示車型色
  if (car.type === 'crystal') return statusColors.available_crystal
  if (car.type === 'maintenance_vehicle') return statusColors.maintenance_vehicle
  return statusColors.available_regular
}
