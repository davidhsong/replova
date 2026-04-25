'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'

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

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending',  cls: 'badge badge-zinc' },
  sent:    { label: 'Sent',     cls: 'badge' },
  opened:  { label: 'Opened',   cls: 'badge badge-amber' },
  clicked: { label: 'Clicked',  cls: 'badge badge-green' },
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card fade-up" style={{ padding: '18px 20px' }}>
      <p style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
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
      const supabase = getSupabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
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

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  if (authError) {
    return (
      <div className="page-wrap" style={{ textAlign: 'center', paddingTop: 64 }}>
        <p style={{ color: 'var(--t3)', fontSize: 14 }}>Please sign in to view this page.</p>
      </div>
    )
  }

  const pendingCount = stats?.pending ?? 0

  return (
    <>
      <div className="sec-head">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--t1)', marginBottom: 2 }}>
            Review Requests
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>Send Google review invitations to past customers</p>
        </div>
      </div>

      <div className="page-wrap">

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="Sent" value={String((stats?.sent ?? 0) + (stats?.opened ?? 0) + (stats?.clicked ?? 0))} />
          <StatCard label="Opened" value={String(stats?.opened ?? 0)} sub={stats ? `${Math.round(stats.openRate * 100)}% open rate` : undefined} />
          <StatCard label="Clicked" value={String(stats?.clicked ?? 0)} />
          <StatCard label="Click Rate" value={stats ? `${Math.round(stats.clickRate * 100)}%` : '—'} sub="of emails sent" />
        </div>

        {/* Upload card */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Upload Contacts</h2>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
            Expected format: <code style={{ background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 5, fontSize: 12 }}>name</code>,{' '}
            <code style={{ background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 5, fontSize: 12 }}>email</code> columns. One customer per row.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-md)'}`,
              borderRadius: 12,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'var(--accent-sub)' : 'var(--surface-2)',
              transition: 'border-color 120ms, background 120ms',
              marginBottom: 16,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px' }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? (
              <p style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>Uploading…</p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500, marginBottom: 4 }}>
                  Drop a CSV here, or click to browse
                </p>
                <p style={{ fontSize: 12, color: 'var(--t3)' }}>Accepts .csv files</p>
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

          {/* Upload result */}
          {uploadResult && (
            <div className={`banner fade-up ${uploadResult.imported > 0 ? 'banner-green' : 'banner-amber'}`} style={{ marginBottom: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                {uploadResult.imported > 0
                  ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                  : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
                }
              </svg>
              <span>
                Imported {uploadResult.imported} customer{uploadResult.imported !== 1 ? 's' : ''}
                {uploadResult.skipped > 0 && (
                  <> ({uploadResult.skipped} skipped
                  {uploadResult.reasons.duplicate > 0 && ` — ${uploadResult.reasons.duplicate} already contacted`}
                  {uploadResult.reasons.invalidEmail > 0 && `, ${uploadResult.reasons.invalidEmail} invalid email`}
                  {uploadResult.reasons.noEmail > 0 && `, ${uploadResult.reasons.noEmail} missing email`}
                  )</>
                )}
              </span>
            </div>
          )}

          {/* Send result */}
          {sendResult && (
            <div className={`banner fade-up ${sendResult.errors.length === 0 ? 'banner-green' : 'banner-amber'}`} style={{ marginBottom: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              <span>
                Sent {sendResult.sent} email{sendResult.sent !== 1 ? 's' : ''}
                {sendResult.errors.length > 0 && ` · ${sendResult.errors.length} failed`}
              </span>
            </div>
          )}

          {/* Send all button */}
          <button
            onClick={handleSendAll}
            disabled={sending || pendingCount === 0}
            className="btn-press"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              background: pendingCount > 0 ? 'var(--t1)' : 'var(--surface-2)',
              color: pendingCount > 0 ? 'var(--bg)' : 'var(--t3)',
              border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 700,
              cursor: pendingCount > 0 ? 'pointer' : 'not-allowed',
              opacity: sending ? 0.6 : 1,
              transition: 'background 120ms, color 120ms, opacity 120ms',
            }}
          >
            {sending ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Sending…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Send All{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </>
            )}
          </button>
        </div>

        {/* Requests table */}
        <div className="card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Recent Requests</h2>
          </div>

          {requests.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--t3)' }}>
                {stats === null ? 'Loading…' : 'No requests yet — upload a CSV to get started.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Customer', 'Email', 'Status', 'Sent'].map(col => (
                      <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, i) => {
                    const badge = STATUS_BADGE[r.status] ?? { label: r.status, cls: 'badge badge-zinc' }
                    return (
                      <tr key={r.id} style={{ borderBottom: i < requests.length - 1 ? '1px solid var(--border)' : undefined }}>
                        <td style={{ padding: '11px 16px', color: 'var(--t1)', fontWeight: 500 }}>
                          {r.customer_name ?? <span style={{ color: 'var(--t3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--t2)' }}>{r.customer_email}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span className={badge.cls} style={{ fontSize: 11, padding: '3px 8px' }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--t3)' }}>{formatDate(r.sent_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
