// ── Dashboard primitives shared by review/intelligence ──────────────────────
const { useState: useStateD, useEffect: useEffectD, useMemo: useMemoD, useRef: useRefD } = React;

// Sparkline / line chart
function MiniLine({ data, w=120, h=28, color='var(--t1)', stroke=1.5, fill=false }) {
  const min = Math.min(...data), max = Math.max(...data);
  const pad = 2;
  const range = (max - min) || 1;
  const points = data.map((v, i) => {
    const x = pad + (i/(data.length-1))*(w-pad*2);
    const y = h - pad - ((v-min)/range)*(h-pad*2);
    return [x,y];
  });
  const d = points.map((p,i) => `${i===0?'M':'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      {fill && (
        <path d={`${d} L${w-pad} ${h-pad} L${pad} ${h-pad} Z`} fill={color} opacity="0.08"/>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Score gauge — arc style
function ScoreGauge({ value, size=180, mode='arc' }) {
  if (mode === 'numeric') {
    return (
      <div style={{ textAlign:'center' }}>
        <div className="t-serif" style={{ fontSize:96, lineHeight:1, fontWeight:400, letterSpacing:'-0.04em' }}>{value}</div>
        <div className="t-eyebrow" style={{ marginTop:8 }}>out of 100</div>
      </div>
    );
  }
  if (mode === 'bar') {
    return (
      <div style={{ width:'100%' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
          <span className="t-serif" style={{ fontSize:48, lineHeight:1 }}>{value}</span>
          <span className="t-xs c-t3">/ 100</span>
        </div>
        <div style={{ height:8, background:'var(--surface-2)', borderRadius:4, overflow:'hidden' }}>
          <div style={{ width:`${value}%`, height:'100%', background:'var(--accent)', borderRadius:4 }}/>
        </div>
      </div>
    );
  }
  // arc
  const r = size/2 - 14;
  const cx = size/2, cy = size/2;
  const start = -135, end = 135;
  const angle = start + ((end-start) * value / 100);
  function arcPath(a1, a2) {
    const rad = (a) => (a-90) * Math.PI/180;
    const x1 = cx + r*Math.cos(rad(a1)), y1 = cy + r*Math.sin(rad(a1));
    const x2 = cx + r*Math.cos(rad(a2)), y2 = cy + r*Math.sin(rad(a2));
    const large = (a2-a1) > 180 ? 1 : 0;
    return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size}>
        <path d={arcPath(start, end)} stroke="var(--line)" strokeWidth="6" fill="none" strokeLinecap="round"/>
        <path d={arcPath(start, angle)} stroke="var(--accent)" strokeWidth="6" fill="none" strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div className="t-serif" style={{ fontSize:54, lineHeight:1, letterSpacing:'-0.03em' }}>{value}</div>
        <div className="t-eyebrow" style={{ marginTop:6 }}>Replova score</div>
      </div>
    </div>
  );
}

// 12-week sentiment heatmap row
function SentimentStrip({ data }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {data.map((v, i) => {
        const intensity = Math.abs(v); // 0..1
        const isPos = v >= 0.45;
        const isNeg = v < 0.3;
        const color = isPos ? 'var(--pos)' : isNeg ? 'var(--neg)' : 'var(--warn)';
        const bg = isPos ? 'var(--pos-sub)' : isNeg ? 'var(--neg-sub)' : 'var(--warn-sub)';
        return (
          <div key={i} title={`Week ${i+1}: ${v.toFixed(2)}`} style={{
            flex:1, height:24, borderRadius:2, background: bg,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${intensity*100}%`, background: color, opacity:0.6 }}/>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, delta, accent, sparkline, urgent, allClear }) {
  const bg = urgent ? 'var(--neg-sub)' : (allClear ? 'var(--pos-sub)' : 'var(--surface)');
  const bd = urgent ? 'var(--neg-line)' : (allClear ? 'var(--pos-line)' : 'var(--line)');
  return (
    <div style={{
      flex:1, padding:'16px 18px', background: bg, border: `1px solid ${bd}`,
      borderRadius:'var(--r-6)', display:'flex', flexDirection:'column', gap:6,
      transition:'background 0.15s',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="t-eyebrow" style={{ color: urgent?'var(--neg)':allClear?'var(--pos)':'var(--t3)' }}>{label}</div>
        {sparkline}
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
        <span className="t-serif tnum" style={{ fontSize:32, lineHeight:1, letterSpacing:'-0.02em', color: urgent?'var(--neg)':'var(--t1)' }}>{value}</span>
        {delta && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:11, fontWeight:600, color: delta>0?'var(--pos)':delta<0?'var(--neg)':'var(--t3)' }}>
            {delta>0 ? <Ico.arrowUp s={10}/> : delta<0 ? <Ico.arrowDown s={10}/> : null}
            {delta>0?`+${delta}`:delta}
          </span>
        )}
      </div>
      {sub && <div className="t-xs c-t3">{sub}</div>}
    </div>
  );
}

