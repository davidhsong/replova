import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getCompetitorComparison } from '@/lib/competitors'
import { hasCompetitorTracking, type Plan } from '@/lib/planLimits'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_email', user.email)
    .eq('active', true)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: account } = await getSupabaseAdmin()
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()
  if (!hasCompetitorTracking(((account?.plan as Plan) ?? 'starter'))) {
    return NextResponse.json({ error: 'Competitor tracking requires Growth or Agency.' }, { status: 403 })
  }

  try {
    const comparison = await getCompetitorComparison(restaurantId)
    return NextResponse.json(comparison)
  } catch (error) {
    console.error('Competitor comparison failed:', error)
    return NextResponse.json({ error: 'Unable to load competitor comparison.' }, { status: 500 })
  }
}
