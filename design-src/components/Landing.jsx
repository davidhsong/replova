
const { useState } = React;

function ProductMockup() {
  return (
    <div style={{
      background:'#09090b', border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:20, overflow:'hidden',
      boxShadow:'0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05)',
    }}>
      {/* Chrome */}
      <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(255,255,255,0.02)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:24,height:24,background:'var(--accent)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <span style={{fontSize:13,fontWeight:700,color:'#f2f1f0',letterSpacing:'-0.02em'}}>Replova</span>
          <span style={{color:'rgba(255,255,255,0.18)',fontSize:12}}>/</span>
          <span style={{fontSize:12,color:'rgba(255,255,255,0.38)'}}>Review Center</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'#22c55e'}}></div>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.28)'}}>Monitoring</span>
        </div>
      </div>
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        {[
          {label:'Needs reply',value:'3',color:'#f2f1f0'},
          {label:'Avg rating',value:'★ 4.3',color:'#f59e0b'},
          {label:'Response rate',value:'91%',color:'#f2f1f0'},
        ].map((s,i) => (
          <div key={i} style={{padding:'11px 16px',borderRight:i<2?'1px solid rgba(255,255,255,0.06)':'none'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.28)',marginBottom:3,fontWeight:500}}>{s.label}</div>
            <div style={{fontSize:18,fontWeight:700,color:s.color,letterSpacing:'-0.03em'}}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* Urgent review */}
      <div style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
          <div style={{flexShrink:0}}>
            <div style={{fontSize:11,color:'#f59e0b',letterSpacing:-1}}>★★☆☆☆</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.2)',marginTop:1}}>2/5</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
              <span style={{fontSize:12,fontWeight:600,color:'#f2f1f0'}}>James K.</span>
              <span style={{background:'rgba(239,68,68,0.12)',color:'#f87171',border:'1px solid rgba(239,68,68,0.2)',padding:'1px 6px',borderRadius:5,fontSize:10,fontWeight:700}}>Urgent</span>
            </div>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.32)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Service was slow and the food came out cold...</p>
          </div>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.2)',flexShrink:0}}>2h ago</span>
        </div>
        <div style={{padding:'0 16px 14px'}}>
          <div style={{background:'#111115',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:12}}>
            <div style={{display:'flex',gap:4,marginBottom:10}}>
              {['Professional','Warm','Brief'].map((l,i) => (
                <span key={l} style={{
                  padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                  background: i===0 ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: i===0 ? '#f2f1f0' : 'rgba(255,255,255,0.28)',
                  border: i===0 ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                }}>{l}</span>
              ))}
            </div>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.52)',lineHeight:1.65,margin:'0 0 12px 0'}}>
              Hi James, I'm truly sorry your experience fell below our standards. Please reach out directly and I'll personally make it right.
            </p>
            <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
              <span style={{background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.45)',border:'1px solid rgba(255,255,255,0.1)',padding:'4px 10px',borderRadius:7,fontSize:11,cursor:'pointer'}}>Copy</span>
              <span style={{background:'var(--accent)',color:'#fff',padding:'4px 12px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600}}>Reply on Google</span>
            </div>
          </div>
        </div>
      </div>
      {/* Faded rows */}
      {[
        {stars:'★★★★★',name:'Sofia L.',text:"Best service I've had in months. Will be back!",time:'Yesterday',opacity:.38},
        {stars:'★★★★☆',name:'Marco R.',text:'Amazing experience, will definitely come back...',time:'Mar 15',opacity:.2},
      ].map((r,i) => (
        <div key={i} style={{padding:'11px 16px',opacity:r.opacity,display:'flex',alignItems:'center',gap:10,borderTop:'1px solid rgba(255,255,255,0.04)'}}>
          <div style={{fontSize:11,color:'#f59e0b',flexShrink:0,width:52}}>{r.stars}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:'#f2f1f0',marginBottom:2}}>{r.name}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.text}</div>
          </div>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.2)',flexShrink:0}}>{r.time}</span>
        </div>
      ))}
    </div>
  );
}

