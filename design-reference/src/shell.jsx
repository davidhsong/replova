// ── Shared shell components ──────────────────────────────────────────────────
const { useState: useStateShell, useEffect: useEffectShell } = React;

function Stars({ rating, size = 13, mono = false }) {
  return (
    <span className="stars" style={{ fontSize: size, color: mono ? 'var(--t1)' : 'var(--gold)' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= rating ? '' : 'empty'}>★</span>
      ))}
    </span>
  );
}

function Logo({ size = 22 }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      <span style={{
        fontFamily:'var(--serif)', fontSize: size, fontStyle:'italic',
        color:'var(--t1)', letterSpacing:'-0.01em', lineHeight:1, fontWeight:400,
      }}>Replova</span>
    </div>
  );
}

function Sidebar({ active }) {
  const nav = (p) => window.__nav(p);
  const items = [
    { p:'/dashboard', l:'Reviews', i:Ico.message, n: 4 },
    { p:'/dashboard/competitors', l:'Competitors', i:Ico.users },
    { p:'/dashboard/review-requests', l:'Requests', i:Ico.send },
  ];
  const lower = [
    { p:'/dashboard/billing', l:'Billing', i:Ico.card },
    { p:'/dashboard/settings', l:'Settings', i:Ico.cog },
  ];
  return (
    <aside className="sidebar">
      {/* Workspace switcher */}
      <button onClick={() => nav('/')} style={{
        display:'flex', alignItems:'center', gap:10, width:'100%',
        padding:'14px 16px', borderBottom:'1px solid var(--line)', textAlign:'left',
      }}>
        <div style={{
          width:28, height:28, borderRadius: 7, background:'var(--t1)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          color:'var(--bg)'
        }}>
          <Ico.logo s={16}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{RESTAURANT.name}</div>
          <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>1 location · Growth</div>
        </div>
        <Ico.chevDown s={12} sw={1.6} />
      </button>

      <div style={{ padding:'12px 0', flex:1, overflowY:'auto' }}>
        <div className="nav-group">
          <div style={{ fontSize:10, fontWeight:600, color:'var(--t4)', letterSpacing:'0.08em', textTransform:'uppercase', padding:'4px 10px 8px' }}>Workspace</div>
          {items.map(it => (
            <button key={it.p} onClick={() => nav(it.p)} className={`nav-item ${active===it.p?'active':''}`}>
              <span className="ico"><it.i s={14}/></span>
              <span>{it.l}</span>
              {it.n != null && <span className="nav-counter">{it.n}</span>}
            </button>
          ))}
        </div>
        <div className="nav-group" style={{ marginTop:8 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--t4)', letterSpacing:'0.08em', textTransform:'uppercase', padding:'4px 10px 8px' }}>Account</div>
          {lower.map(it => (
            <button key={it.p} onClick={() => nav(it.p)} className={`nav-item ${active===it.p?'active':''}`}>
              <span className="ico"><it.i s={14}/></span>
              <span>{it.l}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderTop:'1px solid var(--line)', padding:10 }}>
        <button onClick={() => nav('/signin')} style={{
          display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 8px', borderRadius:8,
          textAlign:'left',
        }}>
          <div style={{
            width:26, height:26, borderRadius:'50%', background:'var(--accent-sub)',
            border:'1px solid var(--accent-line)', color:'var(--accent)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            fontSize:10, fontWeight:700
          }}>MR</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--t1)' }}>Maria Rossi</div>
            <div style={{ fontSize:11, color:'var(--t3)' }}>maria@bellanapoli.com</div>
          </div>
          <span style={{ color:'var(--t3)' }}><Ico.signout s={13}/></span>
        </button>
      </div>
    </aside>
  );
}

function PageHeader({ title, subtitle, status, right, kicker }) {
  return (
    <div className="page-header" style={{ paddingBottom: 20 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
        <div style={{ minWidth:0 }}>
          {kicker && <div className="t-eyebrow" style={{ marginBottom:8 }}>{kicker}</div>}
          <h1 className="t-h1" style={{ marginBottom: subtitle ? 4 : 0 }}>{title}</h1>
          {subtitle && <div className="t-sm c-t3">{subtitle}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {status && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span className="dot dot-pos dot-pulse"></span>
              <span className="t-xs c-t3">{status}</span>
            </div>
          )}
          {right}
        </div>
      </div>
    </div>
  );
}

function TopBar({ children }) {
  return (
    <div style={{
      height: 48, padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between',
      borderBottom:'1px solid var(--line)', background:'var(--surface)',
      position:'sticky', top:0, zIndex:5,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--t3)' }}>
        {children}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <button className="btn btn-quiet btn-sm" title="Notifications"><Ico.bell s={13}/></button>
        <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('/dashboard/settings')}>
          <Ico.cog s={13}/> Settings
        </button>
      </div>
    </div>
  );
}

function Note({ children }) {
  return <div className="note" style={{ margin:'0 0 16px' }}>{children}</div>;
}

function Banner({ kind='info', title, body, onClose }) {
  const map = {
    info: { bg:'var(--surface-2)', bd:'var(--line-md)', c:'var(--t1)' },
    warn: { bg:'var(--warn-sub)', bd:'var(--warn-line)', c:'var(--warn)' },
    pos: { bg:'var(--pos-sub)', bd:'var(--pos-line)', c:'var(--pos)' },
    neg: { bg:'var(--neg-sub)', bd:'var(--neg-line)', c:'var(--neg)' },
  }[kind];
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
      background: map.bg, border:`1px solid ${map.bd}`, borderRadius: 'var(--r-5)', color: map.c
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600 }}>{title}</div>
        {body && <div style={{ fontSize:12, marginTop:2, color:'var(--t2)' }}>{body}</div>}
      </div>
      {onClose && <button onClick={onClose} style={{ color:'inherit', opacity:0.6 }}><Ico.x s={13}/></button>}
    </div>
  );
}

