// ── Email templates ─────────────────────────────────────────────────────────
const { useState: useStateE } = React;

function EmailFrame({ subject, preview, children }) {
  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <div className="t-eyebrow" style={{ marginBottom:4 }}>Subject</div>
        <div style={{ fontSize:14, fontWeight:600 }}>{subject}</div>
        <div className="t-xs c-t3" style={{ marginTop:2 }}>Preview: {preview}</div>
      </div>
      <div className="email-frame">
        {children}
      </div>
    </div>
  );
}

function EmailHeader({ kicker }) {
  return (
    <div style={{ padding:'24px 32px 20px', borderBottom:'1px solid #e8e6df', background:'#faf9f6' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontFamily:'var(--serif)', fontSize:20, fontStyle:'italic', color:'#14120c', letterSpacing:'-0.01em' }}>Replova</div>
        <div className="t-eyebrow" style={{ color:'#807c70' }}>{kicker}</div>
      </div>
    </div>
  );
}

function EmailFooter() {
  return (
    <div style={{ padding:'18px 32px', borderTop:'1px solid #e8e6df', background:'#faf9f6', fontSize:11, color:'#807c70', display:'flex', justifyContent:'space-between' }}>
      <span>Replova · 12 Greene St, NYC</span>
      <span><a href="#" style={{ color:'#807c70', textDecoration:'underline' }}>Manage emails</a></span>
    </div>
  );
}

function DigestEmail() {
  return (
    <EmailFrame subject="Bella Napoli · 28 reviews this week (3 need a reply)" preview="Score 78 ↑4 · sentiment up · Marco mentioned 9 times">
      <EmailHeader kicker="Weekly digest · Apr 25"/>
      <div style={{ padding:'32px 32px 24px' }}>
        <div className="t-eyebrow" style={{ marginBottom:12, color:'#807c70' }}>Bella Napoli · week of Apr 19</div>
        <h1 style={{ fontFamily:'var(--serif)', fontSize:32, lineHeight:1.1, letterSpacing:'-0.02em', color:'#14120c', marginBottom:14 }}>
          A solid week. Three things to do before lunch.
        </h1>
        <p style={{ fontSize:14, lineHeight:1.6, color:'#4d4a40', marginBottom:24 }}>
          Score is up four points to 78. Sentiment crept higher all week — Marco was mentioned by name nine times. Three negative reviews are still waiting on a reply.
        </p>

        {/* Score row */}
        <div style={{ display:'flex', gap:0, border:'1px solid #e8e6df', borderRadius:8, marginBottom:24, overflow:'hidden' }}>
          {[
            { l:'Score', v:'78', d:'+4' },
            { l:'Rating', v:'4.3★', d:null },
            { l:'New', v:'28', d:'+6' },
            { l:'To reply', v:'3', d:null, c:'#b73a2a' },
          ].map((s,i) => (
            <div key={s.l} style={{ flex:1, padding:'14px 16px', borderRight: i<3 ? '1px solid #e8e6df' : 'none' }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#807c70', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{s.l}</div>
              <div style={{ fontFamily:'var(--serif)', fontSize:24, color: s.c || '#14120c' }}>{s.v} {s.d && <span style={{ fontSize:11, color:'#1f6f4a', fontFamily:'var(--ui)', fontWeight:600, marginLeft:4 }}>{s.d}</span>}</div>
            </div>
          ))}
        </div>

        {/* Action items */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#807c70', marginBottom:12 }}>This week's action items</div>
          {[
            'Reply to James K. (2★, "cold pasta") — 3 days old',
            'Reply to Priya N. (1★, hygiene complaint) — escalate',
            'Thank Marco — 9 customer mentions; he carried the week',
          ].map((a,i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom: i<2?'1px solid #e8e6df':'none' }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'#807c70', paddingTop:2 }}>{(i+1).toString().padStart(2,'0')}</span>
              <span style={{ fontSize:14, color:'#14120c', lineHeight:1.5 }}>{a}</span>
            </div>
          ))}
        </div>

        {/* Top quote */}
        <div style={{ borderLeft:'3px solid #1f6f4a', paddingLeft:18, marginBottom:24 }}>
          <p style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:18, lineHeight:1.45, color:'#14120c', marginBottom:8 }}>
            "Best carbonara outside Rome. Marco was attentive without being intrusive."
          </p>
          <div style={{ fontSize:12, color:'#807c70' }}>Sofia L. · 5★ · Apr 24</div>
        </div>

        <a href="#" style={{ display:'inline-block', background:'#14120c', color:'#faf9f6', padding:'10px 18px', borderRadius:999, fontSize:13, fontWeight:600 }}>Open dashboard →</a>
      </div>
      <EmailFooter/>
    </EmailFrame>
  );
}

