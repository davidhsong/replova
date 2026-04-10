import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

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
}

function stars(rating: number): string {
  const filled = '★'.repeat(Math.min(5, Math.max(0, rating)))
  const empty = '☆'.repeat(5 - Math.min(5, Math.max(0, rating)))
  return filled + empty
}

function buildHtml(restaurantName: string, reviews: ReviewRow[]): string {
  const reviewBlocks = reviews
    .map(
      (r, i) => `
      ${i > 0 ? '<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">' : ''}
      <div>
        <p style="margin:0 0 4px 0;font-weight:600;font-size:16px;color:#111827;">
          ${r.author ?? 'Anonymous'}
        </p>
        <p style="margin:0 0 12px 0;font-size:20px;color:#f59e0b;letter-spacing:2px;">
          ${stars(r.rating ?? 0)}
        </p>
        <p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.6;font-style:italic;">
          "${r.review_text ?? ''}"
        </p>

        <div style="margin-bottom:12px;padding:16px;background:#f9fafb;border-left:4px solid #6366f1;border-radius:4px;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">
            Reply Option 1 — Professional
          </p>
          <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;">${r.reply_draft_1 ?? ''}</p>
        </div>

        <div style="margin-bottom:12px;padding:16px;background:#f9fafb;border-left:4px solid #10b981;border-radius:4px;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#10b981;">
            Reply Option 2 — Warm
          </p>
          <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;">${r.reply_draft_2 ?? ''}</p>
        </div>

        <div style="margin-bottom:0;padding:16px;background:#f9fafb;border-left:4px solid #f59e0b;border-radius:4px;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f59e0b;">
            Reply Option 3 — Brief
          </p>
          <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;">${r.reply_draft_3 ?? ''}</p>
        </div>
      </div>`
    )
    .join('')

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
              <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:700;color:#111827;">
                ${restaurantName}
              </h1>
              <p style="margin:0;font-size:14px;color:#6b7280;">
                Copy your preferred reply and paste it into Google Maps.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              ${reviewBlocks}
            </td>
          </tr>
          <tr>
            <td style="padding:40px 0 0 0;border-top:1px solid #e5e7eb;margin-top:32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Sent by Replova · AI-powered review replies for restaurants
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
  const { data: reviews, error } = await getSupabaseAdmin()
    .from('reviews')
    .select('id, author, rating, review_text, reply_draft_1, reply_draft_2, reply_draft_3')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'drafted')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`)

  if (!reviews || reviews.length === 0) {
    console.log(`No drafted reviews for ${restaurant.name}`)
    return
  }

  const html = buildHtml(restaurant.name, reviews)

  const { error: sendError } = await resend.emails.send({
    from: 'Replova <onboarding@resend.dev>',
    to: restaurant.owner_email,
    subject: `Your weekly review replies — ${restaurant.name}`,
    html,
  })

  if (sendError) throw new Error(`Failed to send email: ${sendError.message}`)

  const ids = reviews.map((r) => r.id)
  const { error: updateError } = await getSupabaseAdmin()
    .from('reviews')
    .update({ status: 'emailed' })
    .in('id', ids)

  if (updateError) throw new Error(`Failed to update review statuses: ${updateError.message}`)

  console.log(`Digest sent to ${restaurant.owner_email} — ${reviews.length} reviews`)
}
