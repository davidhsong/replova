
const { useState } = React;

function BillingPage() {
  const nav = p => window.__nav(p);
  const [portalLoading, setPortalLoading] = useState(false);

  // Mock state — trial active, no stripe customer yet
  const inTrial = true;
  const daysLeft = 22;
  const trialEnd = new Date(Date.now() + daysLeft * 86400000)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  async function handlePortal() {
    setPortalLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setPortalLoading(false);
  }

  return (
    <div className="app-shell">
      <Sidebar active="/dashboard/billing" />
      <main className="main">
        <div className="sec-head">
          <h1 style={{fontSize:18,fontWeight:800,letterSpacing:'-0.025em',color:'var(--t1)',marginBottom:2}}>Billing</h1>
          <p style={{fontSize:13,color:'var(--t3)'}}>Manage your subscription and payment details</p>
        </div>

        <div className="page-wrap">

          {/* Trial banner */}
          {inTrial && (
            <div className="fade-up banner banner-amber" style={{marginBottom:16}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Free trial · {daysLeft} days remaining — trial ends {trialEnd}
            </div>
          )}

          {/* Subscription status */}
          <div className="fade-up card" style={{padding:24,marginBottom:12}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,marginBottom:20,flexWrap:'wrap'}}>
              <div>
                <h2 style={{fontSize:14,fontWeight:700,color:'var(--t1)',marginBottom:4}}>Subscription</h2>
                <p style={{fontSize:13,color:'var(--t3)'}}>Replova Monthly · $99 / month</p>
              </div>
              <span className="badge badge-green" style={{padding:'4px 12px',fontSize:12}}>
                <span className="dot dot-green pulse-d" style={{width:6,height:6,marginRight:6}}></span>
                Active — Free trial
              </span>
            </div>

            {/* Trial progress */}
            {inTrial && (
              <div style={{marginBottom:24}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:12,color:'var(--t3)'}}>Trial progress</span>
                  <span style={{fontSize:12,color:'var(--warn)',fontWeight:600}}>{daysLeft} days left</span>
                </div>
                <div style={{height:4,borderRadius:999,background:'var(--surface-2)',overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:999,background:'var(--warn)',width:`${Math.round((daysLeft/30)*100)}%`,transition:'width .3s'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                  <span style={{fontSize:11,color:'var(--t3)'}}>Day 8</span>
                  <span style={{fontSize:11,color:'var(--t3)'}}>Day 30</span>
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={handlePortal} disabled={portalLoading} className="btn btn-ghost" style={{borderRadius:10,padding:'8px 16px'}}>
                {portalLoading ? (
                  <><svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 010 20" opacity=".75"/></svg>Loading…</>
                ) : (
                  <>Add payment method<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></>
                )}
              </button>
              <span style={{display:'flex',alignItems:'center',fontSize:12,color:'var(--t3)',paddingLeft:4}}>No charge until {trialEnd}</span>
            </div>
          </div>

          {/* Plan details */}
          <div className="fade-up card" style={{padding:24,marginBottom:12,animationDelay:'40ms'}}>
            <h2 style={{fontSize:14,fontWeight:700,color:'var(--t1)',marginBottom:20}}>What's included</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[
                {icon:'✦',title:'AI reply drafts',desc:'3 tone options generated per review: Professional, Warm, and Brief.'},
                {icon:'🔔',title:'Urgent alerts',desc:'Low-rating reviews are flagged and surfaced at the top for immediate action.'},
                {icon:'📧',title:'Weekly digest',desc:'Every Monday morning, a summary of reviews that need your attention.'},
                {icon:'✓',title:'Auto-detect replied',desc:"Replova detects when you've already replied on Google and marks it complete."},
                {icon:'🔍',title:'Review dashboard',desc:'Search, filter, and track all your reviews and reply status in one place.'},
                {icon:'⚡',title:'Saves 5+ hrs/week',desc:'Stop copying and pasting replies manually — let AI do the heavy lifting.'},
              ].map(({icon,title,desc}) => (
                <div key={title} style={{display:'flex',gap:12,padding:'14px',background:'var(--surface-0)',borderRadius:12,border:'1px solid var(--border)'}}>
                  <div style={{width:32,height:32,background:'var(--surface-2)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                    {icon}
                  </div>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:'var(--t1)',marginBottom:3}}>{title}</p>
                    <p style={{fontSize:12,color:'var(--t3)',lineHeight:1.55}}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing info */}
          <div className="fade-up card" style={{padding:24,marginBottom:12,animationDelay:'80ms'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
              <div>
                <h2 style={{fontSize:14,fontWeight:700,color:'var(--t1)',marginBottom:4}}>Plan pricing</h2>
                <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                  <span style={{fontSize:32,fontWeight:800,letterSpacing:'-0.04em',color:'var(--t1)'}}>$99</span>
                  <span style={{fontSize:14,color:'var(--t2)',fontWeight:500}}>/month</span>
                </div>
                <p style={{fontSize:12,color:'var(--t3)',marginTop:4}}>Billed monthly · Cancel anytime · No contracts</p>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <span style={{fontSize:12,color:'var(--t2)'}}>Cancel anytime</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <span style={{fontSize:12,color:'var(--t2)'}}>No setup fees</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <span style={{fontSize:12,color:'var(--t2)'}}>30-day free trial</span>
                </div>
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="fade-up card" style={{padding:24,animationDelay:'120ms'}}>
            <h2 style={{fontSize:14,fontWeight:700,color:'var(--t1)',marginBottom:4}}>Need help?</h2>
            <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.65}}>
              Questions about billing? Email us at{' '}
              <a href="mailto:support@replova.app" style={{color:'var(--accent)',fontWeight:500}}>support@replova.app</a>
              {' '}and we'll get back to you within 24 hours.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

Object.assign(window, { BillingPage });
