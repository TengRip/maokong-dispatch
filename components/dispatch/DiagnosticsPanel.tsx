'use client'

import { useState, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import type { Car, TestArea } from '@/types'

const LOCATION_LABELS: Record<string, string> = {
  zhuanjiaoer:    '轉角二站儲車區',
  main_line:      '正線',
  maokong:        '貓空站儲車區',
  test_area:      '測試區',
  weekly_schedule:'週排程',
  unassigned:     '未分配',
}

const DAY_LABELS: Record<string, string> = {
  monday: '一', tuesday: '二', wednesday: '三', thursday: '四', friday: '五',
}

type IssueType = 'unassigned' | 'orphan_main' | 'ghost_main' | 'orphan_test' | 'orphan_weekly' | 'ghost_weekly' | 'ghost_test' | 'duplicate'

interface Issue {
  carId: string
  type: IssueType
  detail: string
}

interface ScanResult {
  counts: Record<string, number>
  total: number
  issues: Issue[]
  ghostPositions: number[]   // main_line positions array indices 含幽靈車號
}

function runScan(
  cars: ReturnType<typeof useApp>['cars'],
  mainLine: ReturnType<typeof useApp>['mainLine'],
  testAreas: ReturnType<typeof useApp>['testAreas'],
  weeklySchedule: ReturnType<typeof useApp>['weeklySchedule'],
): ScanResult {
  const issues: Issue[] = []

  // 統計各區數量
  const counts: Record<string, number> = {
    zhuanjiaoer: 0, main_line: 0, maokong: 0,
    test_area: 0, weekly_schedule: 0, unassigned: 0,
  }
  for (const car of Object.values(cars)) {
    if (counts[car.location] !== undefined) counts[car.location]++
    else counts.unassigned++
  }

  // 建立各區實際出現的車號集合
  const posSet = new Set(mainLine.positions.filter(Boolean) as string[])
  const testSet = new Set(testAreas.flatMap(a => a.slots.filter(Boolean) as string[]))
  const weeklySet = new Set(
    Object.values(weeklySchedule).flatMap(
      slots => (slots as (string | null)[]).filter(Boolean) as string[]
    )
  )

  // 重複出現偵測：同一車號出現在多個 slot 陣列
  const allSlotEntries: [string, string][] = []
  mainLine.positions.forEach((cid, i) => { if (cid) allSlotEntries.push([cid, `正線[${i + 1}]`]) })
  testAreas.forEach(a => a.slots.forEach((cid, i) => { if (cid) allSlotEntries.push([cid, `${a.name}[${i + 1}]`]) }))
  Object.entries(weeklySchedule).forEach(([day, slots]) =>
    (slots as (string | null)[]).forEach((cid, i) => { if (cid) allSlotEntries.push([cid, `週${DAY_LABELS[day]}[${i + 1}]`]) })
  )
  const slotMap = new Map<string, string[]>()
  for (const [cid, where] of allSlotEntries) {
    if (!slotMap.has(cid)) slotMap.set(cid, [])
    slotMap.get(cid)!.push(where)
  }
  for (const [cid, places] of slotMap.entries()) {
    if (places.length > 1) {
      issues.push({ carId: cid, type: 'duplicate', detail: `重複出現：${places.join('、')}` })
    }
  }

  // 逐台車審查
  for (const car of Object.values(cars)) {
    if (car.location === 'unassigned') {
      issues.push({ carId: car.id, type: 'unassigned', detail: '未分配（不在任何區域）' })
    } else if (car.location === 'main_line' && !posSet.has(car.id)) {
      issues.push({ carId: car.id, type: 'orphan_main', detail: '正線孤兒：cars 表顯示在正線，但 positions[] 無此車' })
    } else if (car.location === 'test_area' && !testSet.has(car.id)) {
      issues.push({ carId: car.id, type: 'orphan_test', detail: '測試區孤兒：cars 表顯示在測試區，但各 slots 無此車' })
    } else if (car.location === 'weekly_schedule' && !weeklySet.has(car.id)) {
      issues.push({ carId: car.id, type: 'orphan_weekly', detail: '週排程孤兒：cars 表顯示在週排程，但各 slots 無此車' })
    }
  }

  // 正線幽靈：positions[] 有車號，但 cars[id].location != main_line
  const ghostPositions: number[] = []
  mainLine.positions.forEach((cid, i) => {
    if (cid && cars[cid] && cars[cid].location !== 'main_line') {
      ghostPositions.push(i)
      if (!issues.find(x => x.carId === cid && x.type === 'ghost_main')) {
        issues.push({ carId: cid, type: 'ghost_main', detail: `正線幽靈：positions[${i + 1}] 有此車，但 cars 表位置為 ${LOCATION_LABELS[cars[cid].location] ?? cars[cid].location}` })
      }
    }
  })

  // 週排程幽靈：weekly_schedule slot 有車號，但 cars[id].location != weekly_schedule
  Object.entries(weeklySchedule).forEach(([day, slots]) => {
    (slots as (string | null)[]).forEach((cid, i) => {
      if (cid && cars[cid] && cars[cid].location !== 'weekly_schedule') {
        if (!issues.find(x => x.carId === cid && x.type === 'ghost_weekly')) {
          issues.push({ carId: cid, type: 'ghost_weekly', detail: `週排程幽靈：週${DAY_LABELS[day] ?? day}[${i + 1}] 有此車，但 cars 表位置為 ${LOCATION_LABELS[cars[cid].location] ?? cars[cid].location}` })
        }
      }
    })
  })

  // 測試區幽靈：test_area slot 有車號，但 cars[id].location != test_area
  testAreas.forEach(a => {
    a.slots.forEach((cid, i) => {
      if (cid && cars[cid] && cars[cid].location !== 'test_area') {
        if (!issues.find(x => x.carId === cid && x.type === 'ghost_test')) {
          issues.push({ carId: cid, type: 'ghost_test', detail: `測試區幽靈：${a.name}[${i + 1}] 有此車，但 cars 表位置為 ${LOCATION_LABELS[cars[cid].location] ?? cars[cid].location}` })
        }
      }
    })
  })

  return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0), issues, ghostPositions }
}

