import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { MainLineState, TestArea, WeeklySchedule } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DAY_LABEL: Record<string, string> = {
  monday: '一', tuesday: '二', wednesday: '三', thursday: '四', friday: '五',
}

/**
 * 掃描所有排班區的實際 slot 陣列，回傳車號目前所在位置描述。
 * 回傳 null 表示車廂可以放入（在儲車區或未分配）。
 * 刻意不依賴 cars.location（可能因舊 bug 而不準），改掃描實際資料。
 */
export function getCarOccupiedLabel(
  carId: string,
  mainLine: MainLineState,
  testAreas: TestArea[],
  weeklySchedule: WeeklySchedule,
  excludeTestAreaId?: number,   // 排除正在編輯的自定義區（同區不重複算）
  excludeWeeklyDay?: string,    // 排除正在編輯的週排程欄位
): string | null {
  // 正線
  const mainSlot = mainLine.positions.indexOf(carId)
  if (mainSlot !== -1) return `正線第 ${mainSlot + 1} 格`

  // 自定義區
  for (const area of testAreas) {
    if (area.id === excludeTestAreaId) continue
    if (area.slots.includes(carId)) {
      return `自定義區「${area.name || `自定義區 ${area.id}`}」`
    }
  }

  // 週排程
  for (const [day, slots] of Object.entries(weeklySchedule)) {
    if (day === excludeWeeklyDay) continue
    if ((slots as (string | null)[]).includes(carId)) {
      return `週排程（週${DAY_LABEL[day] ?? day}）`
    }
  }

  return null
}
