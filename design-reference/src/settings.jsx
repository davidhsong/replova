// ── Settings page ───────────────────────────────────────────────────────────
/* DECISION: Settings is a long single-column form, not nested tabs.
   Section headers act as anchors. Locked features show a quiet, dignified
   "Agency only" treatment instead of disabled-button gray. */

const { useState: useStateS } = React;

function SectionHeader({ kicker, title, sub, action }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, marginBottom:18, paddingBottom:14, borderBottom:'1px solid var(--line)' }}>
      <div>
        {kicker && <div className="t-eyebrow" style={{ marginBottom:6 }}>{kicker}</div>}
        <h2 className="t-h2" style={{ fontSize:18, marginBottom: sub?2:0 }}>{title}</h2>
        {sub && <div className="t-xs c-t3">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function Row({ label, hint, children, locked }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:32, padding:'18px 0', borderBottom:'1px solid var(--line)' }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color: locked?'var(--t3)':'var(--t1)', display:'flex', alignItems:'center', gap:6 }}>
          {locked && <Ico.lock s={12}/>}
          {label}
        </div>
        {hint && <div className="t-xs c-t3" style={{ marginTop:4, lineHeight:1.5, maxWidth:200 }}>{hint}</div>}
      </div>
      <div style={{ minWidth:0 }}>{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button onClick={()=>!disabled && onChange(!on)} disabled={disabled} style={{
      width:36, height:20, borderRadius:'var(--r-pill)',
      background: on ? 'var(--accent)' : 'var(--surface-3)',
      position:'relative', flexShrink:0, transition:'background 0.15s',
      opacity: disabled?0.5:1, cursor: disabled?'not-allowed':'pointer',
    }}>
      <div style={{
        position:'absolute', top:2, left: on ? 18 : 2,
        width:16, height:16, borderRadius:'50%', background:'#fff',
        boxShadow:'0 1px 2px rgba(0,0,0,0.2)', transition:'left 0.15s',
      }}/>
    </button>
  );
}

