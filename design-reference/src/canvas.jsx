// ── Canvas overview: every artboard at a glance ─────────────────────────────
const { useState: useStateC } = React;

function NavTile({ to, title, sub, kicker, color, icon }) {
  const nav = (p) => window.__nav(p);
  return (
    <button onClick={()=>nav(to)} style={{
      display:'flex', flexDirection:'column', alignItems:'flex-start',
      padding:'18px 18px 16px', background:'var(--surface)',
      border:'1px solid var(--line)', borderRadius:12,
      textAlign:'left', minHeight:130, position:'relative',
      transition:'border-color 0.12s, transform 0.12s, box-shadow 0.12s',
    }}
    onMouseEnter={(e)=>{e.currentTarget.style.borderColor='var(--line-hi)'; e.currentTarget.style.boxShadow='var(--shadow-2)';}}
    onMouseLeave={(e)=>{e.currentTarget.style.borderColor='var(--line)'; e.currentTarget.style.boxShadow='none';}}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'auto' }}>
        <span style={{
          width:28, height:28, borderRadius:6,
          background:color || 'var(--surface-2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff', fontSize:13, fontWeight:700,
          fontFamily:'var(--serif)',
        }}>{icon}</span>
        <span className="t-eyebrow">{kicker}</span>
      </div>
      <div style={{ marginTop:18 }}>
        <div className="t-h3" style={{ marginBottom:4 }}>{title}</div>
        <div className="t-xs c-t3" style={{ lineHeight:1.4 }}>{sub}</div>
      </div>
      <Ico.arrowRight s={14} style={{ position:'absolute', top:18, right:18, color:'var(--t3)' }}/>
    </button>
  );
}