function AlertEmail() {
  return (
    <EmailFrame subject="⚠ 1★ review just landed — Bella Napoli" preview="Priya N. — hair in food, dismissive manager">
      <EmailHeader kicker="Negative review · Apr 25 · 11:42am"/>
      <div style={{ padding:0 }}>
        {/* Red rail */}
        <div style={{ borderTop:'3px solid #b73a2a', padding:'28px 32px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', background:'rgba(183,58,42,0.10)', color:'#b73a2a', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.04em' }}>Urgent · 1-star</span>
            <span style={{ fontSize:12, color:'#807c70' }}>Posted 6 minutes ago</span>
          </div>
          <h1 style={{ fontFamily:'var(--serif)', fontSize:26, lineHeight:1.15, color:'#14120c', marginBottom:18 }}>
            A 1-star review needs your attention.
          </h1>
          <div style={{ background:'#faf9f6', border:'1px solid #e8e6df', borderRadius:8, padding:18, marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <strong style={{ fontSize:14 }}>Priya N.</strong>
              <span style={{ color:'#c08725', fontSize:13 }}>★☆☆☆☆</span>
            </div>
            <p style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:16, lineHeight:1.5, color:'#14120c' }}>
              "Found a hair in my food and when I raised it with the manager, they were dismissive and offered nothing. Absolutely shocking. Never coming back."
            </p>
          </div>

          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#807c70', marginBottom:10 }}>Suggested reply (Professional)</div>
          <div style={{ background:'#fff', border:'1px solid #e8e6df', borderRadius:8, padding:14, fontSize:13, lineHeight:1.6, color:'#4d4a40', marginBottom:18 }}>
            Priya — I am deeply sorry. Finding something in your food is unacceptable, and how it was handled afterwards compounded the failure. This is not who we are. Please email me directly at maria@bellanapoli.com and I will personally see this resolved.
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <a href="#" style={{ display:'inline-block', background:'#b94a2c', color:'#fff', padding:'10px 18px', borderRadius:999, fontSize:13, fontWeight:600 }}>Review and post →</a>
            <a href="#" style={{ display:'inline-block', border:'1px solid #d4d1c8', color:'#14120c', padding:'9px 18px', borderRadius:999, fontSize:13, fontWeight:500 }}>Open in app</a>
          </div>
        </div>
      </div>
      <EmailFooter/>
    </EmailFrame>
  );
}

function RequestEmail() {
  return (
    <EmailFrame subject="A quick favor from Bella Napoli" preview="If you have 30 seconds, it would mean a lot.">
      <EmailHeader kicker="Apr 25"/>
      <div style={{ padding:'32px 32px 28px' }}>
        <p style={{ fontSize:14, color:'#4d4a40', marginBottom:18 }}>Hi Eleanor,</p>
        <p style={{ fontFamily:'var(--serif)', fontSize:22, lineHeight:1.35, color:'#14120c', marginBottom:18, letterSpacing:'-0.01em' }}>
          Thank you for joining us last Friday — we hope the carbonara lived up to it.
        </p>
        <p style={{ fontSize:14, lineHeight:1.65, color:'#4d4a40', marginBottom:18 }}>
          We're a small, family-run kitchen, and Google reviews are how new neighbors find us. If you have 30 seconds, a few honest words would mean a great deal.
        </p>
        <a href="#" style={{ display:'inline-block', background:'#14120c', color:'#faf9f6', padding:'12px 22px', borderRadius:999, fontSize:14, fontWeight:600, marginBottom:24 }}>Leave a review on Google →</a>
        <p style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:15, color:'#4d4a40', marginBottom:6 }}>Thank you,</p>
        <p style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:15, color:'#14120c' }}>Maria & the team at Bella Napoli</p>
      </div>
      <EmailFooter/>
    </EmailFrame>
  );
}

function EmailsPage() {
  const [tab, setTab] = useStateE('digest');
  return (
    <div className="app">
      <Sidebar active=""/>
      <div className="main">
        <TopBar><span style={{ color:'var(--t1)', fontWeight:600 }}>Email templates</span></TopBar>
        <div className="page-header">
          <Note>{`/* Inbox-rendered emails using the same restraint as the product:\n   serif headlines, hairline dividers, one accent. Designed for 600px width\n   and table-safe — no flex on real client.\n*/`}</Note>
          <PageHeader title="Email templates" subtitle="Three transactional emails: weekly digest, urgent alert, customer request"/>
        </div>
        <div className="page-body">
          <div className="tabs" style={{ marginBottom:32 }}>
            {[
              { k:'digest', l:'Weekly digest' },
              { k:'alert',  l:'Negative-review alert' },
              { k:'request', l:'Review request' },
            ].map(t => (
              <button key={t.k} onClick={()=>setTab(t.k)} className={`tab ${tab===t.k?'active':''}`}>{t.l}</button>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'center', padding:'20px 0 60px', background:'var(--surface-2)', borderRadius:12 }}>
            {tab === 'digest' && <DigestEmail/>}
            {tab === 'alert' && <AlertEmail/>}
            {tab === 'request' && <RequestEmail/>}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EmailsPage });
