
const { useState, useMemo } = React;

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_REVIEWS = [
  {
    id:'1', author:'James K.', rating:2,
    review_text:"Service was really slow tonight and my pasta came out cold. The waiter was nice but the kitchen was clearly backed up. We waited 45 minutes for our mains. Won't be returning.",
    reply_draft_1:"Hi James, thank you for sharing this feedback. I'm truly sorry your experience fell below our standards — a 45-minute wait and cold food is completely unacceptable. I'd love the chance to make this right. Please reach out to us directly and I'll personally ensure your next visit is everything it should have been.",
    reply_draft_2:"Hi James — I'm so sorry! Cold pasta and a long wait is not what we're about at all. We really dropped the ball and I want to fix it. Please reach out to us directly and we'll take care of you. Thank you for being honest with us.",
    reply_draft_3:"Hi James, I sincerely apologize for the slow service and cold food. That's not acceptable. Please contact us directly so we can make it right.",
    status:'drafted', review_timestamp: Math.floor(Date.now()/1000)-7200,
    created_at: new Date(Date.now()-7200000).toISOString(),
  },
  {
    id:'2', author:'Priya N.', rating:1,
    review_text:"Terrible experience. Found a hair in my food and when I raised it with the manager, they were dismissive and offered nothing. Absolutely shocking service. Never coming back.",
    reply_draft_1:"Hi Priya, I am deeply sorry about your experience. Finding something in your food is completely unacceptable, and the way our manager handled it was not at all up to our standards. I'd like to personally address this — please contact us at hello@restaurant.com and I'll make sure this is resolved properly.",
    reply_draft_2:"Priya, I'm so sorry this happened. That's a serious concern and you deserved far better from us — both with the food and with how it was handled afterward. Please reach out to me directly so I can make this right personally.",
    reply_draft_3:"Hi Priya, I sincerely apologize. This is unacceptable and I want to address it immediately. Please contact us directly.",
    status:'drafted', review_timestamp: Math.floor(Date.now()/1000)-3600,
    created_at: new Date(Date.now()-3600000).toISOString(),
  },
  {
    id:'3', author:'Sofia L.', rating:5,
    review_text:"Absolutely amazing! The carbonara was the best I've had outside of Rome. Service was attentive without being intrusive, and the atmosphere was perfect for our anniversary. Will definitely be back.",
    reply_draft_1:"Hi Sofia, thank you so much — this made our whole team smile! We're thrilled the carbonara lived up to Roman standards; that's the highest compliment for our chef. Congratulations on your anniversary, and we can't wait to welcome you back!",
    reply_draft_2:"Sofia, this just made our day! You chose us for your anniversary and we're so honoured. The carbonara is our chef's absolute pride — so glad it hit the mark. We look forward to seeing you again soon!",
    reply_draft_3:"Thank you, Sofia! So glad you loved the carbonara and had a wonderful anniversary with us. We look forward to seeing you again!",
    status:'drafted', review_timestamp: Math.floor(Date.now()/1000)-86400,
    created_at: new Date(Date.now()-86400000).toISOString(),
  },
  {
    id:'4', author:'Marco R.', rating:4,
    review_text:"Really enjoyed the food — the truffle pizza was excellent. Service was a bit slow at first but picked up. Would come back for the food alone. Atmosphere is cozy and intimate.",
    reply_draft_1:"Hi Marco, thank you for the kind words about our truffle pizza — it's one of our personal favourites! We appreciate your patience with the service early on and are glad it improved. We look forward to welcoming you back soon!",
    reply_draft_2:"Marco, thanks so much! The truffle pizza is something we're really proud of, so glad you loved it. We hear you on the service timing and we're always working to improve. Hope to see you back soon!",
    reply_draft_3:"Thank you, Marco! Great to hear you enjoyed the truffle pizza. We look forward to seeing you again!",
    status:'replied', review_timestamp: Math.floor(Date.now()/1000)-432000,
    created_at: new Date(Date.now()-432000000).toISOString(),
  },
  {
    id:'5', author:'David W.', rating:3,
    review_text:"Food was decent, nothing spectacular. The pasta was a bit overcooked and the sauce lacked depth. The staff were friendly though and the place was clean. Probably wouldn't go out of my way to return.",
    reply_draft_1:"Hi David, thank you for the honest feedback. We're glad you found the team friendly and the space welcoming, but we're sorry the pasta wasn't at its best. Consistency is something we take seriously and we'll be using this with our kitchen team. We'd love to win you over on a second visit.",
    reply_draft_2:"David, thanks for sharing your thoughts! Sorry the pasta didn't quite hit the mark — that's really valuable feedback for us. We're always refining our dishes and hope you'll give us another chance to impress you.",
    reply_draft_3:"Thank you, David. We'll work on improving our pasta dishes and hope to see you again soon.",
    status:'drafted', review_timestamp: Math.floor(Date.now()/1000)-259200,
    created_at: new Date(Date.now()-259200000).toISOString(),
  },
];

