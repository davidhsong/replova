import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const { email, businessName } = await req.json().catch(() => ({ email: null, businessName: null }))

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedEmail.length > 320 || (typeof businessName === 'string' && businessName.length > 200)) {
    return NextResponse.json({ error: 'Submitted details are too long.' }, { status: 400 })
  }
  const admin = getSupabaseAdmin()

  const { error } = await admin
    .from('waitlist')
    .upsert(
      { email: normalizedEmail, business_name: typeof businessName === 'string' ? businessName.trim() || null : null },
      { onConflict: 'email', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
