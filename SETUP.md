# 貓空纜車調度系統｜部署設定說明

## 第一步：建立 Supabase 專案

1. 前往 [supabase.com](https://supabase.com) → New Project
2. 記下以下資訊：
   - **Project URL**（格式：`https://xxxx.supabase.co`）
   - **anon public key**（在 Settings > API 找到）

## 第二步：建立資料庫結構

在 Supabase Dashboard → SQL Editor，依序執行：

1. `supabase/schema.sql`（建表、RLS、快照函式）
2. `supabase/seed.sql`（初始化 149 台車廂資料）
3. `supabase/cron.sql`（設定每日自動快照 09:00 / 00:00）

## 第三步：建立使用者帳號

在 Supabase Dashboard → Authentication → Users → Add User：

| 帳號 Email | 密碼 | 備註 |
|------------|------|------|
| admin1@yourname.com | （自訂） | 操作員 1 |
| admin2@yourname.com | （自訂） | 操作員 2 |
| guest@yourname.com | （自訂） | 唯讀訪客 |

建立後，對 admin1/admin2 設定 user metadata：

在 SQL Editor 執行（替換 user_id）：
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'
WHERE email IN ('admin1@yourname.com', 'admin2@yourname.com');
```

guest 帳號不需要設定（預設為 guest 權限）。

## 第四步：部署到 Vercel

1. 前往 [vercel.com](https://vercel.com) → Import Project → 選擇此 GitHub repo
2. 在 Vercel 設定 Environment Variables：
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
   SUPABASE_SERVICE_ROLE_KEY = eyJ...（可選，備用）
   ```
3. Deploy

## 第五步：設定水晶車車型

以 admin 帳號登入後，目前水晶車屬性需在 Supabase SQL Editor 設定：

```sql
-- 範例：將車號 1~15 設為水晶車（請依實際車號修改）
UPDATE cars SET type = 'crystal' WHERE id IN ('1', '2', '3');
```

（後續版本將在系統介面提供 admin 設定水晶車的功能）

## 完成！

瀏覽 Vercel 提供的網址即可使用系統。
