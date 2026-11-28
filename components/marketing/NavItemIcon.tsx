import { FeatureIcon } from './VisitSample'

const paths = {
  dot: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M10 10q2 2 0 4 M13 8q4 4 0 8',
  reply: 'M4 5.5h16v10H9l-5 4v-14Z M8 9h8M8 12h5',
  research: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z M15 15l5 5 M7 10h6M10 7v6',
  cup: 'M5 7h14 M6 7l2 14h8l2-14 M12 7l2-5h4 M9 12h6',
  bed: 'M3 4v16 M3 15h18v5 M3 8h6a2 2 0 0 1 2 2v2H3 M11 9h7a3 3 0 0 1 3 3v3',
  building: 'M3 21h18 M5 21V3h10v18 M15 9h4v12 M8 7h1m2 0h1 M8 11h1m2 0h1 M8 15h1m2 0h1 M9 21v-3h2v3',
  utensils: 'M4 3v5a3 3 0 0 0 6 0V3 M7 3v18 M18 3c-3 2-4 6-4 10h4 M18 3v18',
  bag: 'M5 9h14l-1 11H6L5 9Z M8 9a4 4 0 0 1 8 0',
  dumbbell: 'M6 6h3v12H6z M15 6h3v12h-3z M3 9v6m18-6v6 M3 12h3m3 0h6m3 0h3',
  wrench: 'M20.3 7.2a5.5 5.5 0 0 1-7 7l-6.8 6.1a2.1 2.1 0 0 1-3-3l6.2-6.8a5.5 5.5 0 0 1 7-7l-3.6 3.6 3.5 3.5 3.7-3.4Z',
  local: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
}

export type NavIconName = keyof typeof paths | 'tap' | 'guide'

export function NavItemIcon({ name, className = 'nav-item-icon' }: { name: NavIconName; className?: string }) {
  if (name === 'tap' || name === 'guide') return <FeatureIcon id={name === 'tap' ? 'tap' : 'playbook'} />

  return <svg className={className} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
