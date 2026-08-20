import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { searchNearbyPlaces } from '@/lib/places'
import { getSupabaseAdmin } from '@/lib/supabase'
import { hasCompetitorTracking, type Plan } from '@/lib/planLimits'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await getSupabaseAdmin()
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()
  if (!hasCompetitorTracking(((account?.plan as Plan) ?? 'starter'))) {
    return NextResponse.json({ error: 'Competitor tracking requires Growth or Agency.' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })
  if (q.length > 200) return NextResponse.json({ error: 'Search query is too long' }, { status: 400 })

  try {
    const results = await searchNearbyPlaces(q)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Competitor search failed:', error)
    return NextResponse.json({ error: 'Unable to search Google Places right now.' }, { status: 502 })
  }
}
