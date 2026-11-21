import { getSupabaseAdmin } from '@/lib/supabase'
import { isUuid } from '@/lib/playbook'
import { renderTapForm, tapDocument } from '@/lib/tapForm'

type Context = { params: Promise<{ placard: string }> }
const unavailable = () =>
  tapDocument('<h1>Tap unavailable</h1><p>This placard is no longer accepting feedback.</p>', 404)
const retry = () =>
  tapDocument(
    '<h1>Please try again</h1><p>We could not reach the feedback service. Please refresh this page.</p>',
    503,
  )
const receipt = () => tapDocument('<h1>Thank you.</h1><p>Your feedback was received. You can close this page.</p>')
const expired = (placard: string, test: boolean) => tapDocument(
  `<h1>This form has expired</h1><p>Feedback forms stay open for ten minutes.</p><a href="/t/${placard}${test ? '?test=1' : ''}">Start a fresh form</a>`, 410,
)

export async function GET(request: Request, { params }: Context) {
  const { placard } = await params
  if (!isUuid(placard)) return unavailable()
  const query = new URL(request.url).searchParams
  const test = query.get('test') === '1'
  const visit = query.get('visit')
  if (visit !== null) {
    if (!isUuid(visit)) return expired(placard, test)
    const { data, error } = await getSupabaseAdmin().rpc('tap_resume', { p_placard: placard, p_encounter: visit })
    if (error) return retry()
    const row = data?.[0]
    if (!row) return unavailable()
    if (row.status === 'received') return receipt()
    return row.status === 'open' ? renderTapForm(row.business, visit, row.is_test) : expired(placard, test)
  }
  const { data, error } = await getSupabaseAdmin().rpc('tap_open', {
    p_placard: placard,
    p_test: test,
  })
  if (error) return retry()
  return data?.[0] ? renderTapForm(data[0].business, data[0].encounter, test) : unavailable()
}

export async function POST(request: Request, { params }: Context) {
  const { placard } = await params
  if (!isUuid(placard)) return unavailable()
  const query = new URL(request.url).searchParams
  const test = query.get('test') === '1'
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
    return tapDocument('<h1>Invalid form</h1>', 415)
  const fields = new URLSearchParams(await request.text())
  const id = fields.get('encounter')
  if (!isUuid(id) || (query.has('visit') && query.get('visit') !== id)) return expired(placard, test)
  const rating = fields.get('rating') ?? ''
  const comment = (fields.get('comment') ?? '').trim()
  if (!/^[1-5]$/.test(rating) || comment.length > 2000) {
    const { data: label, error } = await getSupabaseAdmin().rpc('tap_label', { p_placard: placard })
    if (error) return retry()
    if (!label) return unavailable()
    return renderTapForm(
      label,
      id,
      test,
      'Choose a rating from 1 to 5 and keep your comment under 2,001 characters.',
      comment.slice(0, 2000),
    )
  }
  const { data, error } = await getSupabaseAdmin().rpc('tap_submit', {
    p_placard: placard,
    p_encounter: id,
    p_rating: Number(rating),
    p_comment: comment,
  })
  if (error) return retry()
  if (data === 'received') return receipt()
  if (data === 'expired') {
    const prior = await getSupabaseAdmin().rpc('tap_resume', { p_placard: placard, p_encounter: id })
    if (prior.error) return retry()
    if (prior.data?.[0]?.status === 'received') return receipt()
  }
  return data === 'closed' ? unavailable() : expired(placard, test)
}
