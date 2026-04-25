
const { useState } = React;

function AuthShell({ children, rightLabel, rightAction }) {
  const nav = p => window.__nav(p);
  return (
    <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',flexDirection:'column'}}>
      <header style={{borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <div style={{maxWidth:1120,margin:'0 auto',padding:'0 28px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <button onClick={() => nav('/')} style={{background:'none',border:'none',fontSize:15,fontWeight:800,letterSpacing:'-0.03em',color:'var(--t1)',cursor:'pointer',fontFamily:'inherit'}}>
            Replova
          </button>
          {rightLabel && (
            <button onClick={() => nav(rightAction)} style={{background:'none',border:'none',fontSize:13,fontWeight:500,color:'var(--t2)',cursor:'pointer',fontFamily:'inherit',padding:'6px 10px',borderRadius:8,transition:'color .15s'}}>
              {rightLabel}
            </button>
          )}
        </div>
      </header>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 24px'}}>
        {children}
      </div>
      <footer style={{borderTop:'1px solid var(--border)',padding:'16px 24px',flexShrink:0}}>
        <p style={{textAlign:'center',fontSize:12,color:'var(--t3)'}}>© {new Date().getFullYear()} Replova · <a href="#" style={{color:'var(--t3)'}}>Terms</a> · <a href="#" style={{color:'var(--t3)'}}>Privacy</a></p>
      </footer>
    </div>
  );
}

function SignInPage() {
  const nav = p => window.__nav(p);
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | sent
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setState('loading');
    setError(null);
    await new Promise(r => setTimeout(r, 1200));
    setState('sent');
  }

  return (
    <AuthShell rightLabel="Start free trial" rightAction="/onboard">
      <div style={{width:'100%',maxWidth:380}} className="fade-up">
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:48,height:48,background:'var(--accent-sub)',border:'1px solid oklch(0.61 0.2 258/.25)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <h1 style={{fontSize:24,fontWeight:800,letterSpacing:'-0.03em',color:'var(--t1)',marginBottom:8}}>Welcome back</h1>
          <p style={{fontSize:14,color:'var(--t2)',lineHeight:1.6}}>Enter your email to sign in to your dashboard.</p>
        </div>

        <div style={{background:'var(--surface-1)',border:'1px solid var(--border-md)',borderRadius:20,padding:28}}>
          {state === 'sent' ? (
            <div className="fade-in" style={{textAlign:'center',padding:'12px 0'}}>
              <div style={{width:48,height:48,background:'var(--ok-sub)',border:'1px solid rgba(34,197,94,.2)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <p style={{fontSize:15,fontWeight:600,color:'var(--t1)',marginBottom:6}}>Check your email</p>
              <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.6}}>We sent a sign-in link to <span style={{color:'var(--t1)',fontWeight:500}}>{email}</span>.</p>
              <button onClick={() => setState('idle')} style={{marginTop:20,background:'none',border:'none',fontSize:13,color:'var(--t3)',cursor:'pointer',fontFamily:'inherit'}}>Use a different email</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label className="label" htmlFor="email">Email address</label>
                <input
                  id="email" type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="input" placeholder="you@example.com" autoFocus
                />
              </div>
              {error && (
                <div style={{background:'var(--err-sub)',border:'1px solid rgba(239,68,68,.2)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'var(--err)'}}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={state==='loading' || !email.trim()}
                className="btn btn-dark btn-lg" style={{borderRadius:12,marginTop:4,width:'100%'}}>
                {state==='loading' ? (
                  <><svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 010 20" opacity=".75"/></svg>Signing in…</>
                ) : 'Sign in with email'}
              </button>
              <p style={{textAlign:'center',fontSize:13,color:'var(--t3)'}}>
                No account?{' '}
                <button type="button" onClick={() => nav('/onboard')} style={{background:'none',border:'none',color:'var(--t2)',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:500}}>
                  Start your free trial →
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </AuthShell>
  );
}

// ─── Onboard ────────────────────────────────────────────────────────────────

function StepBar({ current }) {
  const steps = [
    { id:'search', label:'Find business' },
    { id:'confirm', label:'Confirm' },
    { id:'email', label:'Your email' },
  ];
  const idx = steps.findIndex(s => s.id === current);
  return (
    <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:32}}>
      {steps.map((s, i) => (
        <div key={s.id} style={{display:'flex',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{
              width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:11,fontWeight:700,flexShrink:0,
              background: i < idx ? 'var(--accent)' : i === idx ? 'var(--surface-2)' : 'var(--surface-1)',
              color: i < idx ? '#fff' : i === idx ? 'var(--t1)' : 'var(--t3)',
              border: i < idx ? 'none' : `1px solid ${i===idx ? 'var(--border-md)' : 'var(--border)'}`,
            }}>
              {i < idx ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> : i+1}
            </div>
            <span style={{fontSize:12,fontWeight:500,color: i===idx ? 'var(--t1)' : 'var(--t3)',marginRight:12}}>{s.label}</span>
          </div>
          {i < steps.length-1 && <div style={{width:20,height:1,background: i<idx ? 'var(--accent)' : 'var(--border)',marginRight:12,flexShrink:0}}/>}
        </div>
      ))}
    </div>
  );
}

const MOCK_PLACE = { placeId:'ChIJN1t_t',name:'Bella Napoli',address:'123 Mulberry St, New York, NY 10013' };

function OnboardPage() {
  const nav = p => window.__nav(p);
  const [step, setStep] = useState('search');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(null);
  const [result, setResult] = useState(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    setSearching(true); setSearchErr(null);
    await new Promise(r => setTimeout(r, 1000));
    if (!name.trim() || name.length < 2) {
      setSearchErr(`We couldn't find "${name}" in ${city}. Try a different spelling.`);
      setSearching(false); return;
    }
    setResult(MOCK_PLACE);
    setStep('confirm');
    setSearching(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    setSuccessEmail(email);
    setStep('success');
    setSubmitting(false);
  }

  if (step === 'success') {
    return (
      <AuthShell>
        <div className="fade-up" style={{textAlign:'center',maxWidth:380,width:'100%'}}>
          <div style={{width:56,height:56,background:'var(--ok-sub)',border:'1px solid rgba(34,197,94,.2)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 style={{fontSize:24,fontWeight:800,letterSpacing:'-0.03em',color:'var(--t1)',marginBottom:10}}>You're all set</h1>
          <p style={{fontSize:14,color:'var(--t2)',lineHeight:1.7,marginBottom:28}}>
            We sent a sign-in link to <span style={{color:'var(--t1)',fontWeight:600}}>{successEmail}</span>. Click it to access your dashboard and start managing reviews.
          </p>
          <button onClick={() => nav('/dashboard')} className="btn btn-primary btn-lg" style={{borderRadius:12}}>
            Go to dashboard →
          </button>
          <p style={{marginTop:16,fontSize:12,color:'var(--t3)'}}>Reviews sync automatically every Monday</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell rightLabel="Sign in" rightAction="/signin">
      <div style={{width:'100%',maxWidth:440}} className="fade-up">
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:26,fontWeight:800,letterSpacing:'-0.03em',color:'var(--t1)',marginBottom:6}}>
            {step==='search' && 'Start your free trial'}
            {step==='confirm' && 'Is this your business?'}
            {step==='email' && 'Where should we send replies?'}
          </h1>
          <p style={{fontSize:14,color:'var(--t2)',lineHeight:1.6}}>
            {step==='search' && '30 days free. No credit card required.'}
            {step==='confirm' && "Verify we found the right listing before continuing."}
            {step==='email' && "We'll email you AI-suggested replies whenever new reviews come in."}
          </p>
        </div>

        <StepBar current={step} />

        <div style={{background:'var(--surface-1)',border:'1px solid var(--border-md)',borderRadius:20,padding:28}}>
          {step === 'search' && (
            <form onSubmit={handleSearch} style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label className="label" htmlFor="bname">Business name</label>
                <input id="bname" type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="input" placeholder="Bella Napoli" autoFocus />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label className="label" htmlFor="city">City</label>
                <input id="city" type="text" required value={city} onChange={e => setCity(e.target.value)}
                  className="input" placeholder="New York" />
              </div>
              {searchErr && (
                <div style={{background:'var(--err-sub)',border:'1px solid rgba(239,68,68,.2)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'var(--err)'}}>
                  {searchErr}
                </div>
              )}
              <button type="submit" disabled={searching || !name.trim() || !city.trim()}
                className="btn btn-dark btn-lg" style={{borderRadius:12,width:'100%',marginTop:4}}>
                {searching ? <><svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 010 20" opacity=".75"/></svg>Searching…</> : 'Find my business'}
              </button>
            </form>
          )}

          {step === 'confirm' && result && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{background:'var(--surface-0)',border:'1px solid var(--border-md)',borderRadius:14,padding:20,display:'flex',alignItems:'flex-start',gap:14}}>
                <div style={{width:40,height:40,background:'var(--surface-2)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                </div>
                <div>
                  <p style={{fontSize:14,fontWeight:700,color:'var(--t1)',marginBottom:4}}>{result.name}</p>
                  <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.5}}>{result.address}</p>
                </div>
              </div>
              <button onClick={() => setStep('email')} className="btn btn-dark btn-lg" style={{borderRadius:12,width:'100%'}}>
                Yes, this is my business
              </button>
              <button type="button" onClick={() => { setStep('search'); setResult(null); setSearchErr(null); }}
                style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontFamily:'inherit',fontSize:13,textAlign:'center',padding:'4px'}}>
                That's not it — search again
              </button>
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
              {result && (
                <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--surface-0)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                  <span style={{fontSize:12,color:'var(--t2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{result.name}</span>
                </div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label className="label" htmlFor="emailob">Email address</label>
                <input id="emailob" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="input" placeholder="you@restaurant.com" autoFocus />
                <p style={{fontSize:12,color:'var(--t3)'}}>Suggested replies will be emailed here when new reviews arrive.</p>
              </div>
              <button type="submit" disabled={submitting || !email.trim()}
                className="btn btn-dark btn-lg" style={{borderRadius:12,width:'100%',marginTop:4}}>
                {submitting ? <><svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 010 20" opacity=".75"/></svg>Setting up…</> : 'Start free trial'}
              </button>
              <button type="button" onClick={() => setStep('confirm')}
                style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontFamily:'inherit',fontSize:13,textAlign:'center',padding:'4px'}}>
                ← Back
              </button>
            </form>
          )}
        </div>

        <p style={{textAlign:'center',fontSize:12,color:'var(--t3)',marginTop:16}}>
          No credit card required · Cancel anytime
        </p>
      </div>
    </AuthShell>
  );
}

Object.assign(window, { SignInPage, OnboardPage });