function LandingPage() {
  const nav = p => window.__nav(p);
  const yr = new Date().getFullYear();
  const BG = '#f9f9fb', TEXT = '#0a0a10', T2 = '#68687a', BORDER = 'rgba(0,0,0,0.07)', CARD = '#fff';

  return (
    <div style={{background:BG, color:TEXT, minHeight:'100dvh', fontFamily:'inherit'}}>
      {/* Nav */}
      <header style={{position:'sticky',top:0,zIndex:50,background:'rgba(249,249,251,0.86)',backdropFilter:'blur(14px)',borderBottom:`1px solid ${BORDER}`}}>
        <div style={{maxWidth:1120,margin:'0 auto',padding:'0 28px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <button onClick={() => nav('/')} style={{background:'none',border:'none',fontSize:16,fontWeight:800,letterSpacing:'-0.03em',color:TEXT,cursor:'pointer',fontFamily:'inherit'}}>
            Replova
          </button>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={() => nav('/signin')} style={{background:'none',border:'none',fontSize:14,fontWeight:500,color:T2,cursor:'pointer',padding:'6px 12px',fontFamily:'inherit',borderRadius:8,transition:'color .15s'}}>
              Sign in
            </button>
            <button onClick={() => nav('/onboard')} style={{background:TEXT,color:BG,border:'none',borderRadius:999,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,transition:'opacity .15s'}}>
              Start free trial
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{maxWidth:1120,margin:'0 auto',padding:'72px 28px 90px',display:'grid',gridTemplateColumns:'1fr 1.1fr',gap:72,alignItems:'center'}}>
        <div className="fade-up">
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#eef3fe',border:'1px solid rgba(74,124,246,0.2)',borderRadius:999,padding:'5px 14px 5px 8px',marginBottom:24}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)'}}></div>
            <span style={{fontSize:12,fontWeight:600,color:'var(--accent)'}}>AI-powered review management</span>
          </div>
          <h1 style={{fontSize:54,fontWeight:800,lineHeight:1.05,letterSpacing:'-0.04em',color:TEXT,marginBottom:20,textWrap:'pretty'}}>
            Reply to every<br/>
            <span style={{color:'var(--accent)'}}>Google review.</span><br/>
            Automatically.
          </h1>
          <p style={{fontSize:17,color:T2,lineHeight:1.7,marginBottom:36,maxWidth:420}}>
            Replova monitors your reviews 24/7 and generates AI-crafted replies so you respond faster, protect your reputation, and save hours every week.
          </p>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:40,flexWrap:'wrap'}}>
            <button onClick={() => nav('/onboard')} style={{background:TEXT,color:BG,border:'none',borderRadius:999,padding:'12px 24px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:8,transition:'opacity .15s'}}>
              Start free trial
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <span style={{fontSize:13,color:T2}}>30 days free · No credit card</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12,paddingTop:24,borderTop:`1px solid ${BORDER}`}}>
            <div style={{display:'flex'}}>
              {['84','85','86','87'].map((s,i) => (
                <img key={s} src={`https://picsum.photos/seed/${s}/32/32`} alt="" style={{width:32,height:32,borderRadius:'50%',border:`2px solid ${BG}`,marginLeft:i>0?-10:0,objectFit:'cover'}}/>
              ))}
            </div>
            <div>
              <div style={{fontSize:12,color:'#f59e0b'}}>★★★★★</div>
              <div style={{fontSize:12,color:T2}}>Trusted by business owners</div>
            </div>
          </div>
        </div>
        <div className="fade-up" style={{animationDelay:'80ms'}}>
          <ProductMockup />
        </div>
      </section>

      {/* Why it matters */}
      <section style={{borderTop:`1px solid ${BORDER}`,background:'#f2f2f6',padding:'72px 28px'}}>
        <div style={{maxWidth:1120,margin:'0 auto'}}>
          <div style={{marginBottom:48}}>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--accent)',marginBottom:8}}>Why it matters</p>
            <h2 style={{fontSize:34,fontWeight:800,letterSpacing:'-0.035em',color:TEXT,marginBottom:12}}>Your reviews are your reputation</h2>
            <p style={{fontSize:16,color:T2,maxWidth:500,lineHeight:1.7}}>Most businesses lose customers not because of a bad review — but because they never responded.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:36}}>
            {[
              {icon:'💬',title:'Builds trust',body:"Customers trust businesses that respond to reviews 2× more than those that don't. Every reply signals that you care about your guests."},
              {icon:'📈',title:'Improves rankings',body:'Google actively rewards businesses that engage with reviews. Responding consistently can lift your local search visibility.'},
              {icon:'💰',title:'Increases revenue',body:"A thoughtful response to a negative review turns lost customers into loyal ones — and shows prospects you take quality seriously."},
            ].map(({icon,title,body},i) => (
              <div key={i} className="fade-up" style={{animationDelay:`${i*60}ms`}}>
                <div style={{width:44,height:44,background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,fontSize:20,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
                  {icon}
                </div>
                <h3 style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:8}}>{title}</h3>
                <p style={{fontSize:14,color:T2,lineHeight:1.7}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{borderTop:`1px solid ${BORDER}`,padding:'72px 28px',background:BG}}>
        <div style={{maxWidth:1120,margin:'0 auto'}}>
          <div style={{marginBottom:48}}>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--accent)',marginBottom:8}}>How it works</p>
            <h2 style={{fontSize:34,fontWeight:800,letterSpacing:'-0.035em',color:TEXT}}>From review to reply in minutes</h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:36}}>
            {[
              {step:'01',title:'Connect your listing',body:'Enter your business name and we find your Google Business profile. Setup takes under 5 minutes.'},
              {step:'02',title:'Get AI-suggested replies',body:'We monitor for new reviews and generate 3 ready-to-use reply options — Professional, Warm, and Brief — instantly.'},
              {step:'03',title:'Copy, paste. Done.',body:"Pick the tone that fits, hit Reply on Google, and you're done. Less than two minutes per review."},
            ].map(({step,title,body},i) => (
              <div key={i} className="fade-up" style={{animationDelay:`${i*60}ms`}}>
                <div style={{width:40,height:40,background:TEXT,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
                  <span style={{fontSize:11,fontWeight:800,color:BG,fontFamily:'monospace'}}>{step}</span>
                </div>
                <h3 style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:8}}>{title}</h3>
                <p style={{fontSize:14,color:T2,lineHeight:1.7}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section style={{borderTop:`1px solid ${BORDER}`,background:'#f2f2f6',padding:'72px 28px'}}>
        <div style={{maxWidth:1120,margin:'0 auto'}}>
          <div style={{marginBottom:48}}>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--accent)',marginBottom:8}}>Features</p>
            <h2 style={{fontSize:34,fontWeight:800,letterSpacing:'-0.035em',color:TEXT}}>Everything you need to stay on top</h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridRow:'span 2',background:'#09090b',borderRadius:20,padding:32,display:'flex',flexDirection:'column',justifyContent:'space-between',minHeight:240}}>
              <div>
                <div style={{width:40,height:40,background:'var(--accent)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
                </div>
                <h3 style={{fontSize:17,fontWeight:700,color:'#f2f1f0',marginBottom:10,letterSpacing:'-0.02em'}}>3 reply tones, one click</h3>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.42)',lineHeight:1.7}}>Every review gets Professional, Warm, and Brief replies — pick the voice that fits and post in seconds.</p>
              </div>
              <div style={{marginTop:24,display:'flex',flexDirection:'column',gap:6}}>
                {[['Professional','var(--accent)','78%'],['Warm','#22c55e','60%'],['Brief','#f59e0b','44%']].map(([l,c,w]) => (
                  <div key={l} style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.35)',width:72}}>{l}</span>
                    <div style={{height:4,borderRadius:999,background:`rgba(255,255,255,0.08)`,flex:1}}>
                      <div style={{height:'100%',borderRadius:999,background:c,width:w,transition:'width .3s'}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {[
              {icon:'🚨',title:'Urgent review alerts',body:'Low-rating reviews surface first with an Urgent flag — never leave a 1-star unanswered.',bg:CARD},
              {icon:'✓',title:'Auto-detect replied',body:'Already responded on Google? Replova detects it and marks it complete automatically.',bg:CARD},
            ].map(({icon,title,body,bg},i) => (
              <div key={i} style={{background:bg,border:`1px solid ${BORDER}`,borderRadius:20,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                <div style={{width:40,height:40,background:'#f4f4f8',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,fontSize:18,border:`1px solid ${BORDER}`}}>{icon}</div>
                <h3 style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:8}}>{title}</h3>
                <p style={{fontSize:13,color:T2,lineHeight:1.7}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{borderTop:`1px solid ${BORDER}`,padding:'72px 28px',background:BG}}>
        <div style={{maxWidth:1120,margin:'0 auto'}}>
          <div style={{marginBottom:48}}>
            <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--accent)',marginBottom:8}}>Pricing</p>
            <h2 style={{fontSize:34,fontWeight:800,letterSpacing:'-0.035em',color:TEXT}}>Simple, honest pricing</h2>
          </div>
          <div style={{maxWidth:420}}>
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:24,padding:36,boxShadow:'0 4px 24px rgba(0,0,0,.07)'}}>
              <div style={{marginBottom:28}}>
                <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:4}}>
                  <span style={{fontSize:52,fontWeight:800,letterSpacing:'-0.05em',color:TEXT}}>$99</span>
                  <span style={{fontSize:15,color:T2,fontWeight:500}}>/month</span>
                </div>
                <p style={{fontSize:13,color:T2}}>30-day free trial · Cancel anytime</p>
              </div>
              <div style={{marginBottom:28}}>
                {[
                  'AI-suggested replies for every new review',
                  '3 tone options per review: Professional, Warm, Brief',
                  'Urgent alerts for low-rating reviews',
                  'Weekly Monday morning review digest',
                  'Dashboard to manage and track all replies',
                  'Auto-detect already-replied reviews',
                  'Saves 5+ hours per week on review management',
                ].map(item => (
                  <div key={item} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:11}}>
                    <svg style={{flexShrink:0,marginTop:2,color:'var(--accent)'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    <span style={{fontSize:14,color:'#3a3a4c'}}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => nav('/onboard')} style={{width:'100%',background:TEXT,color:BG,border:'none',borderRadius:999,padding:'13px 24px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'opacity .15s'}}>
                Start free trial
              </button>
              <p style={{textAlign:'center',fontSize:12,color:T2,marginTop:12}}>No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* Dark CTA */}
      <section style={{background:'#09090b',padding:'80px 28px'}}>
        <div style={{maxWidth:680,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontSize:38,fontWeight:800,letterSpacing:'-0.04em',color:'#f2f1f0',marginBottom:14}}>
            Start protecting your reputation today
          </h2>
          <p style={{fontSize:16,color:'rgba(255,255,255,0.4)',marginBottom:36,lineHeight:1.6}}>Free for 30 days. No credit card required.</p>
          <button onClick={() => nav('/onboard')} style={{background:'#f2f1f0',color:'#09090b',border:'none',borderRadius:999,padding:'13px 28px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8}}>
            Start your free trial
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{background:'#09090b',borderTop:'1px solid rgba(255,255,255,0.07)',padding:'24px 28px'}}>
        <div style={{maxWidth:1120,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          <span style={{fontSize:15,fontWeight:800,color:'#f2f1f0',letterSpacing:'-0.03em'}}>Replova</span>
          <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
            {['Terms','Privacy','Support'].map(l => (
              <a key={l} href="#" style={{fontSize:13,color:'rgba(255,255,255,0.3)'}}>{l}</a>
            ))}
            <span style={{fontSize:13,color:'rgba(255,255,255,0.18)'}}>© {yr} Replova</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { LandingPage });
