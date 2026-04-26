import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'

export interface DigestData {
  restaurantName: string
  weekStart: Date
  weekEnd: Date
  newReviewsThisWeek: number
  avgRatingThisWeek: number | null
  avgRatingLastWeek: number | null
  ratingDelta: number | null
  reputationScore: number | null
  scoreDelta: number | null
  positiveCount: number
  negativeCount: number
  neutralCount: number
  topPositiveReview: { author: string; body: string; rating: number } | null
  worstNegativeReview: { author: string; body: string; rating: number } | null
  topKeywords: string[]
  staffShoutouts: string[]
  unrepliedCount: number
  reviewRequestsClickedThisWeek: number
  actionItems: string[]
}

function getWeekBounds(): { weekStart: Date; weekEnd: Date; prevWeekStart: Date } {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday, 1 = Monday
  const daysToLastMonday = day === 0 ? 6 : day - 1
  const weekEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  weekEnd.setUTCDate(weekEnd.getUTCDate() - daysToLastMonday)
  const weekStart = new Date(weekEnd)
  weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
  return { weekStart, weekEnd, prevWeekStart }
}

function toUnixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000)
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function topN<T extends string>(items: T[], n: number): T[] {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

async function generateActionItems(opts: {
  avgRating: number | null
  ratingDelta: number | null
  negativeCount: number
  worstReview: { author: string; body: string; rating: number } | null
  topKeywords: string[]
  unrepliedCount: number
}): Promise<string[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system:
        'You are a restaurant advisor. Return ONLY a JSON array of 2-3 strings. ' +
        'Each string is a specific, actionable recommendation under 20 words. ' +
        'Base recommendations on the actual data provided. ' +
        "Examples: 'Respond to the 3-star review from Tuesday before it affects your rating' " +
        "or 'Friday nights keep getting slow service complaints — review staffing levels'",
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            avgRating: opts.avgRating,
            ratingDelta: opts.ratingDelta,
            negativeCount: opts.negativeCount,
            worstReview: opts.worstReview,
            topKeywords: opts.topKeywords,
            unrepliedCount: opts.unrepliedCount,
          }),
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) return parsed
  } catch {
    // fall through to fallback
  }

  return [
    opts.unrepliedCount > 0 ? `Reply to your ${opts.unrepliedCount} unanswered review(s) today` : null,
    (opts.ratingDelta ?? 0) < 0 ? 'Your rating dropped this week — check negative reviews' : null,
  ].filter((x): x is string => x !== null)
}

