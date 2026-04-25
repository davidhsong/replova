// ── Main dashboard page ─────────────────────────────────────────────────────
/* DECISION: The Reviews page is the daily-use surface. Layout commits to a
   two-column "newsroom" feel — long-form review feed left, compact intelligence
   panel right. Optimizing for: (1) negative reviews surface to the top with
   visible weight, (2) numbers are scannable in <3 seconds, (3) zero shadows;
   hairlines and color do the work. */

const { useState: useStateDash } = React;

function DashboardPage({ tweaks }) {
  const [filter, setFilter] = useStateDash('all');
  const [statusFilter, setStatusFilter] = useStateDash('all');
  const [expandedId, setExpandedId] = useStateDash(REVIEWS[0].id);

  const filtered = REVIEWS.filter(r => {
    if (statusFilter === 'unreplied' && r.status !== 'unreplied') return false;
    if (statusFilter === 'replied' && r.status !== 'replied') return false;
    if (filter === 'negative' && r.sentiment !== 'negative') return false;
    if (filter === 'positive' && r.sentiment !== 'positive') return false;
    if (filter === 'mixed' && r.sentiment !== 'mixed') return false;
    return true;
  });

  const unrepliedCount = REVIEWS.filter(r => r.status === 'unreplied').length;
  const urgentCount = REVIEWS.filter(r => r.urgent).length;

  return (
    <div className="app">
      <Sidebar active="/dashboard"/>
      <div className="main">
        <TopBar>
          <span style={{ color:'var(--t2)' }}>Workspace</span>
          <Ico.chevRight s={10}/>
          <span style={{ color:'var(--t1)', fontWeight:600 }}>Reviews</span>
        </TopBar>

        <div className="page-header">
          <Note>{`/* Layout decision\n   Two-column newsroom: review feed left, intelligence panel right.\n   Negative reviews surface first via order + a left rail color, not a card-shadow shout.\n   Stats use color background only when the number demands it (urgent ≠ 0 → red bg).\n*/`}</Note>

          <PageHeader
            kicker="Bella Napoli · 123 Mulberry St"
            title="Reviews"
            subtitle="Updated 4 minutes ago · auto-syncs every 6h"
            status="Monitoring"
            right={
              <button className="btn btn-ghost btn-sm"><Ico.refresh s={12}/> Sync now</button>
            }
          />
        </div>

        <div className="page-body">
          {/* Urgent banner — only when count > 0 */}
          {urgentCount > 0 && (
            <div className="fade-up" style={{ marginBottom:20 }}>
              <Banner kind="neg"
                title={`${urgentCount} negative review${urgentCount>1?'s':''} need a reply`}
                body="A reply within 24 hours is the difference between recovery and a permanent 1-star."
              />
            </div>
          )}

          {/* Stats strip */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, marginBottom:28 }}>
            <StatTile
              label="Replova score"
              value={SCORE.total}
              delta={SCORE.delta}
              sub="vs last week"
              sparkline={<MiniLine data={[72,73,74,73,75,74,76,77,76,78,77,78]} w={64} h={20} color="var(--accent)" stroke={1.5}/>}
            />
            <StatTile
              label="Google rating"
              value={<span><span>4.3</span><span style={{ color:'var(--gold)', fontSize:18, marginLeft:2 }}>★</span></span>}
              sub="142 reviews · last 90 days"
            />
            <StatTile
              label="New this month"
              value={28}
              delta={+6}
              sub="11 positive · 14 mixed · 3 negative"
              sparkline={<MiniLine data={[2,3,4,3,2,5,4,6,3,4,5,7]} w={64} h={20} color="var(--t2)" stroke={1.5} fill/>}
            />
            <StatTile
              label="Awaiting reply"
              value={unrepliedCount}
              urgent={unrepliedCount > 0}
              allClear={unrepliedCount === 0}
              sub={unrepliedCount===0 ? '✓ All caught up' : `Oldest: ${REVIEWS.filter(r=>r.status==='unreplied').map(r=>r.hoursAgo).sort((a,b)=>b-a)[0]}h ago`}
            />
          </div>

          {/* Two columns */}
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) 320px', gap:32, alignItems:'flex-start' }}>
            {/* Left: review feed */}
            <div>
              {/* Filter bar */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:0, paddingBottom:0 }}>
                <div className="tabs">
                  {[
                    { k:'all', l:'All', n:REVIEWS.length },
                    { k:'unreplied', l:'Awaiting reply', n:unrepliedCount },
                    { k:'replied', l:'Replied', n:REVIEWS.filter(r=>r.status==='replied').length },
                  ].map(t => (
                    <button key={t.k} onClick={()=>setStatusFilter(t.k)} className={`tab ${statusFilter===t.k?'active':''}`}>
                      {t.l} <span className="tnum c-t4" style={{ marginLeft:4, fontSize:11 }}>{t.n}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <select className="field" style={{ height:30, padding:'0 28px 0 10px', fontSize:12, width:'auto', appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='none' stroke='%23807c70' stroke-width='1.6' d='M2 4l3 3 3-3'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center' }}
                    value={filter} onChange={e=>setFilter(e.target.value)}>
                    <option value="all">All sentiment</option>
                    <option value="negative">Negative</option>
                    <option value="mixed">Mixed</option>
                    <option value="positive">Positive</option>
                  </select>
                </div>
              </div>

              {/* Reviews list */}
              <div className="card" style={{ overflow:'hidden', marginTop:0, borderTopLeftRadius:0, borderTopRightRadius:0, borderTop:'none' }}>
                {filtered.map(r => (
                  <ReviewCard
                    key={r.id} review={r}
                    expanded={expandedId === r.id}
                    onExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    mode={tweaks?.negativeStyle}
                  />
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding:'56px 24px', textAlign:'center' }}>
                    <div className="t-serif t-italic c-t3" style={{ fontSize:20 }}>Nothing here.</div>
                    <div className="t-xs c-t3" style={{ marginTop:6 }}>Try a different filter.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: intelligence panel */}
            <IntelligencePanel scoreStyle={tweaks?.scoreStyle}/>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
