import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  const action = searchParams.get('action')

  if (!id || (action !== 'open' && action !== 'click')) {
    return new NextResponse('Bad request', { status: 400 })
  }

  const admin = getSupabaseAdmin()

  if (action === 'open') {
    await admin
      .from('review_requests')
      .update({ opened_at: new Date().toISOString(), status: 'opened' })
      .eq('id', id)
      .eq('status', 'sent')

    return new Response(PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }

  // action === 'click'
  const { data: request } = await admin
    .from('review_requests')
    .select('review_link')
    .eq('id', id)
    .single()

  await admin
    .from('review_requests')
    .update({ clicked_at: new Date().toISOString(), status: 'clicked' })
    .eq('id', id)

  const destination = request?.review_link ?? 'https://www.google.com/maps'
  return NextResponse.redirect(destination, 302)
}
