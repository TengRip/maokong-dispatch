-- 設定自動快照排程（需在 Supabase Dashboard > Database > Extensions 啟用 pg_cron）
-- 然後在 SQL Editor 執行以下指令

-- 啟用 pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每日 09:00 台北時間（UTC+8）= UTC 01:00
SELECT cron.schedule(
  'auto-snapshot-0900',
  '0 1 * * *',
  $$SELECT create_auto_snapshot();$$
);

-- 每日 00:00 台北時間（UTC+8）= UTC 前一天 16:00
SELECT cron.schedule(
  'auto-snapshot-0000',
  '0 16 * * *',
  $$SELECT create_auto_snapshot();$$
);

-- 查看目前排程
SELECT * FROM cron.job;
