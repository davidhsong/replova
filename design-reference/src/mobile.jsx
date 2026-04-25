// ── Mobile screens (3 phone frames) ─────────────────────────────────────────
function PhoneStatus({ dark=false }) {
  return (
    <div style={{ height:34, paddingTop:8, padding:'8px 22px 0', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, fontWeight:600, color: dark?'#fff':'var(--t1)' }}>
      <span className="tnum">9:41</span>
      <span style={{ display:'flex', gap:5, alignItems:'center' }}>
        <span>●●●●</span>
        <span style={{ width:14, height:8, border:'1px solid currentColor', borderRadius:2 }}/>
      </span>
    </div>
  );
}

function MobileReviews() {
  return (
    <>
      <PhoneStatus/>
      <div style={{ padding:'10px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <Logo size={16}/>
          <button style={{ width:32, height:32, borderRadius:8, background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center' }}><Ico.bell s={14}/></button>
        </div>
        <div className="t-eyebrow" style={{ marginBottom:4 }}>Bella Napoli</div>
        <h1 className="t-h1" style={{ fontSize:22, marginBottom:12 }}>Reviews</h1>

        {/* Score row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          <div style={{ padding:'10px 12px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8 }}>
            <div className="t-eyebrow">Score</div>
            <div className="t-serif tnum" style={{ fontSize:24, lineHeight:1.1 }}>78 <span style={{ fontSize:11, color:'var(--pos)' }}>+4</span></div>
          </div>
          <div style={{ padding:'10px 12px', background:'var(--neg-sub)', border:'1px solid var(--neg-line)', borderRadius:8 }}>
            <div className="t-eyebrow" style={{ color:'var(--neg)' }}>To reply</div>
            <div className="t-serif tnum" style={{ fontSize:24, lineHeight:1.1, color:'var(--neg)' }}>3</div>
          </div>
        </div>
      </div>

      {/* Review list */}
      <div style={{ borderTop:'1px solid var(--line)' }}>
        {REVIEWS.slice(0,4).map((r,i) => (
          <div key={r.id} style={{
            padding:'14px 16px', borderBottom:'1px solid var(--line)',
            borderLeft: r.urgent ? '3px solid var(--neg)' : '3px solid transparent',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{r.author}</span>
              <Stars rating={r.rating} size={10}/>
              {r.urgent && <span className="pill pill-neg" style={{ height:16, fontSize:9 }}>Urgent</span>}
            </div>
            <p className="t-xs c-t2" style={{ lineHeight:1.5, marginBottom:6, fontFamily: r.rating <= 2 ? 'var(--serif)' : 'var(--ui)', fontSize: r.rating <= 2 ? 13 : 12, fontStyle: r.rating <= 2 ? 'italic' : 'normal', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
              {r.rating <= 2 && '"'}{r.text}{r.rating <= 2 && '"'}
            </p>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span className="t-xs c-t4">{r.hoursAgo<24?`${r.hoursAgo}h`:`${Math.floor(r.hoursAgo/24)}d`}</span>
              {r.status === 'unreplied' ? (
                <button className="btn btn-primary btn-sm" style={{ height:24, padding:'0 10px', fontSize:11 }}>Reply</button>
              ) : (
                <span className="pill pill-pos" style={{ height:16, fontSize:9 }}>Replied</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ position:'sticky', bottom:0, display:'flex', borderTop:'1px solid var(--line)', background:'var(--surface)', padding:'10px 0', justifyContent:'space-around' }}>
        {[
          { i:Ico.message, l:'Reviews', a:true },
          { i:Ico.gauge, l:'Score' },
          { i:Ico.users, l:'Compete' },
          { i:Ico.cog, l:'Settings' },
        ].map((t,i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, color: t.a?'var(--accent)':'var(--t3)' }}>
            <t.i s={18}/>
            <span style={{ fontSize:9, fontWeight:600 }}>{t.l}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function MobileReplyComposer() {
  const r = REVIEWS[0];
  return (
    <>
      <PhoneStatus/>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10 }}>
        <button className="btn btn-quiet btn-sm" style={{ padding:'0 6px' }}>←</button>
        <div style={{ flex:1, fontSize:13, fontWeight:600 }}>Reply to James K.</div>
      </div>
      <div style={{ padding:16, borderBottom:'1px solid var(--line)', borderLeft:'3px solid var(--neg)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <Stars rating={2} size={11}/>
          <span className="pill pill-neg" style={{ height:16, fontSize:9 }}>Urgent · 3h</span>
        </div>
        <p className="t-serif t-italic" style={{ fontSize:14, lineHeight:1.5, color:'var(--t1)' }}>
          "Service was slow and my pasta came out cold. We waited 45 minutes."
        </p>
      </div>
      <div style={{ padding:16 }}>
        <div className="t-eyebrow" style={{ marginBottom:10 }}>Pick a tone</div>
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          {[
            { l:'Professional', on:true },
            { l:'Warm' },
            { l:'Brief' },
          ].map(t => (
            <span key={t.l} style={{ fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:'var(--r-pill)', background: t.on?'var(--t1)':'transparent', color: t.on?'var(--bg)':'var(--t3)', border: t.on?'none':'1px solid var(--line-md)' }}>{t.l}</span>
          ))}
        </div>
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:8, padding:12, fontSize:12, lineHeight:1.55, color:'var(--t2)', minHeight:140 }}>
          {r.drafts.professional}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }}>Edit</button>
          <button className="btn btn-primary btn-sm" style={{ flex:2 }}>Post to Google →</button>
        </div>
      </div>
    </>
  );
}

function MobileScore() {
  return (
    <>
      <PhoneStatus/>
      <div style={{ padding:'10px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <button className="btn btn-quiet btn-sm" style={{ padding:'0 6px' }}>←</button>
          <span className="t-eyebrow">Replova score</span>
          <span style={{ width:24 }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 24px' }}>
          <ScoreGauge value={78} size={180}/>
        </div>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <span className="pill pill-pos">▲ Up 4 this week</span>
        </div>
      </div>
      <div style={{ padding:'0 16px 24px' }}>
        <div className="t-eyebrow" style={{ marginBottom:10 }}>Components</div>
        {[
          { l:'Rating',     v:'4.3★',  s:86, w:'35%' },
          { l:'Volume',     v:'142/mo',s:70, w:'20%' },
          { l:'Response rate', v:'91%',s:91, w:'25%' },
          { l:'Sentiment',  v:'+62',   s:62, w:'20%' },
        ].map((r,i) => (
          <div key={r.l} style={{ padding:'12px 0', borderTop: i>0?'1px solid var(--line)':'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{r.l} <span className="t-mono c-t4" style={{ fontSize:10 }}>{r.w}</span></span>
              <span className="tnum" style={{ fontSize:13, fontWeight:600 }}>{r.v}</span>
            </div>
            <div style={{ height:4, background:'var(--surface-2)', borderRadius:2 }}>
              <div style={{ width:`${r.s}%`, height:'100%', background:'var(--accent)', borderRadius:2 }}/>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MobilePage() {
  return (
    <div className="app">
      <Sidebar active=""/>
      <div className="main">
        <TopBar><span style={{ color:'var(--t1)', fontWeight:600 }}>Mobile</span></TopBar>
        <div className="page-header">
          <Note>{`/* Mobile: owner-operators check from the floor.\n   Same visual language — hairlines, serif for negative excerpts, no shadows.\n   Tab bar replaces sidebar. Reply composer is a full screen, not a sheet.\n*/`}</Note>
          <PageHeader title="Mobile" subtitle="iPhone — three key screens"/>
        </div>
        <div className="page-body">
          <div style={{ display:'flex', gap:32, justifyContent:'center', flexWrap:'wrap' }}>
            {[
              { c:<MobileReviews/>, l:'Review feed' },
              { c:<MobileReplyComposer/>, l:'Reply composer' },
              { c:<MobileScore/>, l:'Score breakdown' },
            ].map((p,i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
                <div className="phone">
                  <div className="phone-notch"/>
                  <div className="phone-screen">{p.c}</div>
                </div>
                <div className="t-eyebrow">{p.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MobilePage });
