// ── Review requests ─────────────────────────────────────────────────────────
/* DECISION: Page is two-column — upload/send on the left, history on the right.
   Stats strip leads with funnel-shaped numbers. Drag-and-drop zone is one of
   only two soft-rounded surfaces on the page; everything else is hairline. */

const { useState: useStateR } = React;

function RequestsPage() {
  const [dragOver, setDragOver] = useStateR(false);
  const [channel, setChannel] = useStateR('email');
  const [imported, setImported] = useStateR(false);

  const sent = REQUESTS.filter(r => r.status !== 'pending').length;
  const opened = REQUESTS.filter(r => r.status === 'opened' || r.status === 'clicked').length;
  const clicked = REQUESTS.filter(r => r.status === 'clicked').length;
  const pending = REQUESTS.filter(r => r.status === 'pending').length;

  const statusColor = {
    pending: { bg:'var(--surface-2)', c:'var(--t3)' },
    sent:    { bg:'var(--surface-2)', c:'var(--t2)' },
    opened:  { bg:'var(--warn-sub)', c:'var(--warn)' },
    clicked: { bg:'var(--pos-sub)', c:'var(--pos)' },
  };

  return (
    <div className="app">
      <Sidebar active="/dashboard/review-requests"/>
      <div className="main">
        <TopBar>
          <span style={{ color:'var(--t2)' }}>Workspace</span>
          <Ico.chevRight s={10}/>
          <span style={{ color:'var(--t1)', fontWeight:600 }}>Review requests</span>
        </TopBar>

        <div className="page-header">
          <Note>{`/* Layout decision: funnel-shaped stat strip (sent → opened → clicked).\n   Upload zone on the left, history on the right.\n*/`}</Note>
          <PageHeader title="Review requests" subtitle="Send a personal nudge to people who already loved their meal."/>
        </div>

        <div className="page-body">
          {/* Funnel stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:0, border:'1px solid var(--line)', borderRadius:'var(--r-7)', overflow:'hidden', marginBottom:32, background:'var(--surface)' }}>
            {[
              { l:'Sent',     v:sent,     sub:`${REQUESTS.length} contacts` , w:1.0 },
              { l:'Opened',   v:opened,   sub:`${Math.round(opened/sent*100)}% open rate` , w:0.66, color:'var(--warn)' },
              { l:'Clicked',  v:clicked,  sub:`${Math.round(clicked/sent*100)}% click rate` , w:0.4, color:'var(--pos)' },
              { l:'Pending',  v:pending,  sub:'queued for next batch', w:0.16, color:'var(--t3)' },
            ].map((s, i) => (
              <div key={s.l} style={{
                padding:'18px 22px',
                borderRight: i<3 ? '1px solid var(--line)' : 'none',
                position:'relative',
              }}>
                <div className="t-eyebrow" style={{ marginBottom:6, color: s.color || 'var(--t3)' }}>{s.l}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span className="t-serif tnum" style={{ fontSize:32, lineHeight:1, color: s.color || 'var(--t1)' }}>{s.v}</span>
                </div>
                <div className="t-xs c-t3" style={{ marginTop:6 }}>{s.sub}</div>
                {/* Funnel bar */}
                <div style={{ position:'absolute', bottom:0, left:0, height:3, width:`${s.w*100}%`, background: s.color || 'var(--t1)', opacity:0.7 }}/>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:24, alignItems:'flex-start' }}>
            {/* Left: upload */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {/* Channel */}
              <div className="card" style={{ padding:18 }}>
                <div className="t-eyebrow" style={{ marginBottom:10 }}>Channel</div>
                <div className="seg" style={{ width:'100%' }}>
                  {['email','sms'].map(c => (
                    <button key={c} className={channel===c?'on':''} onClick={()=>setChannel(c)} style={{ flex:1 }}>
                      {c === 'email' ? '✉ Email' : '✆ SMS'}
                    </button>
                  ))}
                </div>
                {channel === 'sms' && (
                  <div className="t-xs c-warn" style={{ marginTop:10 }}>SMS uses Twilio; $0.02 per message billed to your account.</div>
                )}
              </div>

              {/* CSV upload */}
              <div className="card" style={{ padding:20 }}>
                <div className="t-eyebrow" style={{ marginBottom:10 }}>Bulk upload</div>
                <p className="t-xs c-t3" style={{ marginBottom:14, lineHeight:1.55 }}>
                  CSV with headers: <span className="t-mono c-t1">name, email, phone</span> (phone optional).
                </p>
                <div
                  onDragOver={e=>{e.preventDefault(); setDragOver(true);}}
                  onDragLeave={()=>setDragOver(false)}
                  onDrop={e=>{e.preventDefault(); setDragOver(false); setImported(true);}}
                  onClick={()=>setImported(true)}
                  style={{
                    border:'1.5px dashed', borderColor: dragOver ? 'var(--accent)' : 'var(--line-md)',
                    background: dragOver ? 'var(--accent-sub)' : 'var(--surface-2)',
                    borderRadius:10, padding:24, textAlign:'center', cursor:'pointer',
                    transition:'all 0.15s',
                  }}>
                  <div style={{ display:'inline-flex', width:40, height:40, borderRadius:10, background:'var(--surface)', border:'1px solid var(--line)', alignItems:'center', justifyContent:'center', marginBottom:10, color:'var(--t2)' }}>
                    <Ico.upload s={18}/>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Drop CSV here</div>
                  <div className="t-xs c-t3">or click to browse</div>
                </div>
                {imported && (
                  <div className="fade-up" style={{ marginTop:14 }}>
                    <Banner kind="pos" title="Imported 24 customers" body="2 skipped — duplicate emails. Ready to send."/>
                  </div>
                )}
                <button disabled={!imported} className="btn btn-primary" style={{ width:'100%', marginTop:14 }}>
                  <Ico.send s={12}/> Send all (24)
                </button>
              </div>

              {/* Single send */}
              <div className="card" style={{ padding:20 }}>
                <div className="t-eyebrow" style={{ marginBottom:10 }}>Or send one</div>
                <input className="field" placeholder="Customer name" style={{ marginBottom:10 }}/>
                <input className="field" placeholder="Email" style={{ marginBottom:10 }}/>
                {channel === 'sms' && <input className="field" placeholder="Phone" style={{ marginBottom:10 }}/>}
                <button className="btn btn-ghost btn-sm" style={{ width:'100%' }}>Send request</button>
              </div>
            </div>

            {/* Right: history */}
            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>Recent requests</div>
                <select className="field" style={{ height:28, padding:'0 24px 0 10px', fontSize:11, width:'auto' }}>
                  <option>All status</option>
                  <option>Pending</option>
                  <option>Sent</option>
                  <option>Opened</option>
                  <option>Clicked</option>
                </select>
              </div>
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th style={{ width:120 }}>Status</th>
                    <th style={{ width:90, textAlign:'right' }}>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {REQUESTS.map(r => {
                    const sc = statusColor[r.status];
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight:600 }}>{r.name}</td>
                        <td className="t-mono t-xs c-t2">{r.email}</td>
                        <td>
                          <span className="pill" style={{ background: sc.bg, color: sc.c, borderColor:'transparent', textTransform:'capitalize' }}>
                            <span className="dot" style={{ background: sc.c, opacity:0.7 }}/>
                            {r.status}
                          </span>
                        </td>
                        <td className="tnum t-xs c-t3" style={{ textAlign:'right' }}>{r.sent}</td>
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

Object.assign(window, { RequestsPage });
