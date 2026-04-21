import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { locationName } = await req.json()
  if (!locationName || typeof locationName !== 'string') {
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 })
  }
  // Prevent path traversal / injection into Google API URL segments
  if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(locationName)) {
    return NextResponse.json({ error: 'Invalid locationName format' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from('restaurants')
    .update({ google_location_name: locationName })
    .eq('owner_email', user.email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
