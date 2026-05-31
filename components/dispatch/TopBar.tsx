'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { SettingsPanel } from './SettingsPanel'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { NotesPanel } from './NotesPanel'
import { SnapshotPanel } from './SnapshotPanel'
import * as XLSX from 'xlsx'

export function TopBar() {
  const { userRole, userEmail, saveSnapshot, cars, maintenanceUnits, setHighlightedCarId, mainLine, testAreas, weeklySchedule } = useApp()
  const [searchVal, setSearchVal] = useState('')
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [showSnapshotInput, setShowSnapshotInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = userRole === 'admin'
  const maintenanceCarIds = new Set(maintenanceUnits.flatMap(u => u.car_ids))

  const handleSearch = () => {
    const cid = searchVal.trim().toUpperCase()
    if (!cid) return
    const car = cars[cid]
    if (!car) { setSearchResult('找不到此車號'); return }
    const locationMap: Record<string, string> = {
      main_line: '正線區',
      zhuanjiaoer: '轉角二站儲車區',
      maokong: '貓空站儲車區',
      test_area: '自定義區',
      weekly_schedule: '週排程區',
      unassigned: '未分配',
    }
    const loc = locationMap[car.location] ?? car.location
    let extra = ''
    if (car.location === 'main_line') {
      const slot = mainLine.positions.indexOf(cid)
      extra = slot !== -1 ? `（第 ${slot + 1} 格）` : '（位置異常，建議執行診斷）'
    } else if (car.location_slot !== null && car.location_slot !== undefined) {
      extra = `（格 ${car.location_slot + 1}）`
    }
    const maintenance = maintenanceCarIds.has(cid) ? ' ⚠ 有維修需求' : ''
    setSearchResult(`${cid}：${loc}${extra}${maintenance}`)
    setHighlightedCarId(cid)
  }

  const handleSaveSnapshot = async () => {
    if (!snapshotLabel.trim()) return
    setSaving(true)
    await saveSnapshot(snapshotLabel.trim())
    setSaving(false)
    setSnapshotLabel('')
    setShowSnapshotInput(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getDateStr = () => {
    const now = new Date()
    return now.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
      .replace(/\//g, '-') + '_' +
      now.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' })
      .replace(':', '')
  }

  const TYPE_LABEL: Record<string, string> = {
    regular: '一般', crystal: '水晶', maintenance_vehicle: '維修車',
    shuangwo: '雙握', dong: '洞',
  }
  const STATUS_LABEL: Record<string, string> = {
    available: '可用', unavailable: '不可用', scrapped: '報廢',
    controlled: '管控', maintenance_needed: '有維修需求', other: '其他',
  }
  const LOC_LABEL: Record<string, string> = {
    main_line: '正線', zhuanjiaoer: '轉角二站', maokong: '貓空站',
    test_area: '自定義區', weekly_schedule: '週排程', unassigned: '未分配',
  }
  const DAY_LABEL: Record<string, string> = {
    monday: '一', tuesday: '二', wednesday: '三', thursday: '四', friday: '五',
  }

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()

    // Sheet 1：正線排列
    const mainRows = mainLine.positions.map((cid, i) => {
      const car = cid ? cars[cid] : null
      return {
        '格位': i + 1,
        '車號': cid ?? '（空）',
        '車型': car ? (TYPE_LABEL[car.type] ?? car.type) : '',
        '狀態': car ? (STATUS_LABEL[car.status] ?? car.status) : '',
        '備註': car?.notes ?? '',
      }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mainRows), `正線${mainLine.mode}車`)

    // Sheet 2：全車廂狀態
    const carRows = Object.values(cars).sort((a, b) => {
      const n = (s: string) => isNaN(+s) ? 9999 : +s
      return n(a.id) - n(b.id)
    }).map(car => ({
      '車號': car.id,
      '車型': TYPE_LABEL[car.type] ?? car.type,
      '狀態': STATUS_LABEL[car.status] ?? car.status,
      '所在區域': LOC_LABEL[car.location] ?? car.location,
      '基準車': car.is_reference ? '★' : '',
      '備註': car.notes ?? '',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(carRows), '車廂狀態')

    // Sheet 3：自定義區
    const testRows: Record<string, string>[] = []
    testAreas.forEach(ta => {
      ta.slots.forEach((cid, i) => {
        testRows.push({
          '區域名稱': ta.name,
          '格位': String(i + 1),
          '車號': cid ?? '（空）',
          '車型': cid && cars[cid] ? (TYPE_LABEL[cars[cid].type] ?? '') : '',
          '狀態': cid && cars[cid] ? (STATUS_LABEL[cars[cid].status] ?? '') : '',
        })
      })
    })
    if (testRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(testRows), '自定義區')

    // Sheet 4：維修排程
    const maintenanceRows: Record<string, string>[] = []
    maintenanceUnits.forEach(mu => {
      mu.car_ids.forEach(cid => {
        maintenanceRows.push({
          '維修組別': mu.name,
          '車號': cid,
          '車型': cars[cid] ? (TYPE_LABEL[cars[cid].type] ?? '') : '',
        })
      })
    })
    if (maintenanceRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maintenanceRows), '維修排程')

    // Sheet 5：週排程
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    const maxSlots = Math.max(...days.map(d => weeklySchedule[d]?.length ?? 0), 0)
    if (maxSlots > 0) {
      const weekRows = Array.from({ length: maxSlots }, (_, i) => {
        const row: Record<string, string> = { '格位': String(i + 1) }
        days.forEach(d => { row[`週${DAY_LABEL[d]}`] = weeklySchedule[d]?.[i] ?? '' })
        return row
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weekRows), '週排程')
    }

    XLSX.writeFile(wb, `貓空纜車調度_${getDateStr()}.xlsx`)
  }

  const handleExportImage = async () => {
    const el = document.getElementById('dispatch-app')
    if (!el) { alert('找不到截圖元素'); return }
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f1f5f9',
        logging: false,
      })
      canvas.toBlob((blob) => {
        if (!blob) { alert('toBlob 失敗'); return }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `貓空纜車調度_${getDateStr()}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (e) {
      alert(`截圖失敗：${e}`)
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-700 border-b border-slate-600 flex-shrink-0 shadow-sm">
      {/* 標題 */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-lg">🚡</span>
        <span className="text-white font-bold text-sm whitespace-nowrap">貓空纜車調度</span>
      </div>

      {/* 搜尋車號 */}
      <div className="flex items-center gap-1">
        <div className="relative flex items-center">
          <input
            value={searchVal}
            onChange={e => { setSearchVal(e.target.value); setSearchResult(null); if (!e.target.value) setHighlightedCarId(null) }}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder="搜尋車號…"
            className="w-24 text-xs bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 pr-5"
            maxLength={4}
          />
          {searchVal && (
            <button
              onClick={() => { setSearchVal(''); setSearchResult(null); setHighlightedCarId(null) }}
              className="absolute right-1 text-slate-400 hover:text-white text-xs leading-none"
            >✕</button>
          )}
        </div>
        <button
          onClick={handleSearch}
          className="text-xs bg-slate-500 hover:bg-slate-400 text-white rounded px-2 py-1"
        >
          搜尋
        </button>
        {searchResult && (
          <span className="text-xs text-yellow-300 ml-1">{searchResult}</span>
        )}
      </div>

      <div className="flex-1" />

      {/* 儲存快照 */}
      {isAdmin && (
        <div className="flex items-center gap-1">
          {showSnapshotInput ? (
            <>
              <input
                autoFocus
                value={snapshotLabel}
                onChange={e => setSnapshotLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveSnapshot() }}
                placeholder="班次說明…"
                className="w-32 text-xs bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white placeholder-slate-400 focus:outline-none focus:border-green-400"
              />
              <button
                onClick={handleSaveSnapshot}
                disabled={saving || !snapshotLabel.trim()}
                className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded px-2 py-1"
              >
                {saving ? '儲存中…' : '確認'}
              </button>
              <button
                onClick={() => setShowSnapshotInput(false)}
                className="text-xs bg-slate-500 hover:bg-slate-400 text-white rounded px-2 py-1"
              >
                取消
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowSnapshotInput(true)}
              className="text-xs bg-green-600 hover:bg-green-500 text-white rounded px-2 py-1"
            >
              💾 儲存班次
            </button>
          )}
        </div>
      )}

      {/* 匯出按鈕 */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleExportExcel}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded px-2 py-1 whitespace-nowrap"
          title="匯出 Excel"
        >
          📊 Excel
        </button>
        <button
          onClick={handleExportImage}
          className="text-xs bg-purple-600 hover:bg-purple-500 text-white rounded px-2 py-1 whitespace-nowrap"
          title="截圖存檔"
        >
          📷 截圖
        </button>
      </div>

      {/* 設定按鈕 + 帳號資訊 */}
      <div className="flex items-center gap-2 ml-2">
        <NotesPanel />
        <SnapshotPanel />
        <DiagnosticsPanel />
        <SettingsPanel />
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isAdmin ? 'bg-blue-500 text-white' : 'bg-slate-500 text-slate-200'}`}>
          {isAdmin ? 'admin' : 'guest'}
        </span>
        <span className="text-slate-300 text-xs hidden lg:block">{userEmail}</span>
        <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-white">
          登出
        </button>
      </div>
    </div>
  )
}
