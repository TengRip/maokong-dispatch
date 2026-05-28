import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// 管理員才能呼叫此 API
async function verifyAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (user.user_metadata?.role !== 'admin') return null
  return user
}

// 使用 service role key 建立 admin 客戶端
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET：列出所有使用者
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const adminClient = getAdminClient()
  const { data, error } = await adminClient.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
    role: (u.user_metadata?.role as string) || 'guest',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }))

  return NextResponse.json({ users })
}

// POST：新增使用者
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { email, password, role } = await req.json()
  if (!email || !password) return NextResponse.json({ error: '請填入 email 和密碼' }, { status: 400 })

  const adminClient = getAdminClient()
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: role || 'guest' },
    email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email, role: role || 'guest' } })
}

// PATCH：更新使用者角色或密碼
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { userId, role, password } = await req.json()
  if (!userId) return NextResponse.json({ error: '缺少 userId' }, { status: 400 })

  const adminClient = getAdminClient()
  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.user_metadata = { role }
  if (password) updates.password = password

  const { error } = await adminClient.auth.admin.updateUserById(userId, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE：刪除使用者
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: '缺少 userId' }, { status: 400 })

  // 防止刪除自己
  if (userId === admin.id) return NextResponse.json({ error: '不能刪除自己的帳號' }, { status: 400 })

  const adminClient = getAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
