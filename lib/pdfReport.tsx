// This module is Node.js only. Never import it in browser bundles.

import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React, { type JSXElementConstructor, type ReactElement } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase'

const colors = {
  dark: '#1a1a2e',
  text: '#333333',
  muted: '#666666',
  light: '#f8f9fa',
  green: '#16a34a',
  red: '#dc2626',
  border: '#e5e7eb',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
    backgroundColor: '#ffffff',
    paddingBottom: 40,
  },
  header: {
    backgroundColor: colors.dark,
    padding: '20 30',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 11,
    color: '#a0aec0',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 10,
    borderRadius: 4,
  },
  body: {
    padding: '20 30',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiBox: {
    width: '47%',
    backgroundColor: colors.light,
    border: `1 solid ${colors.border}`,
    borderRadius: 6,
    padding: '12 14',
  },
  kpiLabel: {
    fontSize: 9,
    color: colors.muted,
    fontFamily: 'Helvetica',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: colors.dark,
  },
  kpiDelta: {
    fontSize: 9,
    marginTop: 2,
  },
  trendLine: {
    fontSize: 11,
    color: colors.text,
    marginBottom: 10,
    padding: '8 12',
    backgroundColor: colors.light,
    borderRadius: 5,
    border: `1 solid ${colors.border}`,
  },
  sentimentLine: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.dark,
    marginBottom: 10,
    marginTop: 16,
    borderBottom: `1 solid ${colors.border}`,
    paddingBottom: 4,
  },
  reviewCard: {
    marginBottom: 8,
    padding: '8 12',
    backgroundColor: colors.light,
    borderRadius: 5,
    border: `1 solid ${colors.border}`,
  },
  reviewCardNeg: {
    marginBottom: 8,
    padding: '8 12',
    backgroundColor: '#fff5f5',
    borderRadius: 5,
    border: `1 solid #fca5a5`,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.dark,
  },
  reviewRating: {
    fontSize: 10,
    color: colors.green,
  },
  reviewRatingNeg: {
    fontSize: 10,
    color: colors.red,
  },
  reviewExcerpt: {
    fontSize: 9,
    color: colors.muted,
    lineHeight: 1.4,
  },
  keywordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: `1 solid ${colors.border}`,
  },
  keywordName: {
    fontSize: 10,
    color: colors.text,
  },
  keywordCount: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
  },
  teamText: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.dark,
    padding: '6 10',
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '6 10',
    borderBottom: `1 solid ${colors.border}`,
  },
  tableRowYou: {
    flexDirection: 'row',
    padding: '6 10',
    backgroundColor: '#eff6ff',
    borderBottom: `1 solid ${colors.border}`,
  },
  tableCellName: {
    flex: 3,
    fontSize: 10,
  },
  tableCellRating: {
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
  },
  tableCellReviews: {
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
  },
  rankText: {
    fontSize: 11,
    color: colors.text,
    marginTop: 10,
    padding: '6 10',
    backgroundColor: colors.light,
    borderRadius: 4,
    border: `1 solid ${colors.border}`,
  },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: colors.muted,
  },
})

export type MonthlyReportData = {
  restaurantName: string
  month: string
  thisMonthScore: number | null
  lastMonthScore: number | null
  scoreDelta: number | null
  thisMonthAvgRating: number | null
  lastMonthAvgRating: number | null
  totalReviewsThisMonth: number
  responseRateThisMonth: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  topPositiveReviews: Array<{ author: string; rating: number; excerpt: string }>
  topNegativeReviews: Array<{ author: string; rating: number; excerpt: string }>
  topKeywords: Array<{ keyword: string; count: number }>
  staffMentions: string[]
  competitors: Array<{ name: string; avgRating: number | null; totalReviews: number | null }>
  yourRankAmongCompetitors: number | null
  reviewRequestStats: { sent: number; clicked: number } | null
}