export async function buildDigestData(restaurantId: string): Promise<DigestData> {
  const admin = getSupabaseAdmin()
  const { weekStart, weekEnd, prevWeekStart } = getWeekBounds()

  const weekStartTs = toUnixSeconds(weekStart)
  const weekEndTs = toUnixSeconds(weekEnd)
  const prevWeekStartTs = toUnixSeconds(prevWeekStart)

  const [restaurantRes, thisWeekRes, prevWeekRes, reputationRes, prevScoreRes, unrepliedRes, requestsRes] =
    await Promise.all([
      admin.from('restaurants').select('name').eq('id', restaurantId).single(),

      admin
        .from('reviews')
        .select('rating, sentiment_label, review_text, author, keywords, staff_mentions')
        .eq('restaurant_id', restaurantId)
        .gte('review_timestamp', weekStartTs)
        .lt('review_timestamp', weekEndTs),

      admin
        .from('reviews')
        .select('rating')
        .eq('restaurant_id', restaurantId)
        .gte('review_timestamp', prevWeekStartTs)
        .lt('review_timestamp', weekStartTs),

      admin
        .from('reputation_scores')
        .select('score, score_date')
        .eq('restaurant_id', restaurantId)
        .order('score_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      admin
        .from('reputation_scores')
        .select('score, score_date')
        .eq('restaurant_id', restaurantId)
        .lte('score_date', new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('score_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      admin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .neq('status', 'replied'),

      admin
        .from('review_requests')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'clicked')
        .gte('sent_at', weekStart.toISOString())
        .lt('sent_at', weekEnd.toISOString()),
    ])

  const restaurantName = restaurantRes.data?.name ?? 'Your Restaurant'
  const thisWeek = thisWeekRes.data ?? []
  const prevWeek = prevWeekRes.data ?? []

  const thisWeekRatings = thisWeek.map(r => r.rating).filter((x): x is number => x !== null)
  const prevWeekRatings = prevWeek.map(r => r.rating).filter((x): x is number => x !== null)
  const avgRatingThisWeek = avg(thisWeekRatings)
  const avgRatingLastWeek = avg(prevWeekRatings)
  const ratingDelta =
    avgRatingThisWeek !== null && avgRatingLastWeek !== null
      ? Math.round((avgRatingThisWeek - avgRatingLastWeek) * 10) / 10
      : null

  const reputationScore = reputationRes.data?.score ?? null
  const prevScore = prevScoreRes.data?.score ?? null
  const scoreDelta =
    reputationScore !== null && prevScore !== null
      ? Math.round((reputationScore - prevScore) * 10) / 10
      : null

  let positiveCount = 0
  let negativeCount = 0
  let neutralCount = 0
  for (const r of thisWeek) {
    if (r.sentiment_label === 'positive') positiveCount++
    else if (r.sentiment_label === 'negative') negativeCount++
    else neutralCount++
  }

  const withText = thisWeek.filter(r => r.review_text && r.rating !== null) as Array<{
    rating: number
    review_text: string
    author: string | null
    sentiment_label: string | null
    keywords: string[] | null
    staff_mentions: string[] | null
  }>

  const topPositiveReview = withText
    .filter(r => r.rating >= 4)
    .sort((a, b) => b.rating - a.rating)[0] ?? null

  const worstNegativeReview = withText
    .filter(r => r.rating <= 3)
    .sort((a, b) => a.rating - b.rating)[0] ?? null

  const allKeywords = thisWeek.flatMap(r => r.keywords ?? [])
  const topKeywords = topN(allKeywords, 5)

  const positiveReviews = thisWeek.filter(r => r.sentiment_label === 'positive')
  const allStaffMentions = positiveReviews.flatMap(r => r.staff_mentions ?? [])
  const staffShoutouts = [...new Set(allStaffMentions)]

  const unrepliedCount = unrepliedRes.count ?? 0
  const reviewRequestsClickedThisWeek = requestsRes.count ?? 0

  const actionItems = await generateActionItems({
    avgRating: avgRatingThisWeek,
    ratingDelta,
    negativeCount,
    worstReview: worstNegativeReview
      ? {
          author: worstNegativeReview.author ?? 'Anonymous',
          body: worstNegativeReview.review_text,
          rating: worstNegativeReview.rating,
        }
      : null,
    topKeywords,
    unrepliedCount,
  })

  return {
    restaurantName,
    weekStart,
    weekEnd,
    newReviewsThisWeek: thisWeek.length,
    avgRatingThisWeek,
    avgRatingLastWeek,
    ratingDelta,
    reputationScore,
    scoreDelta,
    positiveCount,
    negativeCount,
    neutralCount,
    topPositiveReview: topPositiveReview
      ? {
          author: topPositiveReview.author ?? 'Anonymous',
          body: topPositiveReview.review_text,
          rating: topPositiveReview.rating,
        }
      : null,
    worstNegativeReview: worstNegativeReview
      ? {
          author: worstNegativeReview.author ?? 'Anonymous',
          body: worstNegativeReview.review_text,
          rating: worstNegativeReview.rating,
        }
      : null,
    topKeywords,
    staffShoutouts,
    unrepliedCount,
    reviewRequestsClickedThisWeek,
    actionItems,
  }
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
  const filled = '★'.repeat(Math.min(5, Math.max(0, Math.round(rating))))
  const empty = '☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(rating))))
  return filled + empty
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function buildHtml(data: DigestData): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? BASE_URL
  const dashboardUrl = `${appUrl}/dashboard`

  const scoreSection = (() => {
    if (data.reputationScore === null) {
      return `
        <tr>
          <td style="padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
            <p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Not enough reviews yet to calculate score</p>
          </td>
        </tr>`
    }
    const deltaColor = (data.scoreDelta ?? 0) >= 0 ? '#16a34a' : '#dc2626'
    const deltaArrow = (data.scoreDelta ?? 0) >= 0 ? '▲' : '▼'
    const deltaAbs = Math.abs(data.scoreDelta ?? 0)
    const deltaHtml = data.scoreDelta !== null
      ? `<p style="margin:0;font-size:13px;font-weight:600;color:${deltaColor};">${deltaArrow} ${deltaAbs} pts this week</p>`
      : ''
    return `
      <tr>
        <td style="padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0;font-size:48px;font-weight:800;color:#111827;line-height:1;">${data.reputationScore}</p>
                <p style="margin:4px 0 0 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Reputation Score</p>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                ${deltaHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  })()

  const ratingStr = data.avgRatingThisWeek !== null
    ? `${data.avgRatingThisWeek.toFixed(1)} ★`
    : '—'
  const ratingDeltaHtml = data.ratingDelta !== null
    ? ` <span style="font-size:11px;color:${data.ratingDelta >= 0 ? '#16a34a' : '#dc2626'};font-weight:700;">${data.ratingDelta >= 0 ? '▲' : '▼'}${Math.abs(data.ratingDelta)}</span>`
    : ''

  const statsRow = `
    <tr>
      <td style="padding:16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;">
          <tr>
            <td style="padding:16px;text-align:center;border-right:1px solid #e5e7eb;">
              <p style="margin:0;font-size:28px;font-weight:800;color:#111827;">${data.newReviewsThisWeek}</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">New Reviews</p>
            </td>
            <td style="padding:16px;text-align:center;border-right:1px solid #e5e7eb;">
              <p style="margin:0;font-size:28px;font-weight:800;color:#111827;">${ratingStr}${ratingDeltaHtml}</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Avg Rating</p>
            </td>
            <td style="padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:800;color:${data.unrepliedCount > 0 ? '#dc2626' : '#111827'};">${data.unrepliedCount}</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Need Reply</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  const sentimentRow = `
    <tr>
      <td style="padding:8px 0 16px 0;">
        <p style="margin:0;font-size:14px;color:#374151;">
          <span style="color:#16a34a;font-weight:700;">${data.positiveCount} positive</span>
          &nbsp;&nbsp;
          <span style="color:#6b7280;font-weight:600;">${data.neutralCount} neutral</span>
          &nbsp;&nbsp;
          <span style="color:#dc2626;font-weight:700;">${data.negativeCount} negative</span>
        </p>
      </td>
    </tr>`

  const highlightRow = data.topPositiveReview
    ? `
    <tr>
      <td style="padding:0 0 16px 0;">
        <div style="padding:16px;border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;">⭐ Highlight of the week</p>
          <p style="margin:4px 0 2px 0;font-size:18px;color:#15803d;letter-spacing:1px;">${stars(data.topPositiveReview.rating)}</p>
          <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#166534;">${escapeHtml(data.topPositiveReview.author)}</p>
          <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;font-style:italic;">&quot;${escapeHtml(data.topPositiveReview.body.slice(0, 200))}${data.topPositiveReview.body.length > 200 ? '…' : ''}&quot;</p>
        </div>
      </td>
    </tr>`
    : ''

  const negativeRow = data.worstNegativeReview
    ? `
    <tr>
      <td style="padding:0 0 16px 0;">
        <div style="padding:16px;border:1px solid #fecaca;border-radius:8px;background:#fff1f2;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#dc2626;">⚠️ Needs attention</p>
          <p style="margin:4px 0 2px 0;font-size:18px;color:#dc2626;letter-spacing:1px;">${stars(data.worstNegativeReview.rating)}</p>
          <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#991b1b;">${escapeHtml(data.worstNegativeReview.author)}</p>
          <p style="margin:0 0 10px 0;font-size:14px;color:#991b1b;line-height:1.6;font-style:italic;">&quot;${escapeHtml(data.worstNegativeReview.body.slice(0, 200))}${data.worstNegativeReview.body.length > 200 ? '…' : ''}&quot;</p>
          <a href="${dashboardUrl}" style="font-size:13px;color:#dc2626;font-weight:700;text-decoration:none;">View &amp; Reply →</a>
        </div>
      </td>
    </tr>`
    : ''

  const actionItemsRow = data.actionItems.length > 0
    ? `
    <tr>
      <td style="padding:0 0 16px 0;">
        <div style="padding:16px;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;">
          <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151;">This week's action items</p>
          <ul style="margin:0;padding:0 0 0 18px;">
            ${data.actionItems.map(item => `<li style="margin:0 0 6px 0;font-size:14px;color:#111827;line-height:1.5;">${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      </td>
    </tr>`
    : ''

  const shoutoutsRow = data.staffShoutouts.length > 0
    ? (() => {
        const names = data.staffShoutouts
        const nameStr = names.length === 1
          ? escapeHtml(names[0])
          : names.slice(0, -1).map(escapeHtml).join(', ') + ' and ' + escapeHtml(names[names.length - 1])
        return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <div style="padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
          <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#d97706;">🌟 Team shoutouts this week</p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#92400e;">${nameStr} ${names.length === 1 ? 'was' : 'were'} mentioned positively in reviews</p>
        </div>
      </td>
    </tr>`
      })()
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 32px;border-radius:8px 8px 0 0;">
              <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#a5b4fc;">Replova</p>
              <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#ffffff;">📊 Weekly Report — ${escapeHtml(data.restaurantName)}</h1>
              <p style="margin:0;font-size:13px;color:#c7d2fe;">Week of ${formatDate(data.weekStart)} – ${formatDate(data.weekEnd)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#f3f4f6;padding:24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">

                ${scoreSection}
                ${statsRow}
                ${sentimentRow}
                ${highlightRow}
                ${negativeRow}
                ${actionItemsRow}
                ${shoutoutsRow}

                <!-- CTA -->
                <tr>
                  <td style="padding:8px 0 24px 0;text-align:center;">
                    <a href="${dashboardUrl}" style="display:inline-block;padding:14px 36px;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:9999px;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">
                      Powered by Replova · <a href="${dashboardUrl}" style="color:#9ca3af;text-decoration:none;">Manage email preferences in Settings</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendWeeklyDigest(restaurant: {
  id: string
  name: string
  owner_email: string
  [key: string]: unknown
}): Promise<void> {
  const data = await buildDigestData(restaurant.id)

  const html = buildHtml(data)

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Replova <onboarding@resend.dev>',
    to: restaurant.owner_email,
    subject: `Your Weekly Reputation Report — ${data.restaurantName}`,
    html,
  })

  if (error) throw new Error(`Failed to send weekly digest: ${error.message}`)

  console.log(`Weekly digest sent to ${restaurant.owner_email} for ${data.restaurantName}`)
}