export function DiagnosticsPanel() {
  const { userRole } = useApp()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [fixing, setFixing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [fixMsg, setFixMsg] = useState('')
  const supabase = createClient()

  if (userRole !== 'admin') return null

  // 每次都直接從 DB 撈最新資料掃描，不依賴可能過時的 React state
  const fetchAndScan = useCallback(async () => {
    setScanning(true)
    setFixMsg('')

    const [
      { data: carsData },
      { data: mlData },
      { data: taData },
      { data: wsData },
    ] = await Promise.all([
      supabase.from('cars').select('*'),
      supabase.from('main_line').select('*').single(),
      supabase.from('test_areas').select('*').order('id'),
      supabase.from('weekly_schedule').select('*').single(),
    ])

    if (!carsData || !mlData) { setScanning(false); return }

    const carsMap: Record<string, Car> = {}
    carsData.forEach((c: Car) => { carsMap[c.id] = c })

    const ml = { mode: mlData.mode as 108 | 130, positions: mlData.positions as (string | null)[] }
    const { id: _id, updated_at: _ts, ...days } = (wsData ?? {}) as Record<string, unknown>

    setResult(runScan(carsMap, ml, (taData ?? []) as TestArea[], days as ReturnType<typeof useApp>['weeklySchedule']))
    setScanning(false)
  }, [supabase])

  const handleOpen = () => {
    setOpen(true)
    fetchAndScan()
  }

  const handleScan = () => { fetchAndScan() }

  const handleFix = async () => {
    if (!result) return
    setFixing(true)
    setFixMsg('')

    const toFix = result.issues
      .filter(i => ['unassigned', 'orphan_main', 'orphan_test', 'orphan_weekly'].includes(i.type))
      .map(i => i.carId)

    if (toFix.length > 0) {
      await supabase.from('cars')
        .update({ location: 'zhuanjiaoer', location_slot: null })
        .in('id', [...new Set(toFix)])
    }

    // 清除幽靈：直接從 DB 取最新 positions 再修改，避免用到過時的 React state
    if (result.ghostPositions.length > 0) {
      const { data: freshMl } = await supabase.from('main_line').select('positions').single()
      const newPositions = [...((freshMl?.positions ?? []) as (string | null)[])]
      result.ghostPositions.forEach(i => { newPositions[i] = null })
      await supabase.from('main_line')
        .update({ positions: newPositions, updated_at: new Date().toISOString() })
        .eq('id', 1)
    }

    // 修復週排程幽靈和測試區幽靈：直接清除 slot 中的幽靈車號
    const ghostWeeklyIds = new Set(result.issues.filter(i => i.type === 'ghost_weekly').map(i => i.carId))
    const ghostTestIds = new Set(result.issues.filter(i => i.type === 'ghost_test').map(i => i.carId))

    if (ghostWeeklyIds.size > 0) {
      const { data: freshWsGhost } = await supabase.from('weekly_schedule').select('*').single()
      if (freshWsGhost) {
        const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        const wsUpdates: Record<string, unknown> = {}
        for (const day of DAYS) {
          const slots = [...((freshWsGhost[day as keyof typeof freshWsGhost] ?? Array(10).fill(null)) as (string | null)[])]
          const cleaned = slots.map(cid => (cid && ghostWeeklyIds.has(cid) ? null : cid))
          if (cleaned.some((s, i) => s !== slots[i])) wsUpdates[day] = cleaned
        }
        if (Object.keys(wsUpdates).length > 0)
          await supabase.from('weekly_schedule').update({ ...wsUpdates, updated_at: new Date().toISOString() }).eq('id', 1)
      }
    }

    if (ghostTestIds.size > 0) {
      const { data: freshTaGhost } = await supabase.from('test_areas').select('*').order('id')
      for (const ta of (freshTaGhost ?? [])) {
        const slots = (ta.slots as (string | null)[]).map(cid => (cid && ghostTestIds.has(cid) ? null : cid))
        if (slots.some((s: string | null, i: number) => s !== (ta.slots as (string | null)[])[i]))
          await supabase.from('test_areas').update({ slots, updated_at: new Date().toISOString() }).eq('id', ta.id)
      }
    }

    // 修復重複（duplicate）：從 DB 取最新 slot 資料，保留每台車的第一個出現，其餘清除
    const dupCarIds = [...new Set(result.issues.filter(i => i.type === 'duplicate').map(i => i.carId))]
    if (dupCarIds.length > 0) {
      const [{ data: freshWs }, { data: freshTa }, { data: freshMlDup }] = await Promise.all([
        supabase.from('weekly_schedule').select('*').single(),
        supabase.from('test_areas').select('*').order('id'),
        supabase.from('main_line').select('positions').single(),
      ])

      for (const carId of dupCarIds) {
        let kept = false

        // 正線 positions
        const mlPos = [...((freshMlDup?.positions ?? []) as (string | null)[])]
        let mlDirty = false
        mlPos.forEach((cid, i) => {
          if (cid === carId) { if (!kept) kept = true; else { mlPos[i] = null; mlDirty = true } }
        })
        if (mlDirty) await supabase.from('main_line').update({ positions: mlPos, updated_at: new Date().toISOString() }).eq('id', 1)

        // 測試區 slots
        for (const ta of (freshTa ?? [])) {
          const slots = [...(ta.slots as (string | null)[])]
          let dirty = false
          slots.forEach((cid, i) => {
            if (cid === carId) { if (!kept) kept = true; else { slots[i] = null; dirty = true } }
          })
          if (dirty) await supabase.from('test_areas').update({ slots, updated_at: new Date().toISOString() }).eq('id', ta.id)
        }

        // 週排程各天
        if (freshWs) {
          const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          const wsUpdates: Record<string, unknown> = {}
          for (const day of DAYS) {
            const slots = [...((freshWs[day as keyof typeof freshWs] ?? Array(10).fill(null)) as (string | null)[])]
            let dirty = false
            slots.forEach((cid, i) => {
              if (cid === carId) { if (!kept) kept = true; else { slots[i] = null; dirty = true } }
            })
            if (dirty) wsUpdates[day] = slots
          }
          if (Object.keys(wsUpdates).length > 0)
            await supabase.from('weekly_schedule').update({ ...wsUpdates, updated_at: new Date().toISOString() }).eq('id', 1)
        }
      }
    }

    setFixing(false)
    setFixMsg(`✓ 已修復 ${toFix.length} 台孤兒車廂、清除 ${result.ghostPositions.length} 個幽靈格位、修正 ${dupCarIds.length} 台重複車廂`)
    setResult(prev => prev ? { ...prev, issues: [], ghostPositions: [] } : prev)
  }

  const EXPECTED = 149

  const issueColor: Record<IssueType, string> = {
    unassigned:     'text-red-600 bg-red-50',
    orphan_main:    'text-orange-600 bg-orange-50',
    ghost_main:     'text-orange-600 bg-orange-50',
    orphan_test:    'text-yellow-700 bg-yellow-50',
    orphan_weekly:  'text-yellow-700 bg-yellow-50',
    ghost_weekly:   'text-orange-600 bg-orange-50',
    ghost_test:     'text-orange-600 bg-orange-50',
    duplicate:      'text-purple-600 bg-purple-50',
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs text-slate-300 hover:text-white bg-slate-600 hover:bg-slate-500 rounded px-2 py-1 transition-colors"
        title="車廂診斷"
      >
        🔍 診斷
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[600px] max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-slate-800 font-bold">🔍 車廂總覽診斷</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleScan} disabled={scanning}
                  className="text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded px-3 py-1.5">
                  {scanning ? '掃描中…' : '重新掃描'}
                </button>
                <button onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-xl leading-none ml-2">×</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {result && (
                <>
                  {/* 位置統計 */}
                  <div>
                    <h3 className="text-slate-600 text-xs font-semibold mb-2">位置統計</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(LOCATION_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-2">
                          <span className="text-slate-600 text-xs">{label}</span>
                          <span className="font-bold text-slate-800 text-sm">{result.counts[key] ?? 0}</span>
                        </div>
                      ))}
                    </div>

                    {/* 總計 */}
                    <div className={`mt-2 flex items-center justify-between rounded px-3 py-2 border font-semibold
                      ${result.total === EXPECTED ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      <span className="text-sm">合計</span>
                      <span className="text-base">
                        {result.total} / {EXPECTED}
                        {result.total === EXPECTED ? ' ✓' : ` ⚠ 差 ${EXPECTED - result.total} 台`}
                      </span>
                    </div>
                  </div>

                  {/* 異常列表 */}
                  <div>
                    <h3 className="text-slate-600 text-xs font-semibold mb-2">
                      異常偵測
                      {result.issues.length === 0
                        ? <span className="ml-2 text-green-600 font-normal">無異常 ✓</span>
                        : <span className="ml-2 text-red-600 font-normal">發現 {result.issues.length} 筆</span>
                      }
                    </h3>

                    {result.issues.length > 0 ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {result.issues.map((issue, i) => (
                          <div key={i} className={`flex items-start gap-2 rounded px-3 py-2 text-xs ${issueColor[issue.type]}`}>
                            <span className="font-bold shrink-0 w-10">{issue.carId}</span>
                            <span>{issue.detail}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-green-600 text-sm bg-green-50 rounded-lg border border-green-200">
                        所有 {EXPECTED} 台車廂狀態正常 🎉
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {result && result.issues.length > 0 && (
              <div className="border-t border-slate-200 px-5 py-3 flex items-center gap-3">
                <button
                  onClick={handleFix}
                  disabled={fixing}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-medium"
                >
                  {fixing ? '修復中…' : `🔧 一鍵修復（${result.issues.length} 筆）`}
                </button>
                {fixMsg && <span className="text-green-600 text-xs">{fixMsg}</span>}
                <span className="text-slate-400 text-xs ml-auto">異常車廂將移回轉角二站</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