export async function buildReportData(restaurantId: string, month: Date): Promise<MonthlyReportData> {
  const admin = getSupabaseAdmin()

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const lastMonthStart = new Date(month.getFullYear(), month.getMonth() - 1, 1)
  const lastMonthEnd = monthStart

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name')
    .eq('id', restaurantId)
    .single()

  const monthStartTs = Math.floor(monthStart.getTime() / 1000)
  const monthEndTs = Math.floor(monthEnd.getTime() / 1000)
  const lastMonthStartTs = Math.floor(lastMonthStart.getTime() / 1000)
  const lastMonthEndTs = Math.floor(lastMonthEnd.getTime() / 1000)

  const { data: thisMonthReviews } = await admin
    .from('reviews')
    .select('rating, status, sentiment_label, keywords, staff_mentions, author, review_text')
    .eq('restaurant_id', restaurantId)
    .gte('review_timestamp', monthStartTs)
    .lt('review_timestamp', monthEndTs)

  const { data: lastMonthReviews } = await admin
    .from('reviews')
    .select('rating')
    .eq('restaurant_id', restaurantId)
    .gte('review_timestamp', lastMonthStartTs)
    .lt('review_timestamp', lastMonthEndTs)

  const reviews = thisMonthReviews ?? []
  const lastReviews = lastMonthReviews ?? []

  const totalReviewsThisMonth = reviews.length
  const repliedCount = reviews.filter(r => r.status === 'replied').length
  const responseRateThisMonth = totalReviewsThisMonth > 0 ? repliedCount / totalReviewsThisMonth : 0

  const positiveCount = reviews.filter(r => r.sentiment_label === 'positive').length
  const negativeCount = reviews.filter(r => r.sentiment_label === 'negative').length
  const neutralCount = reviews.filter(r => r.sentiment_label === 'neutral').length

  const thisMonthAvgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
      : null

  const lastMonthAvgRating =
    lastReviews.length > 0
      ? lastReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / lastReviews.length
      : null

  // Reputation scores
  const { data: thisScoreRows } = await admin
    .from('reputation_scores')
    .select('score, avg_rating, score_date')
    .eq('restaurant_id', restaurantId)
    .lte('score_date', monthEnd.toISOString().slice(0, 10))
    .gte('score_date', monthStart.toISOString().slice(0, 10))
    .order('score_date', { ascending: false })
    .limit(1)

  const { data: lastScoreRows } = await admin
    .from('reputation_scores')
    .select('score, avg_rating, score_date')
    .eq('restaurant_id', restaurantId)
    .lte('score_date', lastMonthEnd.toISOString().slice(0, 10))
    .gte('score_date', lastMonthStart.toISOString().slice(0, 10))
    .order('score_date', { ascending: false })
    .limit(1)

  const thisMonthScore = thisScoreRows?.[0]?.score ?? null
  const lastMonthScore = lastScoreRows?.[0]?.score ?? null
  const scoreDelta =
    thisMonthScore !== null && lastMonthScore !== null ? thisMonthScore - lastMonthScore : null

  // Keywords aggregation
  const keywordCounts: Record<string, number> = {}
  for (const r of reviews) {
    const kws: string[] = Array.isArray(r.keywords) ? r.keywords : []
    for (const kw of kws) {
      keywordCounts[kw] = (keywordCounts[kw] ?? 0) + 1
    }
  }
  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([keyword, count]) => ({ keyword, count }))

  // Staff mentions
  const staffSet = new Set<string>()
  for (const r of reviews) {
    const mentions: string[] = Array.isArray(r.staff_mentions) ? r.staff_mentions : []
    for (const name of mentions) staffSet.add(name)
  }

  // Top positive / negative reviews
  const positiveReviews = reviews
    .filter(r => r.sentiment_label === 'positive' && r.review_text)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3)
    .map(r => ({
      author: r.author ?? 'Guest',
      rating: r.rating ?? 5,
      excerpt: (r.review_text ?? '').slice(0, 180),
    }))

  const negativeReviews = reviews
    .filter(r => r.sentiment_label === 'negative' && r.review_text)
    .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
    .slice(0, 2)
    .map(r => ({
      author: r.author ?? 'Guest',
      rating: r.rating ?? 1,
      excerpt: (r.review_text ?? '').slice(0, 180),
    }))

  // Competitors
  const { data: competitorRows } = await admin
    .from('competitors')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  const competitorList: MonthlyReportData['competitors'] = []
  for (const comp of competitorRows ?? []) {
    const { data: snapshot } = await admin
      .from('competitor_snapshots')
      .select('avg_rating, total_reviews')
      .eq('competitor_id', comp.id)
      .lte('snapshot_date', monthEnd.toISOString().slice(0, 10))
      .order('snapshot_date', { ascending: false })
      .limit(1)
    competitorList.push({
      name: comp.name,
      avgRating: snapshot?.[0]?.avg_rating ?? null,
      totalReviews: snapshot?.[0]?.total_reviews ?? null,
    })
  }

  // Rank among competitors
  let yourRankAmongCompetitors: number | null = null
  if (thisMonthAvgRating !== null && competitorList.length > 0) {
    const allRatings = [
      { name: restaurant?.name ?? '', rating: thisMonthAvgRating },
      ...competitorList.map(c => ({ name: c.name, rating: c.avgRating ?? 0 })),
    ].sort((a, b) => b.rating - a.rating)
    yourRankAmongCompetitors = allRatings.findIndex(r => r.name === (restaurant?.name ?? '')) + 1
  }

  // Review requests
  const { data: rrRows } = await admin
    .from('review_requests')
    .select('status, sent_at')
    .eq('restaurant_id', restaurantId)
    .gte('sent_at', monthStart.toISOString())
    .lt('sent_at', monthEnd.toISOString())

  let reviewRequestStats: { sent: number; clicked: number } | null = null
  if (rrRows && rrRows.length > 0) {
    reviewRequestStats = {
      sent: rrRows.length,
      clicked: rrRows.filter(r => r.status === 'clicked').length,
    }
  }

  return {
    restaurantName: restaurant?.name ?? 'Your Restaurant',
    month: monthLabel,
    thisMonthScore,
    lastMonthScore,
    scoreDelta,
    thisMonthAvgRating,
    lastMonthAvgRating,
    totalReviewsThisMonth,
    responseRateThisMonth,
    positiveCount,
    negativeCount,
    neutralCount,
    topPositiveReviews: positiveReviews,
    topNegativeReviews: negativeReviews,
    topKeywords,
    staffMentions: Array.from(staffSet),
    competitors: competitorList,
    yourRankAmongCompetitors,
    reviewRequestStats,
  }
}

