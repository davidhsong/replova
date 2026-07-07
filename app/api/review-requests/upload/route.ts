import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Papa from 'papaparse'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildGoogleReviewLink } from '@/lib/reviewRequests'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()

  let restaurant: { id: string; place_id: string; active: boolean } | null = null
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select('id, place_id, active')
      .eq('id', activeId)
      .eq('owner_email', user.email!)
      .maybeSingle()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select('id, place_id, active')
      .eq('owner_email', user.email!)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  if (!restaurant.active) return NextResponse.json({ error: 'Subscription inactive' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })

  // Normalize headers to lowercase
  const rows = result.data.map(row => {
    const normalized: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : String(v ?? '').trim()
    }
    return normalized
  })

  // Find email/name columns case-insensitively
  const sampleKeys = rows[0] ? Object.keys(rows[0]) : []
  const emailKey = sampleKeys.find(k => k === 'email') ?? null
  const nameKey  = sampleKeys.find(k => k === 'name')  ?? null

  let noEmail = 0
  let invalidEmail = 0
  const validRows: { email: string; name: string | null }[] = []

  for (const row of rows) {
    const email = emailKey ? row[emailKey] : ''
    const name  = nameKey  ? row[nameKey] || null : null

    if (!email) { noEmail++; continue }
    if (!EMAIL_RE.test(email)) { invalidEmail++; continue }
    validRows.push({ email: email.toLowerCase(), name })
  }

  if (validRows.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: noEmail + invalidEmail,
      reasons: { noEmail, invalidEmail, duplicate: 0 },
    })
  }

  // Check for recent duplicates (within 30 days)
  const emails = validRows.map(r => r.email)
  const { data: existing } = await admin
    .from('review_requests')
    .select('customer_email')
    .eq('restaurant_id', restaurant.id)
    .in('customer_email', emails)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const recentEmails = new Set((existing ?? []).map((r: { customer_email: string }) => r.customer_email))
  const duplicate = validRows.filter(r => recentEmails.has(r.email)).length
  const toInsert = validRows.filter(r => !recentEmails.has(r.email))

  if (toInsert.length > 0) {
    const reviewLink = buildGoogleReviewLink(restaurant.place_id)
    await admin.from('review_requests').insert(
      toInsert.map(r => ({
        restaurant_id: restaurant.id,
        customer_name: r.name,
        customer_email: r.email,
        review_link: reviewLink,
        status: 'pending',
      }))
    )
  }

  return NextResponse.json({
    imported: toInsert.length,
    skipped: noEmail + invalidEmail + duplicate,
    reasons: { noEmail, invalidEmail, duplicate },
  })
}
