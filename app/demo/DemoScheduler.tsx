'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const TIMES = ['9:15am', '10:00am', '10:45am', '11:30am', '12:15pm', '1:00pm', '1:45pm', '3:30pm', '4:15pm']

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  )
}

export default function DemoScheduler({ initialYear, initialMonth, initialDay }: { initialYear: number; initialMonth: number; initialDay: number }) {
  const [view, setView] = useState({ year: initialYear, month: initialMonth })
  const [selectedDay, setSelectedDay] = useState(initialDay)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notice, setNotice] = useState(false)

  const calendar = useMemo(() => {
    const days = new Date(view.year, view.month + 1, 0).getDate()
    const offset = new Date(view.year, view.month, 1).getDay()
    return [...Array.from({ length: offset }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)]
  }, [view])

  function changeMonth(direction: number) {
    const next = new Date(view.year, view.month + direction, 1)
    setView({ year: next.getFullYear(), month: next.getMonth() })
    setSelectedDay(1)
    setSelectedTime(null)
    setNotice(false)
  }

  const selectedDate = new Date(view.year, view.month, selectedDay)
  const selectedLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(selectedDate)

  return (
    <main id="main-content" className="demo-shell">
      <header className="demo-topbar">
        <Link href="/" className="demo-brand" aria-label="Replova home">
          <Image src="/replova-mark.svg" alt="" width={27} height={27} priority />
          <span>Replova</span>
        </Link>
        <span className="demo-preview-badge">Scheduling preview</span>
      </header>

      <section className="demo-scheduler" aria-labelledby="demo-title">
        <aside className="demo-intro">
          <div className="demo-mini-brand"><Image src="/replova-mark.svg" alt="" width={24} height={24} /></div>
          <span>Replova</span>
          <h1 id="demo-title">Replova introduction</h1>
          <p><CalendarIcon /> 45 minutes</p>
          <p>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
            America/Los Angeles
          </p>
          <div className="demo-intro-copy">See the review inbox, AI reply workflow, reputation intelligence, and business-level insights using realistic sample data.</div>
        </aside>

        <div className="demo-calendar">
          <div className="demo-calendar-head">
            <strong>{MONTHS[view.month]} <span>{view.year}</span></strong>
            <div>
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">&#8249;</button>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">&#8250;</button>
            </div>
          </div>
          <div className="demo-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
          <div className="demo-days">
            {calendar.map((day, index) => day ? (
              <button
                type="button"
                key={`${view.year}-${view.month}-${day}`}
                className={selectedDay === day ? 'selected' : ''}
                onClick={() => { setSelectedDay(day); setSelectedTime(null); setNotice(false) }}
                aria-pressed={selectedDay === day}
              >
                {day}
              </button>
            ) : <span key={`blank-${index}`} />)}
          </div>
        </div>

        <aside className="demo-times">
          <div className="demo-times-head"><strong>{selectedLabel}</strong><span>45m</span></div>
          <div className="demo-time-list">
            {TIMES.map(time => (
              <button type="button" key={time} className={selectedTime === time ? 'selected' : ''} onClick={() => { setSelectedTime(time); setNotice(false) }}>
                <i /> {time}
              </button>
            ))}
          </div>
          {selectedTime && (
            <button className="demo-request-button" type="button" onClick={() => setNotice(true)}>
              Request {selectedLabel} at {selectedTime}
            </button>
          )}
        </aside>
      </section>

      {notice && (
        <div className="demo-notice" role="status">
          Calendar delivery is not connected yet. Email <a href="mailto:sales@replova.app">sales@replova.app</a> with this preferred time for now.
        </div>
      )}
      <p className="demo-footnote">This preview does not create a booking. A production calendar provider still needs to be connected.</p>
    </main>
  )
}
