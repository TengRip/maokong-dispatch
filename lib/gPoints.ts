// 貓空纜車支柱固定參考點
// 用來校正正線 mainLine.positions 陣列的起點對應：
// 控制員在現場看到車廂經過某支柱哪一側，回報車號後，系統據此環形位移整個正線陣列
export interface GPoint {
  key: string
  label: string
  side: 'up' | 'down' | 'single'  // up=上坡側, down=下坡側, single=單一位置（無分側）
  index108: number
  index130: number | null
}

export const G_POINTS: GPoint[] = [
  { key: 'g4_down', label: 'G4下坡側', side: 'down',   index108: 0,   index130: 0   },
  { key: 'g5_down', label: 'G5下坡側', side: 'down',   index108: 14,  index130: 17  },
  { key: 'g6',      label: 'G6',       side: 'single', index108: 29,  index130: 35  },
  { key: 'g5_up',   label: 'G5上坡側', side: 'up',     index108: 44,  index130: 53  },
  { key: 'g4_up',   label: 'G4上坡側', side: 'up',     index108: 57,  index130: 69  },
  { key: 'g3_up',   label: 'G3上坡側', side: 'up',     index108: 65,  index130: 79  },
  { key: 'g2_up',   label: 'G2上坡側', side: 'up',     index108: 73,  index130: 88  },
  { key: 'g1',      label: 'G1',       side: 'single', index108: 83,  index130: 101 },
  { key: 'g2_down', label: 'G2下坡側', side: 'down',   index108: 94,  index130: 113 },
  { key: 'g3_down', label: 'G3下坡側', side: 'down',   index108: 100, index130: 121 },
]

export function getGPointIndex(point: GPoint, mode: 108 | 130): number | null {
  return mode === 108 ? point.index108 : point.index130
}
