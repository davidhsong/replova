import { getSupabaseAdmin } from '@/lib/supabase'
import nodemailer from 'nodemailer'
import { NextRequest, NextResponse } from 'next/server'
import {
  demoAvailability,
  createDemoCalendarInvite,
  DEMO_TIME_ZONE,
  formatDemoSlot,
  validateDemoMeetingUrl,
  validateDemoSlot,
} from '@/lib/demoBooking'

export const runtime = 'nodejs'

const MAX_REQUEST_BYTES = 8 * 1024
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT = 4
const attempts = new Map<string, number[]>()

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function clientAddress(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

function isRateLimited(key: string, now = Date.now()) {
  const cutoff = now - RATE_WINDOW_MS
  for (const [storedKey, timestamps] of attempts) {
    const active = timestamps.filter(timestamp => timestamp > cutoff)
    if (active.length) attempts.set(storedKey, active)
    else attempts.delete(storedKey)
  }
  const timestamps = attempts.get(key) ?? []
  if (timestamps.length >= RATE_LIMIT) return true
  timestamps.push(now)
  attempts.set(key, timestamps)
  return false
}

function acceptedRecipient(recipient: unknown, expectedEmail: string) {
  const accepted = typeof recipient === 'string'
    ? recipient
    : recipient && typeof recipient === 'object' && 'address' in recipient
      ? String(recipient.address)
      : ''
  return accepted.trim().toLowerCase() === expectedEmail.toLowerCase()
}

export async function GET() {
  const now = new Date()
  const { data, error } = await getSupabaseAdmin().from('demo_reservations')
    .select('starts_at').gte('starts_at', now.toISOString()).lte('starts_at', new Date(now.getTime() + 46 * 86400000).toISOString())
  if (error) return NextResponse.json({ error: 'Availability could not be loaded.' }, { status: 503 })
  const reserved = new Set<number>(data.map(row => Date.parse(row.starts_at)))
  return NextResponse.json({ slots: demoAvailability(now, reserved) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Booking request is too large.' }, { status: 413 })
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Booking request must be JSON.' }, { status: 415 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Booking details could not be read.' }, { status: 400 })
  }

  // Quietly accept honeypot submissions without sending mail.
  if (cleanText(body.website, 200)) return NextResponse.json({ success: true })

  const name = cleanText(body.name, 100)
  const email = cleanText(body.email, 254).toLowerCase()
  const company = cleanText(body.company, 120)
  const date = cleanText(body.date, 10)
  const time = cleanText(body.time, 10).toLowerCase()

  if (!name || !email || !date || !time) {
    return NextResponse.json({ error: 'Name, email, date, and time are required.' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (isRateLimited(`${clientAddress(request)}:${email}`)) {
    return NextResponse.json({ error: 'Too many booking attempts. Please try again later.' }, { status: 429 })
  }

  let slot: ReturnType<typeof validateDemoSlot>
  try {
    slot = validateDemoSlot(date, time)
  } catch {
    return NextResponse.json({ error: 'That time is no longer available. Choose another time.' }, { status: 409 })
  }

  const host = process.env.ZOHO_SMTP_HOST?.trim() || 'smtppro.zoho.com'
  const port = Number(process.env.ZOHO_SMTP_PORT ?? '465')
  const user = process.env.ZOHO_SMTP_USER?.trim()
  const password = process.env.ZOHO_SMTP_PASSWORD
  const sender = process.env.DEMO_FROM_EMAIL?.trim() || user
  const ownerEmail = process.env.DEMO_OWNER_EMAIL?.trim() || 'davidhsongg@gmail.com'
  const configuredMeetingUrl = process.env.DEMO_MEETING_URL?.trim()
  const meetingUrl = validateDemoMeetingUrl(configuredMeetingUrl)

  if (configuredMeetingUrl && !meetingUrl) {
    console.error('[demo/book] DEMO_MEETING_URL must be an HTTPS meet.google.com URL')
  }

  if (!user || !password || !sender || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('[demo/book] Zoho SMTP is not configured')
    return NextResponse.json({ error: 'Calendar delivery is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
  if (![sender, ownerEmail].every(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
    console.error('[demo/book] Demo sender or owner email is invalid')
    return NextResponse.json({ error: 'Calendar delivery is temporarily unavailable. Please try again later.' }, { status: 503 })
  }

  const requestId = cleanText(body.requestId, 36)
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId)) {
    return NextResponse.json({ error: 'Refresh the calendar and choose a time.' }, { status: 400 })
  }
  const reservations = getSupabaseAdmin().from('demo_reservations')
  const startsAt = slot.start.toISOString()
  const { error: claimError } = await reservations.insert({ starts_at: startsAt, request_id: requestId })
  if (claimError) {
    if (claimError.code !== '23505') return NextResponse.json({ error: 'Booking is temporarily unavailable.' }, { status: 503 })
    const { data: prior } = await reservations.select('delivered').eq('starts_at', startsAt).eq('request_id', requestId).maybeSingle()
    if (prior?.delivered) return NextResponse.json({ success: true, slotLabel: formatDemoSlot(slot.start) })
    return NextResponse.json({ error: prior ? 'Your invitation is being confirmed. Check your inbox.' : 'This time was taken. Choose another time.' }, { status: prior ? 503 : 409 })
  }
  const bookingId = `${requestId}@replova.app`
  const slotLabel = formatDemoSlot(slot.start)
  const calendar = createDemoCalendarInvite({
    uid: bookingId,
    attendeeName: name,
    attendeeEmail: email,
    company,
    organizerEmail: sender,
    start: slot.start,
    end: slot.end,
    meetingUrl,
  })
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeCompany = escapeHtml(company)
  const safeSlot = escapeHtml(slotLabel)

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: { minVersion: 'TLSv1.2' },
    })
    const delivery = await transport.sendMail({
      from: { name: 'Replova', address: sender },
      to: { name, address: email },
      bcc: ownerEmail,
      replyTo: sender,
      subject: `Replova demo confirmed - ${slotLabel}`,
      text: [
        `Hello ${name},`,
        '',
        `Your Replova Tap demo is confirmed for ${slotLabel}.`,
        `The meeting is ${45} minutes and uses the ${DEMO_TIME_ZONE} time zone.`,
        company ? `Business: ${company}` : null,
        meetingUrl ? `Join Google Meet: ${meetingUrl}` : null,
        '',
        'A calendar invitation is attached. Reply to this email if the time needs to change.',
        '',
        'Replova',
      ].filter(value => value !== null).join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#191713">
          <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756d">Replova demo</p>
          <h1 style="font-size:25px;margin:8px 0 18px">Demo confirmed</h1>
          <p style="font-size:15px;line-height:1.65">Hello ${safeName},</p>
          <p style="font-size:15px;line-height:1.65">The Replova Tap demo is confirmed for <strong>${safeSlot}</strong>.</p>
          <table style="border-collapse:collapse;width:100%;margin:22px 0;font-size:14px">
            <tr><td style="padding:8px 14px 8px 0;color:#746f67">Duration</td><td style="padding:8px 0">45 minutes</td></tr>
            <tr><td style="padding:8px 14px 8px 0;color:#746f67">Time zone</td><td style="padding:8px 0">America/Los Angeles</td></tr>
            <tr><td style="padding:8px 14px 8px 0;color:#746f67">Email</td><td style="padding:8px 0">${safeEmail}</td></tr>
            ${company ? `<tr><td style="padding:8px 14px 8px 0;color:#746f67">Business</td><td style="padding:8px 0">${safeCompany}</td></tr>` : ''}
          </table>
          ${meetingUrl ? `<p style="margin:22px 0"><a href="${escapeHtml(meetingUrl)}" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#191713;color:#fff;text-decoration:none;font-size:14px;font-weight:600">Join Google Meet</a></p>` : ''}
          <p style="font-size:14px;line-height:1.65;color:#5f5a53">A calendar invitation is attached. Reply to this email if the time needs to change.</p>
        </div>
      `.trim(),
      icalEvent: {
        filename: 'replova-demo.ics',
        method: 'REQUEST',
        content: calendar,
      },
    })
    if (!delivery.accepted.some(recipient => acceptedRecipient(recipient, email))) {
      if (delivery.accepted.length > 0) {
        console.error('[demo/book] Partial delivery needs reconciliation', bookingId)
        return NextResponse.json({ error: 'Your invitation needs assistance. Contact support before booking another time.' }, { status: 503 })
      }
      await reservations.delete().eq('request_id', requestId)
      console.error('[demo/book] Zoho did not accept the customer recipient')
      return NextResponse.json({ error: 'The calendar invitation could not be sent. Check the email address and try again.' }, { status: 502 })
    }
    const { error: recordError } = await reservations.update({ delivered: true }).eq('request_id', requestId)
    if (recordError) console.error('[demo/book] Accepted invitation needs reconciliation', bookingId)
    if (!delivery.accepted.some(recipient => acceptedRecipient(recipient, ownerEmail))) {
      console.error('[demo/book] Zoho did not accept the owner notification recipient')
    }
  } catch (error) {
    const failure = error as { code?: string; command?: string }
    // Before SMTP DATA the message cannot have been accepted by the server.
    if (['CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH', 'MAIL FROM', 'RCPT TO'].includes(failure.command ?? '') || failure.code === 'EAUTH') {
      await reservations.delete().eq('request_id', requestId)
      return NextResponse.json({ error: 'Invitation delivery failed. Please try again.' }, { status: 502 })
    }
    console.error('[demo/book] Check SMTP delivery before releasing reservation', bookingId)
    return NextResponse.json({ error: 'Delivery is unconfirmed. Check your inbox or contact support before booking another time.' }, { status: 503 })
  }

  return NextResponse.json({ success: true, slotLabel })
}
