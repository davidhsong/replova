// ── Auth + onboarding ────────────────────────────────────────────────────────
const { useState: useStateAuth, useEffect: useEffectAuth } = React;

function SignInPage() {
  const nav = (p) => window.__nav(p);
  const [email, setEmail] = useStateAuth('');
  const [state, setState] = useStateAuth('idle'); // idle | sending | sent | error
  const [error, setError] = useStateAuth('');

  function submit(e) {
    e.preventDefault();
    setState('sending');
    setTimeout(() => {
      if (!email) { setState('error'); setError('Enter the email on your account.'); return; }
      if (email.includes('unknown') || email === 'a@a.com') {
        setState('error'); setError("No account found for this email. Want to start a trial?");
        return;
      }
      setState('sent');
    }, 700);
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <MarketingNav />
      <main style={{ flex:1, display:'grid', gridTemplateColumns:'1.05fr 1fr', maxWidth:1140, width:'100%', margin:'0 auto', padding:'48px 32px', gap:80, alignItems:'center' }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom:20 }}>Sign in</div>
          <h1 className="t-serif" style={{ fontSize:54, lineHeight:1.0, letterSpacing:'-0.02em', marginBottom:20 }}>
            Magic link.<br/>No password.<br/><span style={{ fontStyle:'italic', color:'var(--t3)' }}>Ever.</span>
          </h1>
          <p className="t-body c-t2" style={{ maxWidth:380, lineHeight:1.65 }}>
            We email a link straight to the address on your account. Click it; you're in.
            Nothing to remember, nothing to reset.
          </p>
        </div>

        <div className="card" style={{ padding:36, maxWidth:440, justifySelf:'end', width:'100%', boxShadow:'var(--shadow-2)' }}>
          {state === 'sent' ? (
            <div className="fade-up">
              <div style={{ width:40, height:40, borderRadius:8, background:'var(--pos-sub)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--pos)', marginBottom:18 }}>
                <Ico.check s={20} sw={2.4}/>
              </div>
              <h2 className="t-h2" style={{ marginBottom:8 }}>Check your email.</h2>
              <p className="t-sm c-t2" style={{ marginBottom:24, lineHeight:1.6 }}>
                We sent a sign-in link to <strong style={{ color:'var(--t1)' }}>{email}</strong>. It expires in 15 minutes.
              </p>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setState('idle'); setEmail('');}}>Use a different email</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h2 className="t-h2" style={{ marginBottom:6 }}>Welcome back.</h2>
              <p className="t-sm c-t3" style={{ marginBottom:24 }}>Enter your work email.</p>

              <label className="t-eyebrow" style={{ display:'block', marginBottom:8 }}>Email</label>
              <input
                type="email" autoFocus
                className="field field-lg"
                placeholder="maria@bellanapoli.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setState('idle'); }}
                style={state==='error' ? { borderColor:'var(--neg-line)' } : {}}
              />
              {state==='error' && (
                <div className="fade-in" style={{ marginTop:10, padding:'8px 10px', background:'var(--neg-sub)', border:'1px solid var(--neg-line)', borderRadius:6, fontSize:12, color:'var(--neg)', display:'flex', alignItems:'flex-start', gap:8 }}>
                  <span style={{ marginTop:1 }}><Ico.alert s={12}/></span>
                  <div style={{ flex:1 }}>
                    {error}
                    {error.includes('No account') && (
                      <button type="button" onClick={()=>nav('/onboard')} style={{ color:'var(--accent)', fontWeight:600, marginLeft:6, textDecoration:'underline' }}>
                        Start trial →
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" disabled={state==='sending'} className="btn btn-primary btn-lg" style={{ width:'100%', marginTop:18 }}>
                {state==='sending' ? <span className="spin" style={{display:'inline-block',width:14,height:14,border:'2px solid currentColor',borderRightColor:'transparent',borderRadius:'50%'}}/> : 'Send sign-in link'}
              </button>

              <div style={{ marginTop:24, paddingTop:18, borderTop:'1px solid var(--line)', fontSize:12, color:'var(--t3)', textAlign:'center' }}>
                New to Replova? <button type="button" onClick={()=>nav('/onboard')} style={{ color:'var(--t1)', fontWeight:600, textDecoration:'underline' }}>Start a trial</button>
              </div>
            </form>
          )}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

// ── Onboard: 4 steps ────────────────────────────────────────────────────────
function StepDots({ steps, current }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:48 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:24, height:24, borderRadius:'50%',
              border:'1px solid', borderColor: i<=current ? 'var(--accent)' : 'var(--line-md)',
              background: i<current ? 'var(--accent)' : (i===current ? 'var(--surface)' : 'transparent'),
              color: i<current ? '#fff' : (i===current ? 'var(--accent)' : 'var(--t3)'),
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:600, fontVariantNumeric:'tabular-nums', flexShrink:0,
            }}>
              {i<current ? <Ico.check s={11} sw={2.6}/> : (i+1)}
            </div>
            <span style={{
              fontSize:12, fontWeight:600,
              color: i===current ? 'var(--t1)' : 'var(--t3)',
              letterSpacing:'0.01em',
            }}>{s}</span>
          </div>
          {i < steps.length-1 && <div style={{ flex:1, height:1, background: i<current ? 'var(--accent)' : 'var(--line)', margin:'0 16px' }}/>}
        </React.Fragment>
      ))}
    </div>
  );
}

