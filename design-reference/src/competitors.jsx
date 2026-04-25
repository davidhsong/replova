// ── Competitors page ────────────────────────────────────────────────────────
/* DECISION: Competitor page leads with the YOU position, then the chart.
   The chart is a real multi-line chart (12 weeks of rating snapshots), not a
   sparkline afterthought. Comparison table treats "you" as a contrast row. */

const { useState: useStateC } = React;

function RatingChart({ data, you='you', height=240 }) {
  const series = Object.keys(data);
  const all = series.flatMap(k => data[k]);
  const min = 3.7, max = 5.0;
  const range = max - min;
  const w = 700, h = height, padL = 36, padR = 12, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = data[you].length;

  const colors = {
    you:    'var(--accent)',
    fiori:  '#3a7e5e',
    cosa:   '#7a4cc4',
    ponte:  '#a37c2a',
  };
  const labels = {
    you:    'Bella Napoli',
    fiori:  'Trattoria Fiori',
    cosa:   'Cosa Nostra',
    ponte:  'Il Ponte',
  };

  function pathFor(arr) {
    return arr.map((v,i) => {
      const x = padL + (i/(n-1))*innerW;
      const y = padT + (1 - (v-min)/range)*innerH;
      return `${i===0?'M':'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  const yticks = [3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0];

  return (
    <div style={{ width:'100%', overflow:'hidden' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" style={{ display:'block' }}>
        {/* Grid lines */}
        {yticks.map(t => {
          const y = padT + (1 - (t-min)/range)*innerH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w-padR} y2={y} stroke="var(--line)" strokeWidth="1"/>
              <text x={padL-8} y={y+3} fontSize="10" fill="var(--t3)" textAnchor="end" fontFamily="var(--mono)">{t.toFixed(1)}</text>
            </g>
          );
        })}
        {/* Lines (you on top) */}
        {series.filter(s => s !== you).map(s => (
          <path key={s} d={pathFor(data[s])} stroke={colors[s]} strokeWidth="1.5" fill="none" strokeDasharray="3 3" opacity="0.7"/>
        ))}
        <path d={pathFor(data[you])} stroke={colors[you]} strokeWidth="2.4" fill="none"/>
        {/* End-point dot for you */}
        {(() => {
          const v = data[you][n-1];
          const x = padL + innerW;
          const y = padT + (1 - (v-min)/range)*innerH;
          return <circle cx={x} cy={y} r="4" fill={colors[you]}/>;
        })()}
        {/* X axis labels */}
        {[0, Math.floor(n/3), Math.floor((n*2)/3), n-1].map(i => {
          const x = padL + (i/(n-1))*innerW;
          const labels = ['12w','8w','4w','now'];
          return <text key={i} x={x} y={h-8} fontSize="10" fill="var(--t3)" textAnchor="middle" fontFamily="var(--mono)">{labels[[0, Math.floor(n/3), Math.floor((n*2)/3), n-1].indexOf(i)]}</text>;
        })}
      </svg>
      {/* Legend */}
      <div style={{ display:'flex', gap:24, marginTop:14, flexWrap:'wrap', paddingLeft:padL }}>
        {series.map(s => {
          const v = data[s][data[s].length-1];
          return (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:14, height:2, background: colors[s], borderRadius:1 }}/>
              <span style={{ fontSize:12, fontWeight: s===you ? 600 : 400, color: s===you ? 'var(--t1)' : 'var(--t2)' }}>{labels[s]}</span>
              <span className="tnum t-xs c-t3">{v.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompetitorsPage() {
  const [search, setSearch] = useStateC('');
  const [competitors, setCompetitors] = useStateC(COMPETITORS);
  const sorted = [...competitors].sort((a,b)=>b.rating-a.rating);
  const youRow = sorted.find(c => c.isYou);
  const yourRank = sorted.findIndex(c => c.isYou) + 1;
  const slotsUsed = competitors.filter(c => !c.isYou).length;
  const slotsTotal = 5;

  const searchResults = search.length > 1 ? [
    { name:'Pasta Madre', addr:'9 Greenwich Ave', rating:4.5, reviews:198 },
    { name:'Sotto Voce',  addr:'67 W 4th St',     rating:4.6, reviews:402 },
  ] : [];

  return (
    <div className="app">
      <Sidebar active="/dashboard/competitors"/>
      <div className="main">
        <TopBar>
          <span style={{ color:'var(--t2)' }}>Workspace</span>
          <Ico.chevRight s={10}/>
          <span style={{ color:'var(--t1)', fontWeight:600 }}>Competitors</span>
        </TopBar>

        <div className="page-header">
          <Note>{`/* Layout decision: lead with rank, not roster. The "you are #3 of 4"\n   line is the answer to why you opened this page.\n   Rating chart is a real chart — multiple series over 12 weeks.\n*/`}</Note>
          <PageHeader title="Competitors" subtitle="4 of 5 competitor slots used"/>
        </div>

        <div className="page-body">
          {/* Rank statement */}
          <div className="card" style={{ padding:32, marginBottom:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, alignItems:'center' }}>
            <div>
              <div className="t-eyebrow" style={{ marginBottom:14 }}>Your position</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:18, marginBottom:10, flexWrap:'wrap' }}>
                <span className="t-serif" style={{ fontSize:88, lineHeight:1, letterSpacing:'-0.04em' }}>#{yourRank}</span>
                <span className="t-h2" style={{ color:'var(--t3)', fontSize:22, whiteSpace:'nowrap' }}>of {sorted.length}</span>
              </div>
              <p className="t-body c-t2" style={{ maxWidth:340, lineHeight:1.6 }}>
                You're <strong className="c-t1">0.4 stars</strong> behind the leader. Closing that means roughly <strong className="c-t1">14 more 5★ reviews</strong> at your current volume.
              </p>
            </div>
            <div style={{ borderLeft:'1px solid var(--line)', paddingLeft:32 }}>
              <div className="t-eyebrow" style={{ marginBottom:18 }}>Set</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {sorted.map((c, i) => {
                  const medal = i === 0 ? '#c08725' : i === 1 ? '#7c7569' : i === 2 ? '#a06430' : null;
                  return (
                    <div key={c.id} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'8px 12px', borderRadius:6,
                      background: c.isYou ? 'var(--accent-sub)' : 'transparent',
                    }}>
                      <span className="t-mono tnum" style={{ width:18, fontSize:11, color: medal || 'var(--t3)', fontWeight:700 }}>#{i+1}</span>
                      <span style={{ flex:1, fontSize:13, fontWeight: c.isYou ? 700 : 500, color: c.isYou ? 'var(--accent)' : 'var(--t1)' }}>
                        {c.name}{c.isYou && <span style={{ marginLeft:8, fontSize:10, fontWeight:600, opacity:0.7 }}>YOU</span>}
                      </span>
                      <span className="tnum" style={{ fontSize:13, fontWeight:600, color:'var(--gold)' }}>{c.rating.toFixed(1)}★</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="card" style={{ padding:24, marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <div className="t-eyebrow" style={{ marginBottom:4 }}>Rating · 12 weeks</div>
                <div className="t-xs c-t3">Daily snapshots, weekly average</div>
              </div>
              <div className="seg">
                {['12w','6m','1y'].map(t => (
                  <button key={t} className={t==='12w'?'on':''}>{t}</button>
                ))}
              </div>
            </div>
            <RatingChart data={RATING_SERIES} you="you"/>
          </div>

          {/* Two columns: add + table */}
          <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:24, alignItems:'flex-start' }}>
            <div className="card" style={{ padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div className="t-eyebrow">Add competitor</div>
                <span className="t-mono t-xs c-t3 tnum">{slotsUsed} / {slotsTotal} slots</span>
              </div>
              <div style={{ position:'relative', marginBottom:14 }}>
                <span style={{ position:'absolute', top:11, left:12, color:'var(--t3)' }}><Ico.search s={13}/></span>
                <input className="field" style={{ paddingLeft:36 }} placeholder="Search Google Places…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              {searchResults.length > 0 && (
                <div style={{ marginBottom:14, border:'1px solid var(--line)', borderRadius:8 }}>
                  {searchResults.map((r, i) => (
                    <div key={r.name} style={{ display:'flex', alignItems:'center', gap:10, padding:10, borderTop: i>0?'1px solid var(--line)':'none' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{r.name}</div>
                        <div className="t-xs c-t3">{r.addr} · {r.rating}★</div>
                      </div>
                      <button className="btn btn-ghost btn-sm">Add</button>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{ width:'100%' }}>
                <Ico.refresh s={11}/> Auto-discover nearby
              </button>
              <div className="t-xs c-t3" style={{ marginTop:14, lineHeight:1.5 }}>
                We'll surface 5–10 restaurants serving similar food within a mile. You decide which to track.
              </div>
            </div>

            <div className="card" style={{ overflow:'hidden' }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th style={{ width:60 }}>Rank</th>
                    <th>Restaurant</th>
                    <th style={{ width:90, textAlign:'right' }}>Rating</th>
                    <th style={{ width:90, textAlign:'right' }}>Reviews</th>
                    <th style={{ width:110, textAlign:'right' }}>vs. You</th>
                    <th style={{ width:50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c,i) => {
                    const delta = (c.rating - youRow.rating);
                    return (
                      <tr key={c.id} style={{ background: c.isYou ? 'var(--accent-sub)' : undefined }}>
                        <td>
                          <span className="t-mono tnum" style={{ fontWeight:700, color: i<3 ? ['#c08725','#7c7569','#a06430'][i] : 'var(--t3)' }}>#{i+1}</span>
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontWeight: c.isYou ? 700 : 500, color: c.isYou ? 'var(--accent)' : 'var(--t1)' }}>{c.name}</span>
                            {c.isYou && <span className="pill pill-accent" style={{ height:18 }}>You</span>}
                          </div>
                          <div className="t-xs c-t3" style={{ marginTop:1 }}>{c.address}</div>
                        </td>
                        <td className="tnum" style={{ textAlign:'right', fontWeight:600 }}>
                          {c.rating.toFixed(1)} <span style={{ color:'var(--gold)' }}>★</span>
                        </td>
                        <td className="tnum" style={{ textAlign:'right', color:'var(--t2)' }}>{c.reviews}</td>
                        <td className="tnum" style={{ textAlign:'right' }}>
                          {c.isYou ? <span className="c-t3">—</span> : (
                            <span style={{ color: delta > 0 ? 'var(--neg)' : 'var(--pos)', fontWeight:600 }}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign:'right' }}>
                          {!c.isYou && <button className="btn btn-quiet btn-sm" style={{ padding:'0 6px' }}><Ico.trash s={12}/></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CompetitorsPage });
