// ── Billing page ─────────────────────────────────────────────────────────────
/* DECISION: Billing avoids the 3-column comparison table cliché. Status card
   sits prominently at top with trial progress as a clear bar. Plan tiers
   below are stacked on a single typographic axis so the user reads price,
   limits, fit. Feature parity is shown with explicit "everything in X +" not
   a check-mark grid. */

function TrialBar({ day=12, of=30 }) {
  const pct = (day/of)*100;
  return (
    <div style={{ width:'100%', height:6, background:'var(--surface-2)', borderRadius:3, overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:'var(--accent)', borderRadius:3, transition:'width 0.4s' }}/>
    </div>
  );
}

function UsageBar({ used, total, label, warn=0.8, danger=1 }) {
  const pct = Math.min((used/total)*100, 100);
  const color = used/total >= danger ? 'var(--neg)' : used/total >= warn ? 'var(--warn)' : 'var(--pos)';
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
        <span className="t-sm c-t2">{label}</span>
        <span className="tnum t-sm" style={{ fontWeight:600 }}>{used} <span className="c-t3">/ {total}</span></span>
      </div>
      <div style={{ height:6, background:'var(--surface-2)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background: color, borderRadius:3 }}/>
      </div>
    </div>
  );
}

function BillingPage() {
  const current = 'growth';
  const dayOfTrial = 12;

  const plans = [
    { k:'starter', n:'Starter', p:39, locs:1, comps:3, best:'Single-site GM',
      features:[
        'AI reply drafts (3 variants)',
        'Urgent review alerts',
        'Weekly digest email',
        'Review request campaigns',
      ],
      missing:['Reputation score','Sentiment analysis','Competitor tracking','Monthly PDF report','Custom reply persona'],
    },
    { k:'growth',  n:'Growth',  p:99, locs:5, comps:5, best:'Small chains',
      features:[
        'Everything in Starter, plus:',
        'Reputation score (composite)',
        'Sentiment analysis & trend',
        'Competitor tracking',
        'Monthly PDF report',
      ],
      missing:['Custom reply persona','White-label PDF reports'],
    },
    { k:'agency',  n:'Agency',  p:199, locs:15, comps:10, best:'Groups & agencies',
      features:[
        'Everything in Growth, plus:',
        'Custom reply persona',
        'White-label PDF reports',
        'Priority support',
      ],
      missing:[],
    },
  ];

  return (
    <div className="app">
      <Sidebar active="/dashboard/billing"/>
      <div className="main">
        <TopBar>
          <span style={{ color:'var(--t2)' }}>Workspace</span>
          <Ico.chevRight s={10}/>
          <span style={{ color:'var(--t1)', fontWeight:600 }}>Billing</span>
        </TopBar>

        <div className="page-header" style={{ maxWidth:1040 }}>
          <Note>{`/* Layout decision: status-first, comparison-second.\n   No grid of checkmarks. Plans show "Everything in X + ..." on one\n   typographic axis so the upgrade story reads as a sentence.\n*/`}</Note>
          <PageHeader title="Billing" subtitle="Bella Napoli"/>
        </div>

        <div className="page-body" style={{ maxWidth:1040 }}>
          {/* Status card */}
          <div className="card" style={{ padding:28, marginBottom:32, display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:32 }}>
            <div>
              <div className="t-eyebrow" style={{ marginBottom:8 }}>Current plan</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:4 }}>
                <h2 className="t-serif" style={{ fontSize:36, lineHeight:1, letterSpacing:'-0.02em' }}>Growth</h2>
                <span className="pill pill-accent">Free trial</span>
              </div>
              <div className="t-sm c-t2" style={{ marginBottom:24 }}>
                <span className="tnum" style={{ fontWeight:600, color:'var(--t1)' }}>$99</span> / month, billed monthly
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                  <span className="t-eyebrow">Trial · day {dayOfTrial} of 30</span>
                  <span className="t-xs c-t3"><strong className="c-t1 tnum">{30-dayOfTrial} days</strong> remaining</span>
                </div>
                <TrialBar day={dayOfTrial}/>
                <div className="t-xs c-t3" style={{ marginTop:8 }}>First charge: <strong className="c-t1">May 13, 2026</strong>. Cancel any time before then, no charge.</div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm">Add payment method</button>
                <button className="btn btn-ghost btn-sm">Manage in Stripe <Ico.external s={11}/></button>
              </div>
            </div>

            <div style={{ borderLeft:'1px solid var(--line)', paddingLeft:32, display:'flex', flexDirection:'column', gap:16 }}>
              <div className="t-eyebrow">Usage this month</div>
              <UsageBar used={1} total={5} label="Locations"/>
              <UsageBar used={3} total={5} label="Competitor slots / location"/>
              <UsageBar used={28} total={'∞'} label="Reviews synced"/>
              <UsageBar used={142} total={500} label="Review requests sent" warn={0.7}/>
            </div>
          </div>

          {/* Plan ladder */}
          <div style={{ marginBottom:18, display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
            <h3 className="t-h2" style={{ fontSize:18 }}>Change plan</h3>
            <span className="t-xs c-t3">Stripe will prorate any change</span>
          </div>

          <div style={{ border:'1px solid var(--line-md)', borderRadius:14, overflow:'hidden' }}>
            {plans.map((p, i) => {
              const isCurrent = p.k === current;
              return (
                <div key={p.k} style={{
                  display:'grid', gridTemplateColumns:'200px 1fr 240px', gap:32,
                  padding:'28px 32px',
                  borderTop: i>0 ? '1px solid var(--line)' : 'none',
                  background: isCurrent ? 'var(--surface)' : 'transparent',
                  alignItems:'flex-start',
                }}>
                  <div>
                    <div className="t-eyebrow" style={{ color: isCurrent ? 'var(--accent)' : 'var(--t3)', marginBottom:8 }}>{p.n}</div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
                      <span className="t-serif" style={{ fontSize:36, lineHeight:1 }}>${p.p}</span>
                      <span className="t-xs c-t3">/ mo</span>
                    </div>
                    <div className="t-xs c-t3">{p.locs} location{p.locs>1?'s':''} · {p.comps} competitor slots</div>
                    <div className="t-xs" style={{ color:'var(--t2)', marginTop:10, fontStyle:'italic' }}>For: {p.best}</div>
                    {isCurrent && <div className="pill pill-accent" style={{ marginTop:14 }}><Ico.check s={10} sw={2.6}/> Current plan</div>}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13, lineHeight:1.55, paddingTop:4 }}>
                    {p.features.map((f, fi) => (
                      <div key={fi} style={{ display:'flex', alignItems:'flex-start', gap:8, color: fi===0 && f.startsWith('Everything') ? 'var(--t3)' : 'var(--t2)' }}>
                        <span style={{ color:'var(--accent)', marginTop:1, flexShrink:0 }}><Ico.check s={11} sw={2.4}/></span>
                        <span>{f}</span>
                      </div>
                    ))}
                    {p.missing.map((f, fi) => (
                      <div key={'m'+fi} style={{ display:'flex', alignItems:'flex-start', gap:8, color:'var(--t4)' }}>
                        <span style={{ color:'var(--t4)', marginTop:1, flexShrink:0, fontSize:11, opacity:0.6 }}><Ico.x s={10} sw={1.6}/></span>
                        <span style={{ textDecoration:'line-through', textDecorationColor:'var(--line-md)' }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:8, justifySelf:'end', alignItems:'flex-end' }}>
                    {isCurrent ? (
                      <button className="btn btn-ghost" style={{ width:200 }} disabled>You're on this plan</button>
                    ) : p.p > 99 ? (
                      <>
                        <button className="btn btn-primary" style={{ width:200 }}>Upgrade to {p.n}</button>
                        <span className="t-xs c-t3">+${p.p - 99}/mo · prorated</span>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-ghost" style={{ width:200 }}>Downgrade</button>
                        <span className="t-xs c-t3">Effective May 13</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:32, padding:'18px 22px', background:'var(--surface-2)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>Need help choosing?</div>
              <div className="t-xs c-t3">Email a real human. Usually back within an hour.</div>
            </div>
            <a href="mailto:support@replova.app" className="btn btn-ghost btn-sm">support@replova.app <Ico.external s={11}/></a>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BillingPage });
