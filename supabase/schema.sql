-- ============================================================
-- 貓空纜車調度系統 Supabase Schema
-- ============================================================

-- 1. 車廂主表
CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,                    -- '1'~'147', 'M1', 'M2'
  type TEXT NOT NULL DEFAULT 'regular',   -- regular / crystal / maintenance_vehicle
  status TEXT NOT NULL DEFAULT 'available',
  is_reference BOOLEAN NOT NULL DEFAULT FALSE,
  location TEXT NOT NULL DEFAULT 'zhuanjiaoer',
  location_detail TEXT,                   -- 'test_area_1', 'weekly_monday' 等
  location_slot INTEGER,                  -- 格子索引
  notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 正線狀態（單一列，代表目前正線排列）
CREATE TABLE IF NOT EXISTS main_line (
  id INTEGER PRIMARY KEY DEFAULT 1,
  mode INTEGER NOT NULL DEFAULT 108,      -- 108 或 130
  positions JSONB NOT NULL DEFAULT '[]',  -- 有序車號陣列，null = 空格
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始化正線（只有一列）
INSERT INTO main_line (id, mode, positions)
VALUES (1, 108, '[]')
ON CONFLICT (id) DO NOTHING;

-- 3. 測試區
CREATE TABLE IF NOT EXISTS test_areas (
  id INTEGER PRIMARY KEY,    -- 1~6
  name TEXT NOT NULL DEFAULT '',
  slots JSONB NOT NULL DEFAULT '[null,null,null,null,null,null]',
  notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO test_areas (id, name) VALUES
  (1, '測試區 1'), (2, '測試區 2'), (3, '測試區 3'),
  (4, '測試區 4'), (5, '測試區 5'), (6, '測試區 6')
ON CONFLICT (id) DO NOTHING;

-- 4. 維修排程單位（3組）
CREATE TABLE IF NOT EXISTS maintenance_units (
  id INTEGER PRIMARY KEY,    -- 1~3
  name TEXT NOT NULL DEFAULT '',
  car_ids JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO maintenance_units (id, name) VALUES
  (1, '維修單位 A'), (2, '維修單位 B'), (3, '維修單位 C')
ON CONFLICT (id) DO NOTHING;

-- 5. 週排程
CREATE TABLE IF NOT EXISTS weekly_schedule (
  id INTEGER PRIMARY KEY DEFAULT 1,
  monday    JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null]',
  tuesday   JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null]',
  wednesday JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null]',
  thursday  JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null]',
  friday    JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO weekly_schedule (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 6. 狀態顏色設定
CREATE TABLE IF NOT EXISTS status_colors (
  id INTEGER PRIMARY KEY DEFAULT 1,
  available_regular TEXT DEFAULT '#3B82F6',    -- 藍
  available_crystal TEXT DEFAULT '#EAB308',   -- 黃
  maintenance_vehicle TEXT DEFAULT '#6B7280', -- 灰
  unavailable TEXT DEFAULT '#EF4444',         -- 紅
  scrapped TEXT DEFAULT '#111827',            -- 黑
  controlled TEXT DEFAULT '#F97316',          -- 橘
  maintenance_needed TEXT DEFAULT '#8B5CF6',  -- 紫
  other TEXT DEFAULT '#22C55E',               -- 綠
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO status_colors (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 7. 班次快照
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  label TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL DEFAULT 'manual',   -- manual / auto
  main_line_data JSONB NOT NULL DEFAULT '{}',
  cars_data JSONB NOT NULL DEFAULT '[]',
  test_areas_data JSONB NOT NULL DEFAULT '[]',
  maintenance_data JSONB NOT NULL DEFAULT '[]',
  weekly_data JSONB NOT NULL DEFAULT '{}',
  created_by TEXT
);

-- 8. 操作記錄
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  car_id TEXT,
  from_location TEXT,
  to_location TEXT,
  detail TEXT
);

-- ============================================================
-- RLS（Row Level Security）設定
-- ============================================================

ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 所有登入用戶可讀取（guest 也能看）
CREATE POLICY "登入用戶可讀取" ON cars FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "登入用戶可讀取" ON main_line FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "登入用戶可讀取" ON test_areas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "登入用戶可讀取" ON maintenance_units FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "登入用戶可讀取" ON weekly_schedule FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "登入用戶可讀取" ON status_colors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "登入用戶可讀取" ON snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "登入用戶可讀取" ON operation_logs FOR SELECT USING (auth.role() = 'authenticated');

-- admin 才能寫入（透過 user metadata role = 'admin' 判斷）
CREATE POLICY "admin 可寫入" ON cars FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
CREATE POLICY "admin 可寫入" ON main_line FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
CREATE POLICY "admin 可寫入" ON test_areas FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
CREATE POLICY "admin 可寫入" ON maintenance_units FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
CREATE POLICY "admin 可寫入" ON weekly_schedule FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
CREATE POLICY "admin 可寫入" ON status_colors FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
CREATE POLICY "admin 可寫入快照" ON snapshots FOR INSERT WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
CREATE POLICY "admin 可寫入記錄" ON operation_logs FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- ============================================================
-- 自動快照函式（透過 Supabase Cron 呼叫）
-- ============================================================
CREATE OR REPLACE FUNCTION create_auto_snapshot()
RETURNS void AS $$
DECLARE
  v_cars JSONB;
  v_main_line JSONB;
  v_test_areas JSONB;
  v_maintenance JSONB;
  v_weekly JSONB;
  v_hour INTEGER;
  v_label TEXT;
BEGIN
  v_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Taipei');
  v_label := CASE WHEN v_hour = 9 THEN '自動快照 09:00' ELSE '自動快照 00:00' END;

  SELECT jsonb_agg(row_to_json(c)) INTO v_cars FROM cars c;
  SELECT row_to_json(m) INTO v_main_line FROM main_line m WHERE id = 1;
  SELECT jsonb_agg(row_to_json(t)) INTO v_test_areas FROM test_areas t;
  SELECT jsonb_agg(row_to_json(mu)) INTO v_maintenance FROM maintenance_units mu;
  SELECT row_to_json(ws) INTO v_weekly FROM weekly_schedule ws WHERE id = 1;

  INSERT INTO snapshots (label, trigger, main_line_data, cars_data, test_areas_data, maintenance_data, weekly_data, created_by)
  VALUES (v_label, 'auto', v_main_line, COALESCE(v_cars, '[]'), COALESCE(v_test_areas, '[]'), COALESCE(v_maintenance, '[]'), v_weekly, 'system');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
