// ── Landing page ─────────────────────────────────────────────────────────────
/* DECISION: Editorial restaurant-trade tone. The hero is a serif statement,
   not a value-prop sentence. Pricing is honest (3 plans visible). Product
   shot: a real-feeling review row, the negative-review treatment from the
   product. No purple→blue gradient, no AI-sparkles, no glassmorphism. */

function HeroProductShot() {
  return (
    <div className="card" style={{
      background:'var(--surface)', borderRadius: 14, overflow:'hidden',
      boxShadow:'var(--shadow-2)',
    }}>
      {/* Chrome */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface-2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Logo size={14}/>
          <span style={{ color:'var(--t4)', fontSize:11 }}>/</span>
          <span className="t-xs c-t3">Reviews</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className="dot dot-pos dot-pulse"></span>
          <span className="t-xs c-t3">Monitoring</span>
        </div>
      </div>
      {/* Stat strip */}
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', borderBottom:'1px solid var(--line)' }}>
        <div style={{ padding:'14px 16px', borderRight:'1px solid var(--line)' }}>
          <div className="t-eyebrow" style={{ marginBottom:4 }}>Score</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span className="t-serif" style={{ fontSize: 28, lineHeight:1, color:'var(--t1)' }}>78</span>
            <span className="t-xs c-pos" style={{ display:'flex', alignItems:'center', gap:2 }}><Ico.arrowUp s={10}/> 4</span>
          </div>
        </div>
        <div style={{ padding:'14px 16px', borderRight:'1px solid var(--line)' }}>
          <div className="t-eyebrow" style={{ marginBottom:4 }}>Rating</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
            <span className="tnum" style={{ fontSize:18, fontWeight:600 }}>4.3</span>
            <Stars rating={4} size={11}/>
          </div>
        </div>
        <div style={{ padding:'14px 16px' }}>
          <div className="t-eyebrow" style={{ marginBottom:4 }}>Awaiting</div>
          <div style={{ fontSize:18, fontWeight:600, color:'var(--neg)' }}>3</div>
        </div>
      </div>

      {/* Negative review highlight */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--line)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ width:3, alignSelf:'stretch', background:'var(--neg)', borderRadius:1, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>James K.</span>
              <Stars rating={2} size={11}/>
              <span className="pill pill-neg">Urgent · 1-star</span>
            </div>
            <p className="t-serif t-italic" style={{ fontSize:14, lineHeight:1.55, color:'var(--t2)', margin:0 }}>
              "Service was slow tonight and my pasta came out cold. We waited 45 minutes."
            </p>
          </div>
          <span className="t-xs c-t4" style={{ flexShrink:0 }}>3h</span>
        </div>
        <div style={{ marginTop:12, padding:12, background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius: 10 }}>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            {['Professional','Warm','Brief'].map((l,i) => (
              <span key={l} style={{
                fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:4,
                background: i===0 ? 'var(--surface)' : 'transparent',
                color: i===0 ? 'var(--t1)' : 'var(--t3)',
                border: i===0 ? '1px solid var(--line-md)' : '1px solid transparent',
              }}>{l}</span>
            ))}
          </div>
          <p style={{ fontSize:12, color:'var(--t2)', lineHeight:1.55, margin:0 }}>
            Hi James — a 45-minute wait and cold food fall well below the standard we hold ourselves to. I'd like the chance to make this right…
          </p>
        </div>
      </div>

      {/* Faded rows */}
      {[
        { stars:5, name:'Sofia L.', t:"Best carbonara outside Rome.", time:'Yesterday', op:0.55 },
        { stars:4, name:'Marco R.', t:"Truffle pizza was excellent.", time:'Apr 19', op:0.32 },
      ].map((r,i) => (
        <div key={i} style={{ padding:'12px 16px', borderBottom: i===0?'1px solid var(--line)':'none', display:'flex', alignItems:'center', gap:12, opacity:r.op }}>
          <Stars rating={r.stars} size={11}/>
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize:13, fontWeight:600 }}>{r.name}</span>
            <span className="t-xs c-t3" style={{ marginLeft:8 }}>{r.t}</span>
          </div>
          <span className="t-xs c-t4">{r.time}</span>
        </div>
      ))}
    </div>
  );
}

