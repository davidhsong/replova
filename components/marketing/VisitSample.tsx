export const visits = [
  { rating: 3, comment: 'I couldn’t tell where to go when I arrived.' },
  { rating: 3, comment: 'I had to ask where the line starts.' },
  { rating: 5, comment: 'The team explained everything clearly.' },
  { rating: 4, comment: 'It was easy to book my visit.' },
  { rating: 5, comment: 'Someone greeted me right away.' },
  { rating: 4, comment: 'The follow-up instructions helped.' },
] as const

export const issue = '2 of 6 visits mentioned where to go on arrival.'
export const task = 'Put a ‘Start here’ sign at the entrance.'
export const features = [
  { id: 'tap', label: 'Replova Tap', headline: 'How was your visit?', description: 'One tap or scan opens a private form. A customer can send a rating on its own or tell you what happened.' },
  { id: 'inbox', label: 'Feedback inbox', headline: 'Read the visit in context.', description: 'The original rating and comment arrive together in the inbox for the location the customer visited.' },
  { id: 'issues', label: 'Recurring issues', headline: 'See what keeps coming up.', description: 'Read both comments behind the arrival issue. Each visit counts once toward the total.' },
  { id: 'playbook', label: 'Playbooks', headline: 'Give the fix an owner.', description: 'Record the change, assign someone to carry it out, and check what the next visitors say.' },
] as const
export type Feature = typeof features[number]['id']

export function FeatureIcon({ id }: { id: Feature }) {
  const paths = {
    tap: 'M5 9q3 3 0 6 M9 6q5 6 0 12 M13 3q8 9 0 18',
    inbox: 'M3 14l3-9h12l3 9v5H3z M3 14h5l2 3h4l2-3h5',
    issues: 'M3 4h14v10H8l-5 3z M9 17h7l5 3V8',
    playbook: 'M5 3h14v18H5z M8 8l1 1 2-3 M13 8h3 M8 14l1 1 2-3 M13 14h3',
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[id]} /></svg>
}

export function VisitSample({ feature }: { feature: Feature }) {
  const label = features.find(item => item.id === feature)!.label
  return <div className={'visit-ui visit-' + feature}>
    <header><FeatureIcon id={feature} />{label}<span>Downtown</span></header>
    {feature === 'tap' && <><h3>How was your visit?</h3><div className="visit-scale" aria-label="3 out of 5">{[1,2,3,4,5].map(n => <b key={n} data-picked={n === 3}>{n}</b>)}</div><small>Comment (optional)</small><p className="visit-field">{visits[0].comment}</p><strong className="visit-send">Send feedback</strong></>}
    {feature === 'inbox' && <><h3>Recent visits</h3>{[visits[0], visits[2]].map((visit,i) => <div className="visit-row" data-picked={i === 0} key={visit.comment}><small>{visit.rating} / 5 · Downtown</small><p>{visit.comment}</p></div>)}</>}
    {feature === 'issues' && <><h3>{issue}</h3>{visits.slice(0,2).map(visit => <blockquote key={visit.comment}>“{visit.comment}”</blockquote>)}</>}
    {feature === 'playbook' && <><h3>{task}</h3><dl><dt>Owner</dt><dd>Shift lead</dd><dt>Status</dt><dd>Open</dd></dl><small>Follow-up</small><p>Check the next six comments for questions about where to go.</p></>}
    <footer>Sample data</footer>
  </div>
}