function OnboardPage() {
  const nav = (p) => window.__nav(p);
  const [step, setStep] = useStateAuth(0);
  const [picked, setPicked] = useStateAuth(null);
  const [search, setSearch] = useStateAuth('Bella Napoli');
  const [plan, setPlan] = useStateAuth('growth');
  const [terms, setTerms] = useStateAuth(false);
  const [gmbOk, setGmbOk] = useStateAuth(false);

  const matches = [
    { id:'1', name:'Bella Napoli',     addr:'123 Mulberry St, New York, NY 10013', rating:4.3, reviews:142 },
    { id:'2', name:'Bella Napoli East', addr:'88 Avenue A, New York, NY 10009',    rating:4.1, reviews:67 },
    { id:'3', name:'Bella Napoli Pizza', addr:'2210 Bronx Park, Bronx, NY 10467',   rating:3.9, reviews:218 },
  ];

  const steps = ['Find restaurant', 'Connect Google', 'Choose plan', 'Confirm'];

  function next() { setStep(s => Math.min(s+1, 3)); }
  function back() { setStep(s => Math.max(s-1, 0)); }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <header style={{ borderBottom:'1px solid var(--line)', background:'var(--surface)' }}>
        <div style={{ maxWidth:880, margin:'0 auto', padding:'0 32px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Logo size={20}/>
          <button onClick={()=>nav('/signin')} className="t-xs c-t3" style={{ fontSize:12 }}>Already have an account? <span style={{ color:'var(--t1)', fontWeight:600, textDecoration:'underline', marginLeft:4 }}>Sign in</span></button>
        </div>
      </header>

      <main style={{ flex:1, maxWidth:880, width:'100%', margin:'0 auto', padding:'56px 32px' }}>
        <div className="t-eyebrow" style={{ marginBottom:12 }}>Step {step+1} of {steps.length}</div>
        <h1 className="t-serif" style={{ fontSize:44, lineHeight:1.05, letterSpacing:'-0.02em', marginBottom:8 }}>
          {step===0 && 'Find your restaurant.'}
          {step===1 && <>Connect Google Business.</>}
          {step===2 && <>Pick a plan.<span className="c-t3" style={{ fontStyle:'italic' }}> Free for 30 days.</span></>}
          {step===3 && <>One last thing.</>}
        </h1>
        <p className="t-body c-t2" style={{ marginBottom:40, maxWidth:560, lineHeight:1.6 }}>
          {step===0 && 'We use Google Places to make sure we sync from the right listing. If you run a chain, you can add the others later.'}
          {step===1 && "Replova posts replies on your behalf and reads incoming reviews. We don't change anything else."}
          {step===2 && 'You can change plans any time. No charge until day 31. Cancel anywhere in the first 30 days, no questions.'}
          {step===3 && 'Read this once, then you can ignore us until a 1-star comes in.'}
        </p>

        <StepDots steps={steps} current={step}/>

        {/* Step 0 — Find */}
        {step===0 && (
          <div className="fade-up">
            <label className="t-eyebrow" style={{ display:'block', marginBottom:8 }}>Restaurant name</label>
            <div style={{ position:'relative', marginBottom:20 }}>
              <span style={{ position:'absolute', top:14, left:14, color:'var(--t3)' }}><Ico.search s={14}/></span>
              <input className="field field-lg" style={{ paddingLeft:40 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Try 'Bella Napoli'"/>
            </div>
            <div className="card" style={{ overflow:'hidden' }}>
              {matches.map((m, i) => (
                <button key={m.id} onClick={()=>setPicked(m.id)}
                  style={{ width:'100%', padding:'14px 16px', display:'flex', alignItems:'center', gap:14, textAlign:'left',
                    borderTop: i>0 ? '1px solid var(--line)' : 'none',
                    background: picked===m.id ? 'var(--accent-sub)' : 'transparent',
                    transition:'background 0.1s',
                  }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)', flexShrink:0 }}>
                    <Ico.pin s={16}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{m.name}</div>
                    <div className="t-xs c-t3">{m.addr}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}><Stars rating={Math.round(m.rating)} size={11}/></div>
                    <div className="t-xs c-t3 tnum">{m.rating} · {m.reviews} reviews</div>
                  </div>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:'1.5px solid', borderColor: picked===m.id ? 'var(--accent)' : 'var(--line-md)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {picked===m.id && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)' }}/>}
                  </div>
                </button>
              ))}
            </div>
            <div className="t-xs c-t4" style={{ marginTop:14 }}>Can't find it? Listings sometimes take a few hours to appear in Google Places. Email <a href="#" style={{ color:'var(--t2)', textDecoration:'underline' }}>support@replova.app</a>.</div>
          </div>
        )}

        {/* Step 1 — GMB */}
        {step===1 && (
          <div className="fade-up">
            <div className="card" style={{ padding:32, marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:18 }}>
                <div style={{ width:48, height:48, borderRadius:10, background:'var(--surface-2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#4285f4" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.5 29 4.5 24 4.5a19.5 19.5 0 1 0 0 39c10.7 0 19.5-7.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/><path fill="#34a853" d="M6.3 14.7l6.6 4.8C14.6 15 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.5 4.5 10 8.7 6.3 14.7z"/><path fill="#fbbc04" d="M24 43.5c4.9 0 9.4-1.9 12.7-5l-5.9-5c-1.8 1.3-4.1 2-6.8 2-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.9 39.2 16.4 43.5 24 43.5z"/><path fill="#ea4335" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l5.9 5c4.1-3.8 6.6-9.4 6.6-15.7 0-1.2-.1-2.3-.4-3.5z"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <h3 className="t-h3" style={{ marginBottom:6 }}>Connect Google Business</h3>
                  <p className="t-sm c-t2" style={{ marginBottom:20, lineHeight:1.6 }}>
                    We'll request access to read reviews and post replies on the listing for <strong style={{ color:'var(--t1)' }}>Bella Napoli</strong>. Nothing else.
                  </p>
                  {!gmbOk ? (
                    <button onClick={()=>setGmbOk(true)} className="btn btn-primary">
                      <span style={{display:'inline-block',width:14,height:14,background:'#fff',borderRadius:'50%',padding:2}}>
                        <svg width="10" height="10" viewBox="0 0 48 48"><path fill="#4285f4" d="M43.6 20.5H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.5 29 4.5 24 4.5a19.5 19.5 0 1 0 0 39c10.7 0 19.5-7.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/></svg>
                      </span>
                      Continue with Google
                    </button>
                  ) : (
                    <div className="fade-in" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--pos-sub)', border:'1px solid var(--pos-line)', borderRadius:8 }}>
                      <Ico.check s={14} sw={2.4}/>
                      <span style={{ fontSize:13, color:'var(--pos)', fontWeight:600 }}>Connected — Bella Napoli (123 Mulberry)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="card-inset" style={{ padding:18 }}>
              <div className="t-eyebrow" style={{ marginBottom:8 }}>What happens next</div>
              <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:8, fontSize:13, color:'var(--t2)', lineHeight:1.55 }}>
                <li style={{ display:'flex', gap:10 }}><span className="c-t4 tnum">01</span> We import the last 90 days of reviews ({'~'}142 reviews).</li>
                <li style={{ display:'flex', gap:10 }}><span className="c-t4 tnum">02</span> Three reply drafts are generated for every unreplied review.</li>
                <li style={{ display:'flex', gap:10 }}><span className="c-t4 tnum">03</span> You'll get a one-line "Sync complete" notification — usually within 60 seconds.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2 — Plan */}
        {step===2 && (
          <div className="fade-up" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {[
              { k:'starter', n:'Starter', p:39, locs:'1 location', best:'Single owner-operator' },
              { k:'growth',  n:'Growth',  p:99, locs:'5 locations', best:'Small chains', ribbon:'Most picked' },
              { k:'agency',  n:'Agency',  p:199, locs:'15 locations', best:'Groups & agencies' },
            ].map(p => (
              <button key={p.k} onClick={()=>setPlan(p.k)} className="card" style={{
                padding:24, textAlign:'left', position:'relative',
                borderColor: plan===p.k ? 'var(--accent)' : 'var(--line)',
                boxShadow: plan===p.k ? '0 0 0 3px var(--accent-sub)' : 'none',
                transition:'all 0.15s',
              }}>
                {p.ribbon && <span className="pill pill-accent" style={{ position:'absolute', top:14, right:14 }}>{p.ribbon}</span>}
                <div className="t-eyebrow" style={{ color: plan===p.k ? 'var(--accent)' : 'var(--t3)', marginBottom:10 }}>{p.n}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:6 }}>
                  <span className="t-serif" style={{ fontSize:36, lineHeight:1 }}>${p.p}</span>
                  <span className="t-xs c-t3">/ mo</span>
                </div>
                <div className="t-xs c-t3">{p.locs}</div>
                <div className="t-xs c-t3" style={{ marginTop:14, fontStyle:'italic' }}>For: {p.best}</div>
                <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)', display:'flex', alignItems:'center', gap:6, fontSize:11, color: plan===p.k ? 'var(--accent)' : 'var(--t3)' }}>
                  <div style={{ width:14, height:14, borderRadius:'50%', border:'1.5px solid currentColor', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {plan===p.k && <div style={{ width:6, height:6, borderRadius:'50%', background:'currentColor' }}/>}
                  </div>
                  {plan===p.k ? 'Selected' : 'Select'}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step===3 && (
          <div className="fade-up">
            <div className="card" style={{ padding:24, marginBottom:20 }}>
              <div className="t-eyebrow" style={{ marginBottom:14 }}>Your setup</div>
              <table style={{ width:'100%', fontSize:13 }}>
                <tbody>
                  <tr><td style={{ padding:'8px 0', color:'var(--t3)', width:160 }}>Restaurant</td><td style={{ padding:'8px 0', fontWeight:600 }}>Bella Napoli</td></tr>
                  <tr><td style={{ padding:'8px 0', color:'var(--t3)', borderTop:'1px solid var(--line)' }}>Listing</td><td style={{ padding:'8px 0', borderTop:'1px solid var(--line)', color:'var(--t2)' }}>123 Mulberry St, New York, NY</td></tr>
                  <tr><td style={{ padding:'8px 0', color:'var(--t3)', borderTop:'1px solid var(--line)' }}>Google Business</td><td style={{ padding:'8px 0', borderTop:'1px solid var(--line)' }}><span className="dot dot-pos" style={{ marginRight:6 }}/>Connected</td></tr>
                  <tr><td style={{ padding:'8px 0', color:'var(--t3)', borderTop:'1px solid var(--line)' }}>Plan</td><td style={{ padding:'8px 0', borderTop:'1px solid var(--line)' }}><span style={{ fontWeight:600, textTransform:'capitalize' }}>{plan}</span> · 30 days free, then ${plan==='starter'?39:plan==='growth'?99:199}/mo</td></tr>
                  <tr><td style={{ padding:'8px 0', color:'var(--t3)', borderTop:'1px solid var(--line)' }}>First charge</td><td style={{ padding:'8px 0', borderTop:'1px solid var(--line)' }}>May 25, 2026</td></tr>
                </tbody>
              </table>
            </div>
            <label style={{ display:'flex', alignItems:'flex-start', gap:12, padding:14, background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:10, cursor:'pointer' }}>
              <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} style={{ marginTop:2 }}/>
              <span className="t-sm c-t2" style={{ lineHeight:1.6 }}>
                I agree to the <a href="#/terms" style={{ color:'var(--t1)', textDecoration:'underline' }}>Terms of Service</a> and <a href="#/privacy" style={{ color:'var(--t1)', textDecoration:'underline' }}>Privacy Policy</a>. I understand Replova will read and reply to reviews on the connected Google Business listing.
              </span>
            </label>
          </div>
        )}

        {/* Footer nav */}
        <div style={{ marginTop:40, paddingTop:24, borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between' }}>
          <button onClick={back} className="btn btn-quiet" disabled={step===0}>← Back</button>
          {step < 3 ? (
            <button onClick={next} className="btn btn-primary" disabled={(step===0 && !picked) || (step===1 && !gmbOk)}>
              Continue <Ico.arrowRight s={13}/>
            </button>
          ) : (
            <button onClick={()=>nav('/dashboard')} className="btn btn-primary" disabled={!terms}>
              Open dashboard <Ico.arrowRight s={13}/>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { SignInPage, OnboardPage });
