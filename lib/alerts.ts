import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase'
import { generateReplies } from '@/lib/generateReplies'
import { BASE_URL } from '@/lib/baseUrl'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function starsHtml(rating: number, color: string): string {
  const filled = '★'.repeat(Math.min(5, Math.max(0, rating)))
  const empty = '☆'.repeat(5 - Math.min(5, Math.max(0, rating)))
  return `<span style="color:${color};font-size:28px;letter-spacing:3px;">${filled}${empty}</span>`
}

function buildAlertHtml(opts: {
  restaurantName: string
  author: string
  rating: number
  reviewText: string
  suggestedReply: string
  recoveryOfferEnabled: boolean
  recoveryOfferText: string | null
  reviewId: string
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? BASE_URL
  const starColor = opts.rating <= 2 ? '#dc2626' : '#d97706'
  const ratingBg = opts.rating <= 2 ? '#fee2e2' : '#fef3c7'
  const ratingText = opts.rating <= 2 ? '#dc2626' : '#d97706'
  const reviewCenterUrl = `${appUrl}/dashboard`

  const recoverySection =
    opts.recoveryOfferEnabled && opts.recoveryOfferText
      ? `
      <tr>
        <td style="padding:24px 0 0 0;">
          <div style="padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
            <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;">
              Optional recovery message
            </p>
            <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;">${escapeHtml(opts.recoveryOfferText)}</p>
          </div>
        </td>
      </tr>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header bar -->
          <tr>
            <td style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0;">
              <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#a5b4fc;">Replova</p>
              <h1 style="margin:6px 0 0 0;font-size:22px;font-weight:700;color:#ffffff;">New review alert</h1>
              <p style="margin:4px 0 0 0;font-size:14px;color:#c7d2fe;">${escapeHtml(opts.restaurantName)}</p>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Big rating display -->
                <tr>
                  <td style="padding:0 0 24px 0;text-align:center;border-bottom:1px solid #e5e7eb;">
                    <div style="display:inline-block;padding:16px 32px;background:${ratingBg};border-radius:8px;">
                      <div>${starsHtml(opts.rating, starColor)}</div>
                      <p style="margin:8px 0 0 0;font-size:16px;font-weight:700;color:${ratingText};">
                        ${opts.rating} out of 5 stars
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Review box -->
                <tr>
                  <td style="padding:24px 0;">
                    <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Review from</p>
                    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(opts.author)}</p>
                    <div style="padding:16px;background:#f9fafb;border-radius:6px;border-left:4px solid #e5e7eb;">
                      <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;font-style:italic;">&quot;${escapeHtml(opts.reviewText)}&quot;</p>
                    </div>
                  </td>
                </tr>

                <!-- Suggested reply -->
                <tr>
                  <td style="padding:0 0 24px 0;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">Suggested Reply</p>
                    <div style="padding:16px;background:#f5f3ff;border-radius:6px;border-left:4px solid #6366f1;">
                      <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;">${escapeHtml(opts.suggestedReply)}</p>
                    </div>
                  </td>
                </tr>

                <!-- CTA buttons -->
                <tr>
                  <td style="padding:24px 0 0 0;text-align:center;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:0 6px 12px 6px;">
                          <a href="${reviewCenterUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:9999px;">
                            Open Review Center
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${recoverySection}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Sent by Replova · <a href="${appUrl}/dashboard" style="color:#6b7280;text-decoration:none;">Manage alerts in Settings</a>
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

export async function sendNegativeReviewAlert(reviewId: string): Promise<void> {
  const admin = getSupabaseAdmin()

  const { data: review, error: reviewError } = await admin
    .from('reviews')
    .select('id, restaurant_id, author, rating, review_text, reply_draft_2')
    .eq('id', reviewId)
    .single()

  if (reviewError || !review) throw new Error(`Review not found: ${reviewId}`)

  const { data: restaurant, error: restError } = await admin
    .from('restaurants')
    .select('id, name, owner_email, active')
    .eq('id', review.restaurant_id)
    .single()

  if (restError || !restaurant) throw new Error(`Restaurant not found for review ${reviewId}`)
  if (!restaurant.active) return

  const { data: settings } = await admin
    .from('restaurant_settings')
    .select('notify_negative_reviews, negative_threshold, recovery_offer_enabled, recovery_offer_text')
    .eq('restaurant_id', review.restaurant_id)
    .maybeSingle()

  if (settings?.notify_negative_reviews === false) return

  const threshold: number = settings?.negative_threshold ?? 3
  if ((review.rating ?? 0) > threshold) return

  const suggestedReply = review.reply_draft_2 ?? (await generateReplies({
      restaurantName: restaurant.name,
      author: review.author ?? 'Anonymous',
      rating: review.rating ?? 0,
      reviewText: review.review_text ?? '',
    })).warm

  const html = buildAlertHtml({
    restaurantName: restaurant.name,
    author: review.author ?? 'Anonymous',
    rating: review.rating ?? 0,
    reviewText: review.review_text ?? '',
    suggestedReply,
    recoveryOfferEnabled: settings?.recovery_offer_enabled ?? false,
    recoveryOfferText: settings?.recovery_offer_text ?? null,
    reviewId,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Replova <onboarding@resend.dev>',
    to: restaurant.owner_email,
    subject: `New ${review.rating}-star review at ${restaurant.name}`,
    html,
  })

  if (sendError) throw new Error(`Failed to send alert email: ${sendError.message}`)
}
