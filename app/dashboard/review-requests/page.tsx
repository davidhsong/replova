'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { IconUpload, IconSend, IconRefresh } from '@/components/icons'

type Restaurant = { id: string; name: string }

type ReviewRequest = {
  id: string
  customer_name: string | null
  customer_email: string
  status: string
  sent_at: string | null
  created_at: string
}

type Stats = {
  total: number
  pending: number
  sent: number
  opened: number
  clicked: number
  openRate: number
  clickRate: number
}

type UploadResult = {
  imported: number
  skipped: number
  reasons: { noEmail: number; invalidEmail: number; duplicate: number }
}

const STATUS_COLORS: Record<string, { bg: string; c: string; label: string }> = {
  pending: { bg: 'var(--surface-2)', c: 'var(--t3)',   label: 'Pending' },
  sent:    { bg: 'var(--surface-2)', c: 'var(--t2)',   label: 'Sent'    },
  opened:  { bg: 'var(--warn-sub)',  c: 'var(--warn)', label: 'Opened'  },
  clicked: { bg: 'var(--pos-sub)',   c: 'var(--pos)',  label: 'Clicked' },
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ReviewRequestsPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [requests, setRequests] = useState<ReviewRequest[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [sendResult, setSendResult] = useState<{ sent: number; errors: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [authError, setAuthError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await getSupabaseBrowser().auth.getUser()
      if (!user) { setAuthError(true); return }
      const res = await fetch('/api/restaurant')
      if (!res.ok) { setAuthError(true); return }
      const r: Restaurant = await res.json()
      setRestaurant(r)
      await loadData(r.id)
    }
    init()
  }, [])

  async function loadData(restaurantId: string) {
    const [statsRes, reqsRes] = await Promise.all([
      fetch(`/api/review-requests/stats?restaurantId=${restaurantId}`),
      fetch(`/api/review-requests/list?restaurantId=${restaurantId}`),
    ])
    if (statsRes.ok) setStats(await statsRes.json())
    if (reqsRes.ok) setRequests(await reqsRes.json())
  }

  async function handleFile(file: File) {
    if (!restaurant) return
    setUploading(true)
    setUploadResult(null)
    setSendResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/review-requests/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        setUploadResult(data)
        await loadData(restaurant.id)
      } else {
        setUploadResult({ imported: 0, skipped: 0, reasons: { noEmail: 0, invalidEmail: 0, duplicate: 0 } })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSendAll() {
    if (!restaurant) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/review-requests/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      })
      const data = await res.json()
      setSendResult(data)
      await loadData(restaurant.id)
    } finally {
      setSending(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (authError) {
    return (
      <div className="page-body" style={{ textAlign: 'center', paddingTop: 64 }}>
        <p className="t-sm c-t3">Please sign in to view this page.</p>
      </div>
    )
  }

  const totalSent = (stats?.sent ?? 0) + (stats?.opened ?? 0) + (stats?.clicked ?? 0)
  const opened = stats?.opened ?? 0
  const clicked = stats?.clicked ?? 0
  const pendingCount = stats?.pending ?? 0
  const openRate = totalSent > 0 ? opened / totalSent : 0
  const clickRate = totalSent > 0 ? clicked / totalSent : 0

  const funnelCells = [
    { l: 'Sent',    v: totalSent, sub: `${stats?.total ?? 0} contacts`,                    w: 1.0,       color: 'var(--t1)'  },
    { l: 'Opened',  v: opened,    sub: `${Math.round(openRate * 100)}% open rate`,          w: openRate,  color: 'var(--warn)' },
    { l: 'Clicked', v: clicked,   sub: `${Math.round(clickRate * 100)}% click rate`,        w: clickRate, color: 'var(--pos)'  },
    { l: 'Pending', v: pendingCount, sub: 'queued for next batch',                          w: stats && stats.total > 0 ? pendingCount / stats.total : 0, color: 'var(--t3)' },
  ]

  return (
    <>
      <div className="page-header">
        <div className="t-eyebrow" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--t3)' }}>Workspace</span>
          {' › '}
          <span>Review requests</span>
        </div>
        <h1 className="t-h1" style={{ marginBottom: 4 }}>Review requests</h1>
        <p className="t-sm c-t3">Send a personal nudge to people who already loved their meal.</p>
      </div>

      <div className="page-body">

        {/* Funnel stats strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          border: '1px solid var(--line)', borderRadius: 'var(--r-7)',
          overflow: 'hidden', marginBottom: 32,
          background: 'var(--surface)',
        }} className="fade-up">
          {funnelCells.map((s, i) => (
            <div key={s.l} style={{
              padding: '18px 22px',
              borderRight: i < 3 ? '1px solid var(--line)' : 'none',
              position: 'relative',
            }}>
              <div className="t-eyebrow" style={{ marginBottom: 6, color: s.color }}>{s.l}</div>
              <span className="t-serif tnum" style={{ fontSize: 32, lineHeight: 1, color: s.color }}>
                {s.v}
              </span>
              <div className="t-xs c-t3" style={{ marginTop: 6 }}>{s.sub}</div>
              {/* Funnel bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0,
                height: 3, width: `${s.w * 100}%`,
                background: s.color, opacity: 0.7,
              }} />
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'flex-start' }}>

          {/* Left: upload + send */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card fade-up" style={{ padding: 20 }}>
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>Bulk upload</div>
              <p className="t-xs c-t3" style={{ marginBottom: 14, lineHeight: 1.55 }}>
                CSV with headers:{' '}
                <span className="t-mono" style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 }}>name</span>,{' '}
                <span className="t-mono" style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 }}>email</span>{' '}
                (one customer per row).
              </p>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--line-md)'}`,
                  borderRadius: 'var(--r-5)',
                  padding: '24px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'var(--accent-sub)' : 'var(--surface-2)',
                  transition: 'border-color 0.15s, background 0.15s',
                  marginBottom: 14,
                }}
              >
                <div style={{
                  display: 'inline-flex', width: 40, height: 40, borderRadius: 'var(--r-5)',
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 10, color: 'var(--t2)',
                }}>
                  <IconUpload s={18} />
                </div>
                {uploading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="spin" style={{ display: 'inline-flex', color: 'var(--t3)' }}><IconRefresh s={14} /></span>
                    <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>Uploading…</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Drop CSV here</div>
                    <div className="t-xs c-t3">or click to browse</div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />

              {uploadResult && (
                <div className={`banner fade-up ${uploadResult.imported > 0 ? 'banner-pos' : 'banner-warn'}`} style={{ marginBottom: 14 }}>
                  Imported {uploadResult.imported} customer{uploadResult.imported !== 1 ? 's' : ''}
                  {uploadResult.skipped > 0 && (
                    <span style={{ opacity: 0.8 }}>
                      {' '}({uploadResult.skipped} skipped
                      {uploadResult.reasons.duplicate > 0 && `, ${uploadResult.reasons.duplicate} already contacted`}
                      {uploadResult.reasons.invalidEmail > 0 && `, ${uploadResult.reasons.invalidEmail} invalid email`}
                      {uploadResult.reasons.noEmail > 0 && `, ${uploadResult.reasons.noEmail} missing email`}
                      )
                    </span>
                  )}
                </div>
              )}

              {sendResult && (
                <div className={`banner fade-up ${sendResult.errors.length === 0 ? 'banner-pos' : 'banner-warn'}`} style={{ marginBottom: 14 }}>
                  <IconSend s={13} />
                  Sent {sendResult.sent} email{sendResult.sent !== 1 ? 's' : ''}
                  {sendResult.errors.length > 0 && ` · ${sendResult.errors.length} failed`}
                </div>
              )}

              <button
                onClick={handleSendAll}
                disabled={sending || pendingCount === 0}
                className="btn btn-primary"
                style={{ width: '100%', opacity: sending ? 0.6 : 1 }}
              >
                {sending
                  ? <><span className="spin" style={{ display: 'inline-flex' }}><IconRefresh s={13} /></span> Sending…</>
                  : <><IconSend s={12} /> Send all{pendingCount > 0 ? ` (${pendingCount})` : ''}</>
                }
              </button>
            </div>
          </div>

          {/* Right: history table */}
          <div className="card fade-up" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Recent requests</div>
            </div>

            {requests.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p className="t-serif t-italic c-t3" style={{ fontSize: 18, marginBottom: 6 }}>Nothing sent yet.</p>
                <p className="t-xs c-t3">Upload a CSV to get started.</p>
              </div>
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.sent
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>
                          {r.customer_name ?? <span className="c-t3">-</span>}
                        </td>
                        <td className="t-mono t-xs c-t2">{r.customer_email}</td>
                        <td>
                          <span className="pill" style={{ background: sc.bg, color: sc.c, borderColor: 'transparent' }}>
                            <span className="dot" style={{ background: sc.c, opacity: 0.7 }} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="tnum t-xs c-t3" style={{ textAlign: 'right' }}>
                          {formatDate(r.sent_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
