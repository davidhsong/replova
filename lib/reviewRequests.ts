import { Resend } from 'resend'
import { BASE_URL } from '@/lib/baseUrl'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

export function buildGoogleReviewLink(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}

export function buildTrackingLink(requestId: string, action: 'open' | 'click'): string {
  return `${BASE_URL}/api/review-requests/track?id=${requestId}&action=${action}`
}

export async function sendReviewRequestEmail(
  request: {
    id: string
    customer_name: string | null
    customer_email: string
    review_link: string
  },
  restaurantName: string
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const customerName = request.customer_name?.trim() || null
  const safeCustomerName = customerName ? escapeHtml(customerName) : null
  const safeRestaurantName = escapeHtml(restaurantName)
  const subject = safeHeader(`${customerName ?? 'Hi there'}, how was your visit to ${restaurantName}?`)
  const clickLink = buildTrackingLink(request.id, 'click')
  const openPixel = buildTrackingLink(request.id, 'open')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#09090b;padding:24px 32px;">
              <p style="margin:0;font-size:17px;font-weight:700;color:#fafafa;letter-spacing:-0.02em;">${safeRestaurantName}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#09090b;line-height:1.3;letter-spacing:-0.025em;">
                ${safeCustomerName ? `Hey ${safeCustomerName},` : 'Hi there,'}
              </p>
              <p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.65;">
                Thanks for visiting <strong>${safeRestaurantName}</strong>! We'd love to hear about your experience.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#3f3f46;line-height:1.65;">
                Your feedback helps us improve and helps other customers find us.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <a href="${clickLink}"
                       style="display:inline-block;background:#09090b;color:#fafafa;font-size:14px;font-weight:700;padding:14px 28px;border-radius:999px;text-decoration:none;letter-spacing:-0.01em;">
                      Leave Us a Google Review
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.6;">
                Takes less than a minute — your opinion means a lot to us.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f1;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                You're receiving this because you recently visited ${safeRestaurantName}.
                This is a one-time message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- 1×1 open-tracking pixel -->
  <img src="${openPixel}" width="1" height="1" style="display:none" alt="" />
</body>
</html>`

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Replova <onboarding@resend.dev>',
    to: request.customer_email,
    subject,
    html,
  })

  if (error) throw new Error(`Failed to send review request email: ${error.message}`)
}
