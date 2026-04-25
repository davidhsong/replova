import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

async function getRestaurantId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .eq('owner_email', user.email)
    .single()

  return restaurant?.id ?? null
}

export async function GET() {
  const restaurantId = await getRestaurantId()
  if (!restaurantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('restaurant_settings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? { restaurant_id: restaurantId })
}

export async function PATCH(req: NextRequest) {
  const restaurantId = await getRestaurantId()
  if (!restaurantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const allowed = ['auto_reply_enabled', 'auto_reply_delay_hours', 'reply_persona', 'notify_negative_reviews', 'negative_threshold']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { error } = await getSupabaseAdmin()
    .from('restaurant_settings')
    .upsert({ restaurant_id: restaurantId, ...patch }, { onConflict: 'restaurant_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
