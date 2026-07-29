import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const { email, businessName } = await req.json()

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
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
