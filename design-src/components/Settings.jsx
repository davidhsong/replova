
const { useState, useEffect, useRef } = React;

function SectionCard({ title, description, children, delay=0 }) {
  return (
    <div className="fade-up card" style={{padding:24,marginBottom:12,animationDelay:`${delay}ms`}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:14,fontWeight:700,color:'var(--t1)',marginBottom:description?4:0}}>{title}</h2>
        {description && <p style={{fontSize:13,color:'var(--t3)',lineHeight:1.6}}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingsPage() {
  const [displayName, setDisplayName] = useState('Maria Rossi');
  const [phone, setPhone] = useState('+1 (555) 012-3456');
  const [email] = useState('maria@bellanapoli.com');
  const [avatarUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const [gStatus, setGStatus] = useState('connected'); // connected | not_connected | token_only
  const [gNotice, setGNotice] = useState(null);
  const [gNoticeType, setGNoticeType] = useState('success');

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const fileRef = useRef(null);

  const initials = (displayName||email).split(/[\s@]/).filter(Boolean).map(n=>n[0]).slice(0,2).join('').toUpperCase()||'?';

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaveErr(null); setSaved(false);
    await new Promise(r=>setTimeout(r,900));
    setSaved(true); setSaving(false);
    setTimeout(()=>setSaved(false),3000);
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    await new Promise(r=>setTimeout(r,1400));
    setSyncResult('Synced — 2 new reviews, 6 drafts generated, 1 auto-marked replied.');
    setSyncing(false);
  }

  function handleDisconnect() {
    setGStatus('not_connected');
    setGNotice('Google Business disconnected.');
    setGNoticeType('error');
  }

  function handleConnect() {
    setGStatus('connected');
    setGNotice('Google Business connected successfully.');
    setGNoticeType('success');
  }

  return (
    <div className="app-shell">
      <Sidebar active="/dashboard/settings" />
      <main className="main">
        <div className="sec-head">
          <h1 style={{fontSize:18,fontWeight:800,letterSpacing:'-0.025em',color:'var(--t1)',marginBottom:2}}>Settings</h1>
          <p style={{fontSize:13,color:'var(--t3)'}}>Manage your profile and account</p>
        </div>

        <div className="page-wrap">

          {/* Profile picture */}
          <SectionCard title="Profile picture" delay={0}>
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <button type="button" onClick={()=>fileRef.current?.click()}
                style={{position:'relative',background:'none',border:'none',cursor:'pointer',flexShrink:0,borderRadius:'50%',padding:0}}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{width:60,height:60,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border-md)'}}/>
                ) : (
                  <div style={{width:60,height:60,borderRadius:'50%',background:'var(--accent-sub)',border:'2px solid oklch(0.61 0.2 258/.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'var(--accent)'}}>
                    {initials}
                  </div>
                )}
                <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(0,0,0,0.55)',opacity:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'#fff',transition:'opacity .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=1}
                  onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                  Edit
                </div>
              </button>
              <div>
                <button type="button" onClick={()=>fileRef.current?.click()}
                  style={{background:'none',border:'none',fontSize:13,fontWeight:600,color:'var(--t1)',cursor:'pointer',fontFamily:'inherit',padding:'0 0 4px',display:'block'}}>
                  Change photo
                </button>
                <p style={{fontSize:12,color:'var(--t3)'}}>JPG, PNG or GIF · Max 2 MB</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}/>
            </div>
          </SectionCard>

          {/* Sync reviews */}
          <SectionCard title="Sync reviews" description="Manually fetch the latest reviews from Google and generate new reply drafts. Runs automatically every Monday." delay={40}>
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <button onClick={handleSync} disabled={syncing} className="btn btn-ghost btn-sm" style={{borderRadius:10}}>
                {syncing ? (
                  <><svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 010 20" opacity=".75"/></svg>Syncing…</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>Sync now</>
                )}
              </button>
              {syncResult && (
                <p style={{fontSize:12,color:'var(--ok)',fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  {syncResult}
                </p>
              )}
            </div>
          </SectionCard>

          {/* Google Business */}
          <SectionCard title="Google Business" description="Connect your Google Business account to enable review syncing." delay={80}>
            {gNotice && (
              <div className={`banner ${gNoticeType==='success'?'banner-green':'banner-red'}`} style={{marginBottom:16}}>
                {gNotice}
              </div>
            )}
            {gStatus === 'connected' && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className="dot dot-green pulse-d"></span>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:'var(--t1)',marginBottom:1}}>Connected</p>
                    <p style={{fontSize:12,color:'var(--t3)'}}>Bella Napoli · Google Business Profile</p>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={handleDisconnect} className="btn btn-sm btn-danger" style={{borderRadius:9}}>Disconnect</button>
                  <button onClick={handleConnect} className="btn btn-sm btn-ghost" style={{borderRadius:9}}>Reconnect</button>
                </div>
              </div>
            )}
            {gStatus === 'not_connected' && (
              <div>
                <p style={{fontSize:13,color:'var(--t2)',marginBottom:16,lineHeight:1.6}}>
                  Link your Google Business profile to start syncing reviews and generating AI reply drafts.
                </p>
                <button onClick={handleConnect} className="btn btn-ghost" style={{borderRadius:10,padding:'9px 16px'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Connect Google Business
                </button>
              </div>
            )}
          </SectionCard>

          {/* Personal info */}
          <SectionCard title="Personal information" delay={120}>
            <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label className="label">Email address</label>
                <div className="input" style={{color:'var(--t3)',userSelect:'none',cursor:'default'}}>{email}</div>
                <p style={{fontSize:12,color:'var(--t3)'}}>Your email address cannot be changed.</p>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label className="label" htmlFor="dname">Display name</label>
                <input id="dname" type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} className="input" placeholder="Your name"/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label className="label" htmlFor="phone">Phone number</label>
                <input id="phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="input" placeholder="+1 (555) 000-0000"/>
              </div>
              {saveErr && (
                <div style={{background:'var(--err-sub)',border:'1px solid rgba(239,68,68,.2)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'var(--err)'}}>{saveErr}</div>
              )}
              <div style={{display:'flex',alignItems:'center',gap:12,paddingTop:4}}>
                <button type="submit" disabled={saving} className="btn btn-ghost" style={{borderRadius:10,padding:'9px 18px'}}>
                  {saving?<><svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 010 20" opacity=".75"/></svg>Saving…</>:'Save changes'}
                </button>
                {saved && (
                  <span style={{fontSize:13,color:'var(--ok)',fontWeight:500,display:'flex',alignItems:'center',gap:5}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Saved
                  </span>
                )}
              </div>
            </form>
          </SectionCard>

          {/* Danger zone */}
          <SectionCard title="Danger zone" delay={160}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
              <div>
                <p style={{fontSize:13,fontWeight:500,color:'var(--t1)',marginBottom:2}}>Delete account</p>
                <p style={{fontSize:12,color:'var(--t3)'}}>Permanently delete your account and all associated data. This cannot be undone.</p>
              </div>
              <button className="btn btn-danger btn-sm" style={{borderRadius:9,flexShrink:0}}>Delete account</button>
            </div>
          </SectionCard>

        </div>
      </main>
    </div>
  );
}

Object.assign(window, { SettingsPage });
