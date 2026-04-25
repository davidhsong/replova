export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildReportData, generatePdfBuffer } from '@/lib/pdfReport'
import type { Plan } from '@/lib/planLimits'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const restaurantId = searchParams.get('restaurantId')
  const monthParam = searchParams.get('month') // YYYY-MM

  if (!restaurantId || !monthParam) {
    return NextResponse.json({ error: 'Missing restaurantId or month' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify ownership
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, report_logo_url')
    .eq('id', restaurantId)
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Gate: PDF reports require Growth or above
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  if (plan === 'starter') {
    return NextResponse.json(
      { error: 'Monthly PDF reports require Growth plan or higher.' },
      { status: 403 }
    )
  }

  const date = new Date(`${monthParam}-01`)
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid month format' }, { status: 400 })
  }

  // Agency plan: use custom branding if a logo URL is set
  const logoUrl = plan === 'agency' ? (restaurant.report_logo_url ?? undefined) : undefined
  const brandName = plan === 'agency' ? restaurant.name : undefined

  const data = await buildReportData(restaurantId, date)
  const buffer = await generatePdfBuffer(data, { logoUrl, brandName })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="replova-report-${monthParam}.pdf"`,
    },
  })
}