function CanvasOverviewPage() {
  const groups = [
    {
      title:'Marketing & onboarding',
      kicker:'01',
      tiles:[
        { to:'/',         kicker:'Landing',     icon:'L', color:'#14120c', title:'Landing page',      sub:'Hero, social proof, three-step setup, pricing, testimonials' },
        { to:'/signin',   kicker:'Auth',        icon:'S', color:'#4d4a40', title:'Sign in',           sub:'Magic link · split layout with editorial moment' },
        { to:'/onboard',  kicker:'Auth',        icon:'O', color:'#4d4a40', title:'Onboarding · 4 steps', sub:'Find restaurant → connect Google → invite team → import history' },
      ]
    },
    {
      title:'Product · web',
      kicker:'02',
      tiles:[
        { to:'/dashboard',           kicker:'Dashboard',  icon:'D', color:'var(--accent)', title:'Reviews dashboard', sub:'Score, sentiment, review feed, urgent items, AI reply composer' },
        { to:'/dashboard/empty',     kicker:'Empty state',icon:'∅', color:'var(--t1)',     title:'Empty state · day one', sub:'Editorial — three things to know while waiting for first review' },
        { to:'/dashboard/competitors', kicker:'Compete',  icon:'C', color:'#1f6f4a',       title:'Competitor watch', sub:'Live tracking of 3 nearby restaurants — score, sentiment, deltas' },
        { to:'/dashboard/review-requests', kicker:'Requests', icon:'R', color:'var(--accent)', title:'Review requests',  sub:'SMS/email campaigns, QR table tents, conversion funnel' },
        { to:'/dashboard/settings',  kicker:'Settings',   icon:'⚙', color:'var(--t2)',     title:'Settings',          sub:'Brand voice, auto-reply rules, response tone, integrations' },
        { to:'/dashboard/billing',   kicker:'Billing',    icon:'$', color:'var(--t2)',     title:'Billing',           sub:'Plan, usage, invoices, payment method' },
      ]
    },
    {
      title:'Mobile · iPhone',
      kicker:'03',
      tiles:[
        { to:'/mobile', kicker:'Mobile', icon:'M', color:'#14120c', title:'iPhone — three screens', sub:'Review feed · reply composer · score breakdown' },
      ]
    },
    {
      title:'Email & content',
      kicker:'04',
      tiles:[
        { to:'/emails',  kicker:'Email',  icon:'@', color:'#4d4a40', title:'Email templates',     sub:'Weekly digest · negative-review alert · review request' },
        { to:'/privacy', kicker:'Legal',  icon:'§', color:'var(--t3)',title:'Legal pages',        sub:'Privacy · terms · refunds — editorial long-form' },
      ]
    },
  ];

  const stats = [
    { l:'Pages',         v:'14' },
    { l:'Email templates',v:'3' },
    { l:'Mobile screens', v:'3' },
    { l:'Tweak axes',     v:'6' },
  ];

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)' }}>
      {/* Top header */}
      <div style={{ borderBottom:'1px solid var(--line)', padding:'18px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Logo size={18}/>
          <div className="vr" style={{ height:18 }}/>
          <span className="t-eyebrow">Design canvas</span>
        </div>
        <div style={{ display:'flex', gap:6, fontSize:12, color:'var(--t3)' }}>
          <span className="t-mono">v0.4</span>
          <span>·</span>
          <span>Apr 25 · Maria's review</span>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'56px 32px 80px' }}>
        {/* Editorial intro */}
        <div className="t-eyebrow" style={{ marginBottom:14 }}>Replova · reputation management for restaurants</div>
        <h1 className="t-display" style={{ fontSize:64, marginBottom:24, maxWidth:920 }}>
          A reputation tool that <span className="t-italic" style={{ color:'var(--accent)' }}>reads like</span> The Economist, not a CRM.
        </h1>
        <p style={{ fontSize:17, lineHeight:1.55, color:'var(--t2)', maxWidth:680, marginBottom:36 }}>
          Fourteen artboards across web, mobile, and email — built around the idea that restaurant owners don't want a dashboard. They want to know what just happened, what to do about it, and to get back to service.
        </p>

        {/* stats row */}
        <div style={{ display:'flex', gap:0, border:'1px solid var(--line)', borderRadius:8, marginBottom:64, background:'var(--surface)', maxWidth:560 }}>
          {stats.map((s,i) => (
            <div key={s.l} style={{ flex:1, padding:'14px 18px', borderRight: i<stats.length-1?'1px solid var(--line)':'none' }}>
              <div className="t-eyebrow" style={{ marginBottom:4 }}>{s.l}</div>
              <div className="t-serif tnum" style={{ fontSize:28, lineHeight:1 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Groups */}
        {groups.map((g,gi) => (
          <section key={g.title} style={{ marginBottom:56 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:20, paddingBottom:14, borderBottom:'1px solid var(--line)' }}>
              <span className="t-mono c-t4" style={{ fontSize:11 }}>{g.kicker}</span>
              <h2 className="t-h2">{g.title}</h2>
              <span className="t-xs c-t4" style={{ marginLeft:'auto' }}>{g.tiles.length} {g.tiles.length===1?'artboard':'artboards'}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
              {g.tiles.map(t => <NavTile key={t.to} {...t}/>)}
            </div>
          </section>
        ))}

        {/* Design notes */}
        <section style={{ marginTop:80, padding:'40px 0 0', borderTop:'1px solid var(--line)' }}>
          <div className="t-eyebrow" style={{ marginBottom:14 }}>05 · Design notes</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:32, maxWidth:880 }}>
            {[
              { h:'Why warm neutrals',
                p:'Off-white paper (#faf9f6) and graphite text — not gray. Restaurant owners read this on phones in dim dining rooms; cool white burns. Terracotta accent appears <40 times across the whole product.' },
              { h:'Why serifs for negative reviews',
                p:'Instrument Serif italic gives a 1-star review the gravity it deserves. UI sans renders criticism as data; serif renders it as someone saying something. The reply you write should feel proportional.' },
              { h:'One accent, used sparingly',
                p:'Terracotta means "look here." It marks the score, the urgent badge, the primary CTA, and nothing else. The Tweaks panel ships four alternatives — all jewel tones, all single-accent.' },
              { h:'Hairlines over shadows',
                p:'1px lines at 8% black do the work cards usually try to do with shadows. The result is denser, calmer, and reads better at a glance — closer to a balance sheet than a SaaS app.' },
            ].map(n => (
              <div key={n.h}>
                <div className="t-h3" style={{ marginBottom:8 }}>{n.h}</div>
                <p className="t-sm c-t2" style={{ lineHeight:1.6 }}>{n.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div style={{ marginTop:80, paddingTop:32, borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'var(--t3)' }}>
          <span>Toggle <strong style={{ color:'var(--t1)' }}>Tweaks</strong> in the toolbar to switch theme, accent, density, and signature variants.</span>
          <span className="t-mono">replova.com</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CanvasOverviewPage });