// ── Review card — signature moment ──────────────────────────────────────────
function ReviewCard({ review, expanded, onExpand, mode }) {
  const [activeDraft, setActiveDraft] = useStateD('professional');
  const [editing, setEditing] = useStateD(false);
  const [text, setText] = useStateD('');
  const [posted, setPosted] = useStateD(false);

  useEffectD(() => { setText(review.drafts[activeDraft]); }, [activeDraft, review.id]);

  const isNeg = review.rating <= 2;
  const isPos = review.rating >= 4;

  // editorial accent — left rail color
  const railColor = isNeg ? 'var(--neg)' : isPos ? 'var(--pos)' : 'var(--warn)';

  const sentimentPill = isNeg
    ? <span className="pill pill-neg">Negative</span>
    : isPos ? <span className="pill pill-pos">Positive</span>
    : <span className="pill pill-warn">Mixed</span>;

  // Different visual treatment based on tweak mode
  const isQuiet = mode === 'quiet';
  const isUrgent = mode === 'urgent';
  const isEditorial = mode === 'editorial' || !mode;

  return (
    <article style={{
      background: 'var(--surface)',
      borderTop: review.urgent && !isQuiet ? `none` : `1px solid var(--line)`,
      borderLeft: review.urgent && (isUrgent || isEditorial) ? `3px solid ${railColor}` : 'none',
      borderRight: review.urgent && isUrgent ? `1px solid var(--neg-line)` : 'none',
      paddingLeft: review.urgent && (isUrgent || isEditorial) ? 0 : 0,
      backgroundColor: review.urgent && isUrgent ? 'var(--neg-sub)' : 'transparent',
      transition: 'background 0.15s',
    }}>
      {/* Urgent strip */}
      {review.urgent && isUrgent && (
        <div style={{ padding:'6px 24px 0', display:'flex', alignItems:'center', gap:8, fontSize:11, fontWeight:600, color:'var(--neg)', letterSpacing:'0.04em', textTransform:'uppercase' }}>
          <Ico.alert s={11}/> Needs attention · {review.hoursAgo}h old
        </div>
      )}
      <div style={{ padding:'18px 24px 18px', paddingLeft: review.urgent && (isUrgent||isEditorial) ? 24 : 24 }}>
        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'var(--t2)', flexShrink:0 }}>
            {review.author.split(' ').map(n=>n[0]).join('')}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{review.author}</span>
              <Stars rating={review.rating} size={12}/>
              {sentimentPill}
              {review.status === 'replied' && <span className="pill pill-pos"><Ico.check s={9} sw={3}/> Replied</span>}
              {review.urgent && isEditorial && <span className="pill pill-neg">Urgent</span>}
            </div>
            <div className="t-xs c-t3" style={{ marginTop:2 }}>
              {review.hoursAgo < 24 ? `${review.hoursAgo}h ago` : `${Math.floor(review.hoursAgo/24)}d ago`}
              <span style={{ margin:'0 6px', color:'var(--t4)' }}>·</span>
              Google
            </div>
          </div>
          <button onClick={()=>onExpand && onExpand()} className="btn btn-quiet btn-sm">
            {expanded ? 'Collapse' : 'Reply'}
          </button>
        </div>

        {/* Body — serif for negative reviews (editorial moment), sans for everything else */}
        {(isNeg && isEditorial) ? (
          <blockquote style={{
            fontFamily:'var(--serif)', fontSize:18, lineHeight:1.5, color:'var(--t1)',
            fontStyle:'italic', maxWidth:680, marginBottom:14, fontWeight:400,
            letterSpacing:'-0.005em',
          }}>
            "{review.text}"
          </blockquote>
        ) : (
          <p className="t-sm" style={{ color:'var(--t2)', maxWidth:680, marginBottom:14, lineHeight:1.6 }}>
            {review.text}
          </p>
        )}

        {/* Keywords */}
        {review.keywords && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: expanded ? 16 : 0 }}>
            {review.keywords.map(k => (
              <span key={k} className="t-mono t-xs" style={{ color:'var(--t3)', padding:'1px 6px', background:'var(--surface-2)', borderRadius:3 }}>·{k}</span>
            ))}
          </div>
        )}

        {/* Reply composer */}
        {expanded && review.status !== 'replied' && (
          <div className="fade-up" style={{ marginTop:18, padding:18, background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:10 }}>
            <div className="t-eyebrow" style={{ marginBottom:12 }}>Suggested reply</div>
            <div style={{ display:'flex', gap:0, marginBottom:14, background:'var(--surface)', borderRadius:6, padding:3, border:'1px solid var(--line)', alignSelf:'flex-start', width:'fit-content' }}>
              {['professional','warm','brief'].map(t => (
                <button key={t} onClick={()=>{ setActiveDraft(t); setEditing(false); }} style={{
                  padding:'6px 14px', borderRadius:4, fontSize:11, fontWeight:600, textTransform:'capitalize',
                  background: activeDraft===t ? 'var(--t1)' : 'transparent',
                  color: activeDraft===t ? 'var(--bg)' : 'var(--t3)',
                  letterSpacing:'0.02em', transition:'all 0.1s',
                }}>{t}</button>
              ))}
            </div>
            {editing ? (
              <textarea autoFocus value={text} onChange={e=>setText(e.target.value)}
                style={{ width:'100%', background:'var(--surface)', border:'1px solid var(--line-md)', borderRadius:8, padding:14, fontFamily:'var(--ui)', fontSize:13, lineHeight:1.6, color:'var(--t1)', minHeight:120, resize:'vertical', outline:'none' }}/>
            ) : (
              <div onClick={()=>setEditing(true)} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, padding:14, fontSize:13, lineHeight:1.6, color:'var(--t2)', cursor:'text', minHeight:120 }}>
                {text}
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14 }}>
              <div className="t-xs c-t3" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Ico.refresh s={11}/>
                Drafted from your tone of voice settings
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {!editing && <button className="btn btn-quiet btn-sm" onClick={()=>setEditing(true)}>Edit</button>}
                {editing && <button className="btn btn-quiet btn-sm" onClick={()=>{ setEditing(false); setText(review.drafts[activeDraft]); }}>Reset</button>}
                <button className="btn btn-quiet btn-sm">Mark replied</button>
                <button onClick={()=>setPosted(true)} className="btn btn-primary btn-sm">
                  {posted ? <><Ico.check s={11} sw={2.4}/> Queued</> : <>Post to Google <Ico.arrowRight s={11}/></>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ── Intelligence panel ──────────────────────────────────────────────────────
function IntelligencePanel({ scoreStyle }) {
  return (
    <aside style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Score */}
      <div className="card" style={{ padding:24 }}>
        <div className="t-eyebrow" style={{ marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>Replova score</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:3, color:'var(--pos)', fontSize:11 }}><Ico.arrowUp s={10}/>+{SCORE.delta} this week</span>
        </div>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
          <ScoreGauge value={SCORE.total} size={170} mode={scoreStyle || 'arc'}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { l:'Rating',       v:`${SCORE.rating.value}★`,   s:SCORE.rating.score, w:35 },
            { l:'Volume',       v:`${SCORE.volume.value}/mo`, s:SCORE.volume.score, w:20 },
            { l:'Response rate', v:`${Math.round(SCORE.response.value*100)}%`, s:SCORE.response.score, w:25 },
            { l:'Sentiment',    v:`+${(SCORE.sentiment.value*100).toFixed(0)}`, s:SCORE.sentiment.score, w:20 },
          ].map(r => (
            <div key={r.l}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span className="t-xs c-t2">{r.l}</span>
                  <span className="t-mono t-xs c-t4">{r.w}%</span>
                </div>
                <span className="t-xs tnum" style={{ fontWeight:600 }}>{r.v}</span>
              </div>
              <div style={{ height:3, background:'var(--surface-2)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ width:`${r.s}%`, height:'100%', background:'var(--accent)', borderRadius:2 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sentiment trend */}
      <div className="card" style={{ padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div className="t-eyebrow">Sentiment · 12 weeks</div>
          <span style={{ fontSize:11, color:'var(--pos)', fontWeight:600 }}>+0.21</span>
        </div>
        <SentimentStrip data={SENT_SERIES}/>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:10, color:'var(--t4)' }}>
          <span>Feb 1</span><span>Apr 25</span>
        </div>
      </div>

      {/* Keywords */}
      <div className="card" style={{ padding:20 }}>
        <div className="t-eyebrow" style={{ marginBottom:14 }}>What customers mention</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {KEYWORDS.map(k => {
            const c = k.sentiment === 'pos' ? 'var(--pos)' : k.sentiment === 'neg' ? 'var(--neg)' : 'var(--t2)';
            const bg = k.sentiment === 'pos' ? 'var(--pos-sub)' : k.sentiment === 'neg' ? 'var(--neg-sub)' : 'var(--surface-2)';
            const size = 11 + Math.min(k.count/3, 5);
            return (
              <span key={k.word} style={{
                fontSize: size, fontWeight: 500,
                padding:'4px 9px', borderRadius:'var(--r-pill)',
                background: bg, color: c,
                display:'inline-flex', alignItems:'center', gap:5,
              }}>
                {k.word}
                <span style={{ fontSize:10, opacity:0.6, fontFamily:'var(--mono)' }}>{k.count}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Staff shoutouts */}
      <div className="card" style={{ padding:20 }}>
        <div className="t-eyebrow" style={{ marginBottom:14 }}>Mentioned by name</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {STAFF.map(s => (
            <div key={s.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--accent-sub)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                {s.name[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{s.name}</div>
                <div className="t-xs c-t3">{s.role}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="tnum" style={{ fontSize:14, fontWeight:600 }}>{s.mentions}</div>
                <div className="t-xs c-t3">mentions</div>
              </div>
              {s.trend > 0 && <span className="pill pill-pos" style={{ height:18 }}>+{s.trend}</span>}
            </div>
          ))}
        </div>
        <button className="btn btn-quiet btn-sm" style={{ marginTop:14, width:'100%' }}>
          See all staff mentions →
        </button>
      </div>

      {/* Competitors link */}
      <button onClick={()=>window.__nav('/dashboard/competitors')} className="card" style={{ padding:18, textAlign:'left', display:'flex', alignItems:'center', gap:14, transition:'border 0.1s' }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom:4 }}>vs. Competitors</div>
          <div style={{ fontSize:13, color:'var(--t1)' }}>Ranked <strong>#3 of 4</strong> in your set</div>
        </div>
        <span style={{ marginLeft:'auto', color:'var(--t3)' }}><Ico.arrowRight s={14}/></span>
      </button>
    </aside>
  );
}

Object.assign(window, { MiniLine, ScoreGauge, SentimentStrip, StatTile, ReviewCard, IntelligencePanel });
