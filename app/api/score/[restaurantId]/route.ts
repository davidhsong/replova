import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { calculateReputationScore, getScoreHistory } from '@/lib/reputationScore'
import type { Plan } from '@/lib/planLimits'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { restaurantId } = await params
  const admin = getSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, owner_email, active')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  if (restaurant.owner_email !== user.email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!restaurant.active) return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  // Gate: scores require Growth or above
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  if (plan === 'starter') {
    return NextResponse.json(
      { error: 'Reputation score tracking requires Growth plan or higher.' },
      { status: 403 }
    )
  }

  const [current, history] = await Promise.all([
    calculateReputationScore(restaurantId),
    getScoreHistory(restaurantId, 30),
  ])

  return NextResponse.json({ current, history })
}