const RESTAURANT = { name:'Bella Napoli', location:'New York, NY' };

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000), now = Date.now(), diff = now - d;
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000)return `${Math.floor(diff/86400000)}d ago`;
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function isOverdue(createdAt) { return Date.now() - new Date(createdAt).getTime() > 3*24*3600*1000; }

function Stars({ rating, sz=12 }) {
  return (
    <span style={{fontSize:sz,letterSpacing:1}}>
      {[1,2,3,4,5].map(i => <span key={i} style={{color:i<=rating?'#f59e0b':'rgba(255,255,255,0.1)'}}>{i<=rating?'★':'★'}</span>)}
    </span>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ active }) {
  const nav = p => window.__nav(p);
  const items = [
    { path:'/dashboard', label:'Reviews',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
    { path:'/dashboard/settings', label:'Settings',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
    { path:'/dashboard/billing', label:'Billing',
      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  ];

  return (
    <aside className="sidebar">
      <div style={{padding:'14px 10px 10px',borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav('/')} style={{background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:9,padding:'4px 4px',borderRadius:10,width:'100%'}}>
          <div style={{width:30,height:30,background:'var(--accent)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <span className="logo-txt" style={{fontSize:14,fontWeight:800,color:'var(--t1)',letterSpacing:'-0.025em'}}>Replova</span>
        </button>
      </div>

      <div className="sidebar-body" style={{paddingTop:12}}>
        {items.map(item => (
          <button key={item.path} onClick={() => nav(item.path)} className={`nav-item ${active===item.path?'active':''}`}>
            {item.icon}
            <span className="nav-lbl">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <button onClick={() => nav('/signin')}
          style={{background:'none',border:'none',display:'flex',alignItems:'center',gap:9,cursor:'pointer',fontFamily:'inherit',width:'100%',padding:'8px 8px',borderRadius:9,transition:'background .12s'}}
          onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'var(--accent-sub)',border:'1px solid oklch(0.61 0.2 258/.25)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:10,fontWeight:800,color:'var(--accent)'}}>
            BN
          </div>
          <div style={{flex:1,minWidth:0,textAlign:'left'}}>
            <div className="usr-name" style={{fontSize:12,fontWeight:600,color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Bella Napoli</div>
            <div className="usr-name" style={{fontSize:11,color:'var(--t3)',marginTop:1}}>Free trial</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,color:'var(--t3)'}}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </aside>
  );
}

// ── Review row ────────────────────────────────────────────────────────────────
const REPLY_LABELS = [
  {key:'reply_draft_1',label:'Professional'},
  {key:'reply_draft_2',label:'Warm'},
  {key:'reply_draft_3',label:'Brief'},
];

function ReviewRow({ review, isReplied, onToggle }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('reply_draft_1');
  const [copied, setCopied] = useState(false);

  const low    = review.rating <= 2;
  const overdue= !isReplied && isOverdue(review.created_at);
  const text   = review[tab];

  function copy() {
    navigator.clipboard?.writeText(text).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  return (
    <div className={`review-row ${open?'open':''} ${isReplied?'replied':''}`}>
      <div style={{display:'flex',alignItems:'center'}}>
        <button onClick={() => setOpen(o=>!o)} style={{flex:1,display:'flex',alignItems:'center',gap:14,padding:'13px 16px',background:'none',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit',minWidth:0}}>
          {/* Stars */}
          <div style={{flexShrink:0,width:58}}>
            <Stars rating={review.rating} sz={11}/>
            <div style={{fontSize:10,color:'var(--t3)',marginTop:2}}>{review.rating}/5</div>
          </div>
          {/* Author + preview */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3,flexWrap:'wrap'}}>
              <span style={{fontSize:13,fontWeight:600,color:isReplied?'var(--t3)':'var(--t1)',textDecoration:isReplied?'line-through':'none'}}>
                {review.author||'Anonymous'}
              </span>
              {low && !isReplied   && <span className="badge badge-red">Urgent</span>}
              {!low && overdue     && <span className="badge badge-amber">Overdue</span>}
              {isReplied           && <span className="badge badge-green">Replied</span>}
            </div>
            <p style={{fontSize:12,color:'var(--t3)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {review.review_text?.slice(0,96)}{review.review_text?.length>96?'…':''}
            </p>
          </div>
          {/* Date + chevron */}
          <div style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5}}>
            <span style={{fontSize:12,color:'var(--t3)'}}>{formatDate(review.review_timestamp)}</span>
            <svg style={{color:'var(--t3)',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0)'}}
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </button>
        {/* Check */}
        <div style={{padding:'0 16px 0 4px',flexShrink:0}}>
          <button onClick={e=>{e.stopPropagation();onToggle();}} className={`check-btn ${isReplied?'done':''}`} title={isReplied?'Mark needs reply':'Mark as replied'}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div className="fade-in" style={{padding:'0 16px 16px',borderTop:'1px solid var(--border)'}}>
          {/* Review quote */}
          <div style={{margin:'16px 0',paddingLeft:14,borderLeft:'2px solid var(--border-md)'}}>
            <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.7,fontStyle:'italic',margin:0}}>
              "{review.review_text||'No review text.'}"
            </p>
          </div>
          {/* Metadata pills */}
          <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
            {low && !isReplied && <span style={{fontSize:12,color:'var(--err)',fontWeight:500}}>⚠ Prioritise this response</span>}
            {!low && overdue && <span style={{fontSize:12,color:'var(--warn)',fontWeight:500}}>⏰ Waiting 3+ days for a reply</span>}
            {isReplied && <span style={{fontSize:12,color:'var(--ok)',fontWeight:500}}>✓ Already replied on Google</span>}
          </div>

          {/* Reply drafts */}
          {(review.reply_draft_1||review.reply_draft_2||review.reply_draft_3) ? (
            <>
              <div style={{display:'flex',gap:4,marginBottom:12,background:'var(--surface-0)',borderRadius:10,padding:4,width:'fit-content',border:'1px solid var(--border)'}}>
                {REPLY_LABELS.map(({key,label}) => (
                  <button key={key} onClick={() => setTab(key)} className={`draft-tab ${tab===key?'active':''}`}>{label}</button>
                ))}
              </div>
              {text && (
                <div style={{background:'var(--surface-0)',border:'1px solid var(--border-md)',borderRadius:12,padding:'14px 16px'}}>
                  <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.75,margin:'0 0 14px'}}>{text}</p>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                    <button onClick={onToggle} className="btn btn-sm btn-ghost" style={{borderRadius:8}}>
                      {isReplied?'Undo replied':'Mark as replied'}
                    </button>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={copy} className="btn btn-sm btn-ghost" style={{borderRadius:8}}>
                        {copied?'✓ Copied':'Copy'}
                      </button>
                      <button className="btn btn-sm btn-primary" style={{borderRadius:8}}>
                        Reply on Google ↗
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <p style={{fontSize:12,color:'var(--t3)',fontStyle:'italic'}}>Draft not yet generated.</p>
              <button onClick={onToggle} className="btn btn-sm btn-ghost" style={{borderRadius:8}}>{isReplied?'Undo':'Mark replied'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────
function DashboardPage({ tweaks }) {
  const [localStatus, setLocalStatus] = useState({});
  const [tab, setTab] = useState('needs-reply');
  const [rating, setRating] = useState('all');
  const [search, setSearch] = useState('');

  const getStatus  = r => localStatus[r.id] ?? r.status;
  const isReplied  = r => getStatus(r) === 'replied';
  const toggleStatus = r => {
    const next = isReplied(r) ? 'drafted' : 'replied';
    setLocalStatus(p=>({...p,[r.id]:next}));
  };

  const total      = MOCK_REVIEWS.length;
  const needsCnt   = MOCK_REVIEWS.filter(r=>!isReplied(r)).length;
  const doneCnt    = MOCK_REVIEWS.filter(r=>isReplied(r)).length;
  const avgRating  = (MOCK_REVIEWS.reduce((s,r)=>s+r.rating,0)/total).toFixed(1);
  const urgentCnt  = MOCK_REVIEWS.filter(r=>!isReplied(r)&&r.rating<=2).length;
  const responseRate = Math.round((doneCnt/total)*100);

  const filtered = useMemo(() => {
    let base = MOCK_REVIEWS.filter(r => {
      if (tab==='needs-reply' && isReplied(r)) return false;
      if (tab==='completed'  && !isReplied(r)) return false;
      if (rating==='5' && r.rating!==5) return false;
      if (rating==='4' && r.rating!==4) return false;
      if (rating==='3' && r.rating!==3) return false;
      if (rating==='1-2' && r.rating>2) return false;
      if (search) {
        const q=search.toLowerCase();
        if (!r.author?.toLowerCase().includes(q)&&!r.review_text?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (tab==='needs-reply') {
      base.sort((a,b)=>{
        const aU=a.rating<=2?0:1, bU=b.rating<=2?0:1;
        if (aU!==bU) return aU-bU;
        return isOverdue(a.created_at)?-1:isOverdue(b.created_at)?1:0;
      });
    }
    return base;
  }, [MOCK_REVIEWS, tab, rating, search, localStatus]);

  const density = tweaks?.density === 'compact';
  const py = density ? 20 : 28;

  return (
    <div className="app-shell">
      <Sidebar active="/dashboard" />
      <main className="main">
        {/* Header */}
        <div className="sec-head" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
          <div>
            <h1 style={{fontSize:18,fontWeight:800,letterSpacing:'-0.025em',color:'var(--t1)',marginBottom:2}}>{RESTAURANT.name}</h1>
            <p style={{fontSize:13,color:'var(--t3)'}}>Review Center · {RESTAURANT.location}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span className="dot dot-green pulse-d"></span>
            <span style={{fontSize:12,color:'var(--t3)'}}>Monitoring</span>
          </div>
        </div>

        <div className="page-wrap" style={{paddingTop:py}}>
          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
            {[
              {label:'Needs reply',   value:needsCnt,         color:'var(--t1)', danger:false},
              {label:'Avg rating',    value:`${avgRating} ★`, color:'#f59e0b', danger:false},
              {label:'Response rate', value:`${responseRate}%`,color:'var(--t1)', danger:false},
              {label:'Urgent',        value:urgentCnt,         color:urgentCnt>0?'var(--err)':'var(--t3)', danger:urgentCnt>0},
            ].map((s,i)=>(
              <div key={i} className="stat-card" style={s.danger?{background:'var(--err-sub)',borderColor:'rgba(239,68,68,.2)'}:{}}>
                <div style={{fontSize:11,color:'var(--t3)',marginBottom:6,fontWeight:500}}>{s.label}</div>
                <div style={{fontSize:26,fontWeight:800,letterSpacing:'-0.04em',color:s.color,lineHeight:1}}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Alert */}
          {urgentCnt > 0 && tweaks?.showWelcomeBanner !== false && (
            <div className="banner banner-red" style={{marginBottom:16}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {urgentCnt} urgent review{urgentCnt>1?'s':''} need{urgentCnt===1?'s':''} immediate attention
            </div>
          )}
          {urgentCnt===0 && needsCnt===0 && (
            <div className="banner banner-green" style={{marginBottom:16}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              All caught up — no reviews waiting for a reply
            </div>
          )}

          {/* Tabs */}
          <div className="tab-bar" style={{marginBottom:14}}>
            {[
              {v:'needs-reply',l:'Needs Reply',n:needsCnt},
              {v:'completed',  l:'Completed',  n:doneCnt},
              {v:'all',        l:'All',         n:total},
            ].map(t=>(
              <button key={t.v} onClick={()=>setTab(t.v)} className={`tab-btn ${tab===t.v?'active':''}`}>
                {t.l}
                <span className="badge badge-zinc" style={{padding:'1px 6px',fontSize:10}}>{t.n}</span>
              </button>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            <div className="search-wrap" style={{flex:1,minWidth:200}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search by author or content…" className="input"
                style={{height:36,fontSize:13,paddingLeft:34}} />
            </div>
            <div style={{display:'flex',alignItems:'center',gap:2,background:'var(--surface-1)',border:'1px solid var(--border)',borderRadius:10,padding:'3px',flexShrink:0}}>
              {[{v:'all',l:'All'},{v:'5',l:'5★'},{v:'4',l:'4★'},{v:'3',l:'3★'},{v:'1-2',l:'1–2★'}].map(f=>(
                <button key={f.v} onClick={()=>setRating(f.v)} style={{
                  padding:'4px 10px',borderRadius:7,border:'none',cursor:'pointer',
                  fontSize:12,fontWeight:500,fontFamily:'inherit',transition:'all .12s',
                  background:rating===f.v?'var(--surface-2)':'transparent',
                  color:rating===f.v?'var(--t1)':'var(--t3)',
                }}>{f.l}</button>
              ))}
            </div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div style={{border:'1px solid var(--border)',borderRadius:16,padding:'56px 24px',textAlign:'center'}}>
              <div style={{width:44,height:44,background:'var(--surface-1)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              </div>
              <p style={{fontSize:14,fontWeight:600,color:'var(--t2)',marginBottom:4}}>
                {tab==='completed'?'No completed reviews yet':'No reviews match your filters'}
              </p>
              <p style={{fontSize:13,color:'var(--t3)'}}>
                {tab==='completed'?'Mark a review as replied to move it here.':'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            <div>
              {filtered.map(r=>(
                <ReviewRow key={r.id} review={r} isReplied={isReplied(r)} onToggle={()=>toggleStatus(r)}/>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { DashboardPage, Sidebar });