function Footer({ month, brandName }: { month: string; brandName?: string }) {
  const brand = brandName ?? 'Replova'
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{brand} Reputation Report · {month} · Confidential</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function StarRating({ rating, negative }: { rating: number; negative?: boolean }) {
  const stars = '★'.repeat(Math.min(5, Math.max(0, rating))) + '☆'.repeat(Math.max(0, 5 - rating))
  return (
    <Text style={negative ? styles.reviewRatingNeg : styles.reviewRating}>{stars}</Text>
  )
}

type ReportBranding = { logoUrl?: string; brandName?: string }

function ReportDocument({ data, branding }: { data: MonthlyReportData; branding?: ReportBranding }) {
  const brandName = branding?.brandName
  const logoUrl = branding?.logoUrl
  const trendText = data.scoreDelta !== null
    ? data.scoreDelta > 0
      ? `Your score improved by ${data.scoreDelta.toFixed(1)} points vs last month`
      : data.scoreDelta < 0
      ? `Your score declined by ${Math.abs(data.scoreDelta).toFixed(1)} points vs last month`
      : 'Your score remained the same as last month'
    : null

  return (
    <Document>
      {/* PAGE 1: Executive Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* This is @react-pdf/renderer Image; the DOM alt rule does not apply. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <View>
              <Text style={styles.headerTitle}>{brandName ? `${brandName}: ` : ''}Reputation Report</Text>
              <Text style={styles.headerSub}>{data.restaurantName}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ ...styles.headerSub, color: '#ffffff' }}>{data.month}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* 4 KPI boxes */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Reputation Score</Text>
              <Text style={styles.kpiValue}>{data.thisMonthScore ?? 'N/A'}</Text>
              {data.scoreDelta !== null && (
                <Text style={{ ...styles.kpiDelta, color: data.scoreDelta >= 0 ? colors.green : colors.red }}>
                  {data.scoreDelta >= 0 ? '+' : ''}{data.scoreDelta.toFixed(1)} vs last month
                </Text>
              )}
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Avg Rating</Text>
              <Text style={styles.kpiValue}>
                {data.thisMonthAvgRating !== null ? data.thisMonthAvgRating.toFixed(1) : 'N/A'}
              </Text>
              {data.thisMonthAvgRating !== null && (
                <Text style={{ ...styles.kpiDelta, color: colors.muted }}>★ out of 5</Text>
              )}
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>New Reviews</Text>
              <Text style={styles.kpiValue}>{data.totalReviewsThisMonth}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Response Rate</Text>
              <Text style={styles.kpiValue}>{Math.round(data.responseRateThisMonth * 100)}%</Text>
            </View>
          </View>

          {trendText && (
            <Text style={styles.trendLine}>{trendText}</Text>
          )}

          <Text style={styles.sentimentLine}>
            {data.positiveCount} positive · {data.neutralCount} neutral · {data.negativeCount} negative reviews this month
          </Text>

          {data.reviewRequestStats && (
            <View style={{ ...styles.kpiBox, width: '100%', marginTop: 8 }}>
              <Text style={styles.kpiLabel}>Review Requests</Text>
              <Text style={{ fontSize: 11, color: colors.text, marginTop: 4 }}>
                {data.reviewRequestStats.sent} sent · {data.reviewRequestStats.clicked} clicked
                ({data.reviewRequestStats.sent > 0
                  ? Math.round((data.reviewRequestStats.clicked / data.reviewRequestStats.sent) * 100)
                  : 0}% conversion)
              </Text>
            </View>
          )}
        </View>

        <Footer month={data.month} brandName={brandName} />
      </Page>

      {/* PAGE 2: Review Highlights */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Review Highlights</Text>
            <Text style={styles.headerSub}>{data.restaurantName} · {data.month}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {data.topPositiveReviews.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Top Reviews This Month</Text>
              {data.topPositiveReviews.map((r, i) => (
                <View key={i} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>{r.author}</Text>
                    <StarRating rating={r.rating} />
                  </View>
                  <Text style={styles.reviewExcerpt}>&quot;{r.excerpt}&quot;</Text>
                </View>
              ))}
            </>
          )}

          {data.topNegativeReviews.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Reviews Needing Attention</Text>
              {data.topNegativeReviews.map((r, i) => (
                <View key={i} style={styles.reviewCardNeg}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>{r.author}</Text>
                    <StarRating rating={r.rating} negative />
                  </View>
                  <Text style={styles.reviewExcerpt}>&quot;{r.excerpt}&quot;</Text>
                </View>
              ))}
            </>
          )}

          {data.topKeywords.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>What Customers Talked About</Text>
              {data.topKeywords.map((kw, i) => (
                <View key={i} style={styles.keywordRow}>
                  <Text style={styles.keywordName}>{kw.keyword}</Text>
                  <Text style={styles.keywordCount}>{kw.count} mention{kw.count !== 1 ? 's' : ''}</Text>
                </View>
              ))}
            </>
          )}

          {data.staffMentions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Team Recognition</Text>
              <Text style={styles.teamText}>
                The following team members were mentioned positively: {data.staffMentions.join(', ')}
              </Text>
            </>
          )}
        </View>

        <Footer month={data.month} brandName={brandName} />
      </Page>

      {/* PAGE 3: Competitive Position (only if competitors exist) */}
      {data.competitors.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Competitive Position</Text>
              <Text style={styles.headerSub}>{data.restaurantName} · {data.month}</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.sectionTitle}>Google Rating Comparison</Text>

            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableHeaderCell, flex: 3 }}>Restaurant</Text>
              <Text style={{ ...styles.tableHeaderCell, flex: 1, textAlign: 'center' }}>Rating</Text>
              <Text style={{ ...styles.tableHeaderCell, flex: 1, textAlign: 'center' }}>Reviews</Text>
            </View>

            {/* Your row */}
            <View style={styles.tableRowYou}>
              <Text style={{ ...styles.tableCellName, fontFamily: 'Helvetica-Bold' }}>
                {data.restaurantName} (You)
              </Text>
              <Text style={{ ...styles.tableCellRating, fontFamily: 'Helvetica-Bold' }}>
                {data.thisMonthAvgRating !== null ? data.thisMonthAvgRating.toFixed(1) : 'N/A'}
              </Text>
              <Text style={{ ...styles.tableCellReviews, fontFamily: 'Helvetica-Bold' }}>
                {data.totalReviewsThisMonth}
              </Text>
            </View>

            {data.competitors.map((comp, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableCellName}>{comp.name}</Text>
                <Text style={styles.tableCellRating}>
                  {comp.avgRating !== null ? comp.avgRating.toFixed(1) : 'N/A'}
                </Text>
                <Text style={styles.tableCellReviews}>
                  {comp.totalReviews !== null ? comp.totalReviews : 'N/A'}
                </Text>
              </View>
            ))}

            {data.yourRankAmongCompetitors !== null && (
              <Text style={styles.rankText}>
                You are ranked #{data.yourRankAmongCompetitors} of {data.competitors.length + 1} restaurants you&apos;re tracking
              </Text>
            )}
          </View>

          <Footer month={data.month} brandName={brandName} />
        </Page>
      )}
    </Document>
  )
}

function buildDocumentElement(data: MonthlyReportData, branding?: ReportBranding) {
  return React.createElement(ReportDocument, { data, branding }) as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>
}

export async function generatePdfBuffer(
  data: MonthlyReportData,
  branding?: ReportBranding
): Promise<Buffer> {
  try {
    const buffer = await renderToBuffer(buildDocumentElement(data, branding))
    return Buffer.from(buffer)
  } catch (err) {
    // A user-supplied report_logo_url can be unreachable, non-image, or
    // rejected by the remote host because react-pdf's Image component fetches it
    // during render and throws, which would otherwise take down the entire
    // report generation. Fall back to the report without the logo rather
    // than failing the whole request for a broken branding asset.
    if (branding?.logoUrl) {
      console.error('PDF render failed with custom logo, retrying without it:', err)
      const buffer = await renderToBuffer(buildDocumentElement(data, { ...branding, logoUrl: undefined }))
      return Buffer.from(buffer)
    }
    throw err
  }
}