function LandingPage() {
  const nav = (p) => window.__nav(p);
  return (
    <div style={{ background:'var(--bg)', color:'var(--t1)' }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{ maxWidth:1140, margin:'0 auto', padding:'72px 32px 56px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'start' }}>
        <div className="fade-up">
          <div className="t-eyebrow" style={{ marginBottom:18 }}>Reputation management for restaurants</div>
          <h1 className="t-serif" style={{ fontSize:56, lineHeight:1.05, letterSpacing:'-0.02em', marginBottom:22 }}>
            Reviews aren't<br/>
            <span style={{ fontStyle:'italic' }}>marketing.</span><br/>
            They're the menu<br/>
            after the meal.
          </h1>
          <p className="t-body c-t2" style={{ fontSize:16, maxWidth:430, marginBottom:28, lineHeight:1.6 }}>
            Replova reads every Google review the moment it lands, drafts a reply in your voice,
            and tells you what your customers actually think — line by line, week by week.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={()=>nav('/onboard')} className="btn btn-primary btn-lg">
              Start free trial <Ico.arrowRight s={14}/>
            </button>
            <span className="t-xs c-t3">30 days · no card</span>
          </div>
          <div style={{ marginTop:40, paddingTop:24, borderTop:'1px solid var(--line)', display:'flex', alignItems:'center', gap:32 }}>
            <div>
              <div className="t-mono" style={{ fontSize:22, fontWeight:600 }}>4,200<span className="c-t3">+</span></div>
              <div className="t-xs c-t3">restaurants tracked</div>
            </div>
            <div className="vr" style={{ height:32 }}/>
            <div>
              <div className="t-mono" style={{ fontSize:22, fontWeight:600 }}>91<span className="c-t3">%</span></div>
              <div className="t-xs c-t3">reply rate avg</div>
            </div>
            <div className="vr" style={{ height:32 }}/>
            <div>
              <div className="t-mono" style={{ fontSize:22, fontWeight:600 }}>5h<span className="c-t3"> /wk</span></div>
              <div className="t-xs c-t3">saved per location</div>
            </div>
          </div>
        </div>
        <div className="fade-up" style={{ animationDelay:'80ms' }}>
          <HeroProductShot />
        </div>
      </section>

      {/* Trust strip */}
      <section style={{ borderTop:'1px solid var(--line)', borderBottom:'1px solid var(--line)', background:'var(--surface)' }}>
        <div style={{ maxWidth:1140, margin:'0 auto', padding:'24px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, flexWrap:'wrap' }}>
          <span className="t-eyebrow">In the kitchens of</span>
          <div style={{ display:'flex', gap:36, alignItems:'center', flexWrap:'wrap' }}>
            {['Bella Napoli','Casa Lupita','The Cured','Hudson & Coal','Ferment','Maison Petit'].map(n => (
              <span key={n} className="t-serif t-italic" style={{ fontSize:18, color:'var(--t3)' }}>{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Three columns of substance */}
      <section style={{ maxWidth:1140, margin:'0 auto', padding:'80px 32px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:48, marginBottom:48 }}>
          <div>
            <div className="t-eyebrow c-accent">The work</div>
            <h2 className="t-serif" style={{ fontSize:40, lineHeight:1.05, letterSpacing:'-0.02em', marginTop:8 }}>
              What you'd do<br/>if you had time.
            </h2>
          </div>
          <p className="t-body c-t2" style={{ fontSize:16, lineHeight:1.7, alignSelf:'end', maxWidth:520 }}>
            Most owner-operators write replies between covers, after a shift, or never. Replova writes
            them in your voice the second a review lands — three options, each in a different register,
            ready for one tap.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:1, background:'var(--line)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden' }}>
          {[
            {
              n:'01', t:'Reply',
              b:'Three drafts per review — Professional, Warm, Brief. Edit, then post to Google in one tap.',
              ex:'"Hi James — a 45-minute wait and cold food fall well below…"',
            },
            {
              n:'02', t:'Read',
              b:'A reputation score (35% rating, 20% volume, 25% response, 20% sentiment) updated daily, broken down so you can see what moved it.',
              ex:'78 / 100 · Rating up · Sentiment flat · Response 91%',
            },
            {
              n:'03', t:'Recover',
              b:'Negative reviews surface first, with suggested recovery offers. Staff shoutouts roll up so you know who to thank on Monday.',
              ex:'Marco · 9 mentions · "attentive without being intrusive"',
            },
          ].map(c => (
            <div key={c.n} style={{ background:'var(--surface)', padding:32 }}>
              <div className="t-mono c-accent" style={{ fontSize:11, marginBottom:18 }}>{c.n}</div>
              <h3 className="t-serif" style={{ fontSize:28, marginBottom:12, letterSpacing:'-0.01em' }}>{c.t}</h3>
              <p className="t-sm c-t2" style={{ marginBottom:18, lineHeight:1.65 }}>{c.b}</p>
              <div className="t-mono t-xs" style={{ color:'var(--t3)', padding:10, background:'var(--surface-2)', borderRadius:6, borderLeft:'2px solid var(--accent-line)' }}>
                {c.ex}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ borderTop:'1px solid var(--line)', background:'var(--surface)', padding:'80px 32px' }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div style={{ marginBottom:40, display:'grid', gridTemplateColumns:'1fr 2fr', gap:48 }}>
            <div>
              <div className="t-eyebrow c-accent">Pricing</div>
              <h2 className="t-serif" style={{ fontSize:40, lineHeight:1.05, marginTop:8 }}>Three sizes,<br/>one job.</h2>
            </div>
            <p className="t-body c-t2" style={{ alignSelf:'end', maxWidth:520, fontSize:15 }}>
              Same product, more locations. Cancel any time. Free for 30 days, no card.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0, border:'1px solid var(--line-md)', borderRadius:14, overflow:'hidden' }}>
            {[
              { plan:'Starter', price:39, locs:'1 location', comps:'3 competitor slots', best:'Single-site GMs', features:['AI reply drafts','Urgent alerts','Weekly digest','Review request campaigns'] },
              { plan:'Growth',  price:99, locs:'5 locations', comps:'5 competitor slots', best:'Small chains', features:['Everything in Starter','Reputation score','Sentiment analysis','Competitor tracking','Monthly PDF report'], highlight:true },
              { plan:'Agency',  price:199, locs:'15 locations', comps:'10 competitor slots', best:'Groups & agencies', features:['Everything in Growth','Custom reply persona','White-label PDF reports','Priority support'] },
            ].map(p => (
              <div key={p.plan} style={{
                padding:32, background: p.highlight?'var(--bg)':'var(--surface)',
                borderRight: p.plan!=='Agency' ? '1px solid var(--line-md)' : 'none',
                position:'relative',
              }}>
                {p.highlight && <div style={{ position:'absolute', top:14, right:16 }} className="pill pill-accent">Most picked</div>}
                <div className="t-eyebrow" style={{ color: p.highlight?'var(--accent)':'var(--t3)', marginBottom:12 }}>{p.plan}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:6 }}>
                  <span className="t-serif" style={{ fontSize:48, lineHeight:1 }}>${p.price}</span>
                  <span className="t-sm c-t3">/ month</span>
                </div>
                <div className="t-xs c-t3" style={{ marginBottom:24 }}>{p.locs} · {p.comps}</div>
                <div className="t-xs" style={{ color:'var(--t2)', marginBottom:14, fontStyle:'italic' }}>For: {p.best}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                      <span style={{ color:'var(--accent)', marginTop:1 }}><Ico.check s={12} sw={2.4}/></span>
                      <span className="t-sm c-t2">{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>nav('/onboard')} className={p.highlight?'btn btn-primary':'btn btn-ghost'} style={{ width:'100%' }}>
                  Start with {p.plan}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Editorial CTA */}
      <section style={{ borderTop:'1px solid var(--line)', padding:'96px 32px', background:'var(--bg)' }}>
        <div style={{ maxWidth:880, margin:'0 auto', textAlign:'center' }}>
          <h2 className="t-serif" style={{ fontSize:48, lineHeight:1.1, letterSpacing:'-0.02em', marginBottom:18 }}>
            Open the dashboard<br/>before the lunch rush.
          </h2>
          <p className="t-body c-t2" style={{ fontSize:16, marginBottom:32, maxWidth:540, margin:'0 auto 32px' }}>
            Five minutes of setup. Thirty days free. After that, $39 a month for one location.
          </p>
          <button onClick={()=>nav('/onboard')} className="btn btn-primary btn-lg">
            Find my restaurant <Ico.arrowRight s={14}/>
          </button>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

Object.assign(window, { LandingPage });