// Marketing nav (light cream background)
function MarketingNav() {
  const nav = (p) => window.__nav(p);
  return (
    <header style={{
      borderBottom:'1px solid var(--line)', background:'var(--bg)', position:'sticky', top:0, zIndex:30
    }}>
      <div style={{ maxWidth:1140, margin:'0 auto', padding:'0 32px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => nav('/')}><Logo size={22}/></button>
        <nav style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
          <button onClick={()=>nav('/signin')} className="btn btn-quiet btn-sm">Sign in</button>
          <button onClick={()=>nav('/onboard')} className="btn btn-primary btn-sm">Start free trial</button>
        </nav>
      </div>
    </header>
  );
}

function MarketingFooter() {
  const nav = (p) => window.__nav(p);
  const yr = new Date().getFullYear();
  return (
    <footer style={{ borderTop:'1px solid var(--line)', padding:'48px 32px 36px', background:'var(--bg)' }}>
      <div style={{ maxWidth:1140, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:32 }}>
        <div style={{ maxWidth:300 }}>
          <Logo size={20}/>
          <p className="t-xs c-t3" style={{ marginTop:14, lineHeight:1.65 }}>
            Reputation management built for restaurants. Made in New York.
          </p>
        </div>
        <div style={{ display:'flex', gap:48 }}>
          <div>
            <div className="t-eyebrow" style={{ marginBottom:12 }}>Product</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13, color:'var(--t2)' }}>
              <button onClick={()=>nav('/onboard')} style={{textAlign:'left'}}>Start trial</button>
              <button onClick={()=>nav('/signin')} style={{textAlign:'left'}}>Sign in</button>
            </div>
          </div>
          <div>
            <div className="t-eyebrow" style={{ marginBottom:12 }}>Legal</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13, color:'var(--t2)' }}>
              <button onClick={()=>nav('/terms')} style={{textAlign:'left'}}>Terms</button>
              <button onClick={()=>nav('/privacy')} style={{textAlign:'left'}}>Privacy</button>
              <button onClick={()=>nav('/refunds')} style={{textAlign:'left'}}>Refunds</button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth:1140, margin:'40px auto 0', paddingTop:20, borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t3)' }}>
        <span>© {yr} Replova, Inc.</span>
        <span>support@replova.app</span>
      </div>
    </footer>
  );
}

Object.assign(window, { Stars, Logo, Sidebar, PageHeader, TopBar, Note, Banner, MarketingNav, MarketingFooter });
