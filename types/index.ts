// 車型屬性（永久固定）
export type CarType = 'regular' | 'crystal' | 'maintenance_vehicle' | 'shuangwo' | 'dong'

// 車廂運作狀態
export type CarStatus =
  | 'available'        // 可用（顯示車型色）
  | 'unavailable'      // 不可用（紅）
  | 'scrapped'         // 報廢（黑，強制封鎖）
  | 'controlled'       // 管控（橘）
  | 'maintenance_needed' // 有維修需求（紫，由維修排程區驅動）
  | 'other'            // 其他（綠）

// 車廂所在區域
export type CarLocation =
  | 'main_line'
  | 'zhuanjiaoer'   // 轉角二站儲車區
  | 'maokong'       // 貓空站儲車區
  | 'test_area'     // 測試區
  | 'weekly_schedule' // 週排程區
  | 'unassigned'

// 車廂資料
export interface Car {
  id: string           // 車號：'1'~'147'、'M1'、'M2'
  type: CarType
  status: CarStatus
  is_reference: boolean  // 基準車 ★
  location: CarLocation
  location_detail?: string  // 例如 'test_area_1'、'weekly_monday'
  location_slot?: number    // 格子位置索引
  notes?: string
}

// 正線模式
export type MainLineMode = 108 | 130

// 正線排列（有序陣列，index 對應位置）
export interface MainLineState {
  mode: MainLineMode
  positions: (string | null)[]  // 車號或 null（空格）
}

// 測試區
export interface TestArea {
  id: number           // 1~6
  name: string         // 自訂名稱
  slots: (string | null)[]  // 6格，車號或 null
  notes: string
}

// 維修排程單位
export interface MaintenanceUnit {
  id: number           // 1~3
  name: string         // 自訂名稱
  car_ids: string[]    // 登錄的車號清單
}

// 週排程欄位
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'

export interface WeeklySchedule {
  [key: string]: (string | null)[]  // key 為 WeekDay，值為10格陣列
}

// 狀態顏色設定（可自訂）
export interface StatusColors {
  available_regular: string   // 一般車可用
  available_crystal: string   // 水晶車可用
  available_shuangwo: string  // 雙握車可用
  available_dong: string      // 洞車可用
  maintenance_vehicle: string // 維修車
  unavailable: string
  scrapped: string
  controlled: string
  maintenance_needed: string
  other: string
}

// 班次快照
export interface Snapshot {
  id: string
  created_at: string
  label: string           // 班次說明
  trigger: 'manual' | 'auto'
  main_line: MainLineState
  cars: Car[]
  test_areas: TestArea[]
  maintenance_units: MaintenanceUnit[]
  weekly_schedule: WeeklySchedule
  created_by?: string
}

// 操作記錄
export interface OperationLog {
  id: string
  created_at: string
  user_email: string
  action: string
  car_id?: string
  from_location?: string
  to_location?: string
  detail?: string
}

// 使用者角色（存在 user metadata）
export type UserRole = 'admin' | 'guest'

// 佈告欄（交接事項）
export interface BulletinData {
  title: string
  date: string
  content: string
}
