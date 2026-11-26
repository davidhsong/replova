'use client'

import { useEffect, useRef } from 'react'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import { FeatureIcon, features, visits, issue, task } from './VisitSample'

export function FeedbackDashboard() {
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.dataset.enter = 'waiting'
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.dataset.enter = 'true'
        observer.disconnect()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <div ref={frame} className="feedback-demo" aria-label="Sample Downtown feedback dashboard">
    <aside className="demo-rail"><ReplovaLogo variant="primary" surface="light" height={18} placement="navbar" decorative />
      <strong>Workspace</strong><span>Overview</span>{features.map(f => <span key={f.id}><FeatureIcon id={f.id}/>{f.label}</span>)}</aside>
    <div className="demo-work"><div className="demo-bar">Workspace　›　Downtown</div>
      <div className="demo-body"><small>Location overview</small><h2>Downtown</h2><div className="demo-tabs">Feedback summary　 /　 Last six visits</div>
      <div className="demo-metrics"><div><small>Private visits</small><b>6</b></div><div><small>Average rating</small><b>4.0 <em>/ 5</em></b></div><div><small>Open Playbooks</small><b>1</b></div></div>
      <section className="demo-issue"><small>Recurring issue</small><h3>{issue}</h3><div className="visit-bars">{visits.map((v,i) => <i key={i} data-issue={i < 2} />)}</div><p>Two visits mention arrival · Four other visits</p></section>
      <h3>Recent feedback</h3>{visits.slice(0,3).map(v => <div className="demo-line" key={v.comment}><b>{v.rating}/5</b>{v.comment}</div>)}</div>
    </div><aside className="demo-detail"><div className="demo-bar">Issue details</div><section><small>Selected comments</small>{visits.slice(0,2).map(v => <blockquote key={v.comment}>“{v.comment}”</blockquote>)}<small>Related Playbook</small><h3>{task}</h3><p>Shift lead · Open</p></section><footer>Sample data</footer></aside>
  </div>
}