function LockedNotice({ children, plan='Agency' }) {
  return (
    <div style={{ position:'relative', padding:14, background:'var(--surface-2)', border:'1px dashed var(--line-md)', borderRadius:8 }}>
      <div style={{ opacity:0.45, pointerEvents:'none' }}>{children}</div>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
        <span className="pill pill-accent" style={{ height:22 }}>
          <Ico.lock s={10}/> {plan} plan
        </span>
        <button onClick={()=>window.__nav('/dashboard/billing')} style={{ fontSize:12, fontWeight:600, color:'var(--t1)', textDecoration:'underline' }}>
          Upgrade →
        </button>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [autoReply, setAutoReply] = useStateS(true);
  const [delay, setDelay] = useStateS(4);
  const [alerts, setAlerts] = useStateS(true);
  const [threshold, setThreshold] = useStateS(2);
  const [persona, setPersona] = useStateS('Warm and confident, lightly formal. We are family-owned, second generation. Marco is the GM.');
  const [confirmDelete, setConfirmDelete] = useStateS(0);

  return (
    <div className="app">
      <Sidebar active="/dashboard/settings"/>
      <div className="main">
        <TopBar>
          <span style={{ color:'var(--t2)' }}>Workspace</span>
          <Ico.chevRight s={10}/>
          <span style={{ color:'var(--t1)', fontWeight:600 }}>Settings</span>
        </TopBar>
        <div className="page-header" style={{ maxWidth:880 }}>
          <Note>{`/* Layout decision: long single-column form. No nested tabs.\n   Locked features show a quiet "Agency only" badge — no disabled gray button.\n*/`}</Note>
          <PageHeader title="Settings" subtitle="Bella Napoli · Growth plan"/>
        </div>

        <div className="page-body" style={{ maxWidth:880 }}>
          {/* Sync */}
          <section style={{ marginBottom:48 }}>
            <SectionHeader kicker="Sync" title="Reviews" sub="Replova auto-syncs every 6 hours. Sync now if you can't wait."
              action={<button className="btn btn-ghost btn-sm"><Ico.refresh s={12}/> Sync now</button>}/>
            <div className="t-xs c-t3" style={{ display:'flex', gap:18, padding:'4px 0' }}>
              <span>Last sync: <strong className="c-t1">4 min ago</strong></span>
              <span className="c-t4">·</span>
              <span>Next: <strong className="c-t1">~5h 56m</strong></span>
              <span className="c-t4">·</span>
              <span>Last result: <strong className="c-pos">3 new · 3 drafts</strong></span>
            </div>
          </section>

          {/* GMB */}
          <section style={{ marginBottom:48 }}>
            <SectionHeader kicker="Integration" title="Google Business"/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#4285f4" d="M43.6 20.5H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.5 29 4.5 24 4.5a19.5 19.5 0 1 0 0 39c10.7 0 19.5-7.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                    Bella Napoli · 123 Mulberry St
                    <span className="dot dot-pos dot-pulse"/>
                    <span className="t-xs c-pos">Connected</span>
                  </div>
                  <div className="t-xs c-t3">Connected Apr 2 · scope: read reviews, post replies</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm">Reconnect</button>
            </div>
          </section>

          {/* Reply settings */}
          <section style={{ marginBottom:48 }}>
            <SectionHeader kicker="AI" title="Reply settings"/>
            <Row label="Auto-reply to reviews" hint="Skip the queue for 4★ and 5★ when sentiment is positive.">
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <Toggle on={autoReply} onChange={setAutoReply}/>
                <span className="t-sm c-t2">{autoReply ? 'On — positive reviews send automatically' : 'Off — every reply needs your tap'}</span>
              </div>
            </Row>
            <Row label="Delay before sending" hint="Helps avoid the bot-replied-instantly look.">
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <input type="range" min="1" max="24" value={delay} onChange={e=>setDelay(+e.target.value)} style={{ flex:1, maxWidth:280, accentColor:'var(--accent)' }}/>
                <span className="t-mono tnum" style={{ fontSize:13, minWidth:60 }}>{delay} hour{delay>1?'s':''}</span>
              </div>
            </Row>
            <Row label="Reply voice / persona" hint="Shapes every draft we generate." locked>
              <LockedNotice>
                <textarea className="field" rows="3" value={persona} readOnly style={{ background:'var(--surface)' }}/>
              </LockedNotice>
            </Row>
            <Row label="Alert me on low ratings" hint="We email you the moment a low-star arrives.">
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <Toggle on={alerts} onChange={setAlerts}/>
                <span className="t-sm c-t2">{alerts ? 'On' : 'Off'}</span>
              </div>
            </Row>
            <Row label="Alert threshold" hint="At or below this rating triggers an alert.">
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={()=>setThreshold(i)} style={{
                    width:28, height:28, fontSize:14, color: i<=threshold ? 'var(--gold)' : 'var(--line-hi)',
                  }}>★</button>
                ))}
                <span className="t-xs c-t3" style={{ marginLeft:8 }}>≤ {threshold} stars</span>
              </div>
            </Row>
            <div style={{ marginTop:18, display:'flex', justifyContent:'flex-end' }}>
              <button className="btn btn-primary btn-sm">Save settings</button>
            </div>
          </section>

          {/* Branding */}
          <section style={{ marginBottom:48 }}>
            <SectionHeader kicker="Reports" title="Report branding"/>
            <Row label="Logo URL" hint="Used on white-labeled monthly PDF reports." locked>
              <LockedNotice>
                <input className="field" placeholder="https://example.com/logo.svg"/>
              </LockedNotice>
            </Row>
          </section>

          {/* Account */}
          <section style={{ marginBottom:48 }}>
            <SectionHeader kicker="Account" title="You"/>
            <Row label="Email" hint="Magic-link sign-in only.">
              <input className="field" value="maria@bellanapoli.com" readOnly style={{ background:'var(--surface-2)', cursor:'not-allowed' }}/>
            </Row>
            <Row label="Sign out">
              <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('/signin')}><Ico.signout s={12}/> Sign out</button>
            </Row>
          </section>

          {/* Danger */}
          <section>
            <SectionHeader kicker="Danger zone" title="Delete account"
              sub="Permanently deletes your restaurant, reviews, replies, and billing. Cannot be undone."/>
            {confirmDelete === 0 && <button onClick={()=>setConfirmDelete(1)} className="btn btn-danger btn-sm"><Ico.trash s={12}/> Delete account</button>}
            {confirmDelete === 1 && (
              <div className="fade-in" style={{ padding:18, background:'var(--neg-sub)', border:'1px solid var(--neg-line)', borderRadius:8 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--neg)', marginBottom:6 }}>This cannot be undone.</div>
                <p className="t-xs c-t2" style={{ marginBottom:14, maxWidth:520 }}>We'll cancel your subscription, delete your restaurant record and all 142 reviews. You'll be signed out immediately.</p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>setConfirmDelete(0)} className="btn btn-ghost btn-sm">Keep account</button>
                  <button onClick={()=>setConfirmDelete(2)} className="btn btn-danger btn-sm">Yes, delete everything</button>
                </div>
              </div>
            )}
            {confirmDelete === 2 && (
              <div className="fade-in" style={{ padding:18, background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:8, fontSize:12, color:'var(--t3)' }}>
                Account deletion queued. You'll be signed out in 5 seconds.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsPage });
