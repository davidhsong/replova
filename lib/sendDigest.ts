import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'

const resend = new Resend(process.env.RESEND_API_KEY)

const STALE_DAYS = 3

interface Restaurant {
  id: string
  name: string
  owner_email: string
}

interface ReviewRow {
  id: string
  author: string | null
  rating: number | null
  review_text: string | null
  reply_draft_1: string | null
  reply_draft_2: string | null
  reply_draft_3: string | null
  created_at: string
  status: string | null
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function stars(rating: number): string {
  const filled = '★'.repeat(Math.min(5, Math.max(0, rating)))
  const empty = '☆'.repeat(5 - Math.min(5, Math.max(0, rating)))
  return filled + empty
}

function daysWaiting(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
}

function buildHtml(restaurantName: string, reviews: ReviewRow[], dashboardUrl: string): string {
  const urgentCount = reviews.filter(r => r.rating != null && r.rating <= 2).length

  const reviewBlocks = reviews
    .map((r, i) => {
      const isUrgent = r.rating != null && r.rating <= 2
      const waiting = daysWaiting(r.created_at)
      const isStale = waiting >= STALE_DAYS

      return `
      ${i > 0 ? '<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">' : ''}
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <p style="margin:0;font-weight:600;font-size:16px;color:#111827;">
            ${escapeHtml(r.author ?? 'Anonymous')}
          </p>
          ${isUrgent ? '<span style="display:inline-block;padding:2px 8px;background:#fee2e2;color:#dc2626;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Urgent</span>' : ''}
          ${isStale && !isUrgent ? `<span style="display:inline-block;padding:2px 8px;background:#fef3c7;color:#d97706;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Waiting ${waiting}d</span>` : ''}
        </div>
        <p style="margin:0 0 12px 0;font-size:20px;color:#f59e0b;letter-spacing:2px;">
          ${stars(r.rating ?? 0)}
        </p>
        ${isUrgent ? '<p style="margin:0 0 12px 0;font-size:13px;color:#dc2626;font-weight:600;">⚠️ This low-rating review needs a prompt, thoughtful response to protect your reputation.</p>' : ''}
        ${isStale && !isUrgent ? `<p style="margin:0 0 12px 0;font-size:13px;color:#d97706;font-weight:600;">⏰ This review has been waiting ${waiting} day${waiting !== 1 ? 's' : ''} for a reply.</p>` : ''}
        <p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.6;font-style:italic;">
          &quot;${escapeHtml(r.review_text ?? '')}&quot;
        </p>

        <div style="margin-bottom:12px;padding:16px;background:#f9fafb;border-left:4px solid #6366f1;border-radius:4px;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">
            Suggested Reply — Professional
          </p>
          <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;">${escapeHtml(r.reply_draft_1 ?? '')}</p>
        </div>

        <div style="margin-bottom:12px;padding:16px;background:#f9fafb;border-left:4px solid #10b981;border-radius:4px;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#10b981;">
            Suggested Reply — Warm
          </p>
          <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;">${escapeHtml(r.reply_draft_2 ?? '')}</p>
        </div>

        <div style="margin-bottom:0;padding:16px;background:#f9fafb;border-left:4px solid #f59e0b;border-radius:4px;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f59e0b;">
            Suggested Reply — Brief
          </p>
          <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;">${escapeHtml(r.reply_draft_3 ?? '')}</p>
        </div>
      </div>`
    })
    .join('')

  const urgentCountStr = escapeHtml(String(urgentCount))
  const reviewCountStr = escapeHtml(String(reviews.length))
  const headerMessage = urgentCount > 0
    ? `<strong>${urgentCountStr} urgent review${urgentCount > 1 ? 's' : ''}</strong> need${urgentCount === 1 ? 's' : ''} immediate attention — low ratings left unanswered hurt your reputation.`
    : `You have <strong>${reviewCountStr} customer review${reviews.length > 1 ? 's' : ''}</strong> waiting for a reply. Copy a suggested reply and paste it into Google to stay on top of your reputation.`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 0 24px 0;">
              <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">Replova</p>
              <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#111827;">
                ${escapeHtml(restaurantName)}
              </h1>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                ${headerMessage}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;border-top:1px solid #e5e7eb;">
              ${reviewBlocks}
            </td>
          </tr>
          <tr>
            <td style="padding:40px 0 0 0;border-top:1px solid #e5e7eb;margin-top:32px;">
              <p style="margin:0 0 8px 0;font-size:14px;text-align:center;">
                <a href="${dashboardUrl}" style="color:#4f46e5;text-decoration:none;font-weight:600;">
                  Open your Review Action Center →
                </a>
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Sent by Replova · Reputation management for businesses
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendWeeklyDigest(restaurant: Restaurant): Promise<void> {
  // Include both 'drafted' (fresh) and 'emailed' (previously sent but still unanswered)
  // so users keep getting reminders until they actually reply.
  const { data: reviews, error } = await getSupabaseAdmin()
    .from('reviews')
    .select('id, author, rating, review_text, reply_draft_1, reply_draft_2, reply_draft_3, created_at, status')
    .eq('restaurant_id', restaurant.id)
    .in('status', ['drafted', 'emailed'])
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`)

  if (!reviews || reviews.length === 0) {
    console.log(`No pending reviews for ${restaurant.name}`)
    return
  }

  const html = buildHtml(restaurant.name, reviews, `${BASE_URL}/dashboard`)

  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Replova <onboarding@resend.dev>',
    to: restaurant.owner_email,
    subject: `You have ${reviews.length} customer review${reviews.length > 1 ? 's' : ''} that need${reviews.length === 1 ? 's' : ''} attention — ${restaurant.name}`,
    html,
  })

  if (sendError) throw new Error(`Failed to send email: ${sendError.message}`)

  // Mark only the 'drafted' reviews as 'emailed' — already-emailed ones
  // keep their status so we can count how long they've been waiting.
  const draftedIds = (reviews as ReviewRow[]).filter(r => r.status === 'drafted').map(r => r.id)
  if (draftedIds.length > 0) {
    const { error: updateError } = await getSupabaseAdmin()
      .from('reviews')
      .update({ status: 'emailed' })
      .in('id', draftedIds)

    if (updateError) throw new Error(`Failed to update review statuses: ${updateError.message}`)
  }

  console.log(`Digest sent to ${restaurant.owner_email} — ${reviews.length} reviews`)
}
