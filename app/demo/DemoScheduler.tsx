'use client'

import Link from 'next/link'
import { DEMO_LEAD_MS } from '@/lib/demoBooking'
import type { FormEvent, ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import styles from './DemoScheduler.module.css'

type CalendarView = 'month' | 'week-grid' | 'week-columns'
type ClockMode = '12h' | '24h'
type BookingStatus = 'idle' | 'submitting' | 'success' | 'error'

type SchedulerProps = {
  initialYear: number
  initialMonth: number
  initialDay: number
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function sameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

type Slot = { date: string; time: string; start: number }
type DaySlots = Record<string, Record<string, Slot>>
const CalendarContext = createContext<{ days: DaySlots; zone: string; setZone: (zone: string) => void }>({ days: {}, zone: 'America/Los_Angeles', setZone() {} })
const fullDate = (day: Date) => day.toLocaleDateString('en-US', { dateStyle: 'full' })

function ordinal(day: number) {
  const remainder = day % 100
  if (remainder >= 11 && remainder <= 13) return `${day}th`
  if (day % 10 === 1) return `${day}st`
  if (day % 10 === 2) return `${day}nd`
  if (day % 10 === 3) return `${day}rd`
  return `${day}th`
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatTime(time: string, clock: ClockMode) {
  if (clock === '12h') return time
  const match = time.match(/^(\d+):(\d+)(am|pm)$/)
  if (!match) return time
  let hour = Number(match[1])
  const minute = match[2]
  const period = match[3]
  if (period === 'pm' && hour !== 12) hour += 12
  if (period === 'am' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${minute}`
}

function formatHour(hour: number, clock: ClockMode) {
  if (clock === '24h') return `${String(hour).padStart(2, '0')}:00`
  const normalized = hour % 12 || 12
  return `${normalized}:00${hour < 12 ? 'am' : 'pm'}`
}

function getMonthWindow(selectedDate: Date) {
  const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  const start = addDays(first, -first.getDay())
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return Array.from({ length: 7 * Math.ceil((first.getDay() + count) / 7) }, (_, index) => addDays(start, index))
}

function getMiniCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const dayCount = new Date(year, month + 1, 0).getDate()
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => new Date(year, month, index + 1)),
  ]
}

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function CalendarIcon() {
  return <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon>
}

function GridIcon() {
  return <Icon><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9.4h16M4 14.7h16M9.3 4v16M14.7 4v16" /></Icon>
}

function ColumnsIcon() {
  return <Icon><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M9.2 4v16M14.8 4v16" /></Icon>
}

function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3.2 2" /></Icon>
}

function LinkIcon() {
  return <Icon><path d="M10.1 13.9a4.2 4.2 0 0 0 5.9 0l2.2-2.2a4.2 4.2 0 0 0-5.9-5.9l-1.2 1.2" /><path d="M13.9 10.1a4.2 4.2 0 0 0-5.9 0l-2.2 2.2a4.2 4.2 0 0 0 5.9 5.9l1.2-1.2" /></Icon>
}

function GlobeIcon() {
  return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.2 2.3 3.3 5.2 3.3 8.5s-1.1 6.2-3.3 8.5c-2.2-2.3-3.3-5.2-3.3-8.5S9.8 5.8 12 3.5Z" /></Icon>
}

function ChevronIcon({ direction = 'down' }: { direction?: 'left' | 'right' | 'down' }) {
  const path = direction === 'left' ? 'm14.5 6-6 6 6 6' : direction === 'right' ? 'm9.5 6 6 6-6 6' : 'm6 9 6 6 6-6'
  return <Icon><path d={path} /></Icon>
}

function ViewControls({ view, clock, onViewChange, onClockChange, includeClock }: {
  view: CalendarView
  clock: ClockMode
  onViewChange: (view: CalendarView) => void
  onClockChange: (clock: ClockMode) => void
  includeClock?: boolean
}) {
  return (
    <div className={styles.controlCluster}>
      {includeClock ? (
        <div className={styles.clockToggle} aria-label="Time format">
          {(['12h', '24h'] as const).map(option => (
            <button key={option} type="button" className={clock === option ? styles.active : ''} aria-pressed={clock === option} onClick={() => onClockChange(option)}>{option}</button>
          ))}
        </div>
      ) : null}
      <div className={styles.viewToggle} aria-label="Calendar view">
        <button type="button" className={view === 'month' ? styles.active : ''} aria-label="Month view" aria-pressed={view === 'month'} onClick={() => onViewChange('month')}><CalendarIcon /></button>
        <button type="button" className={view === 'week-grid' ? styles.active : ''} aria-label="Weekly grid view" aria-pressed={view === 'week-grid'} onClick={() => onViewChange('week-grid')}><GridIcon /></button>
        <button type="button" className={view === 'week-columns' ? styles.active : ''} aria-label="Weekly column view" aria-pressed={view === 'week-columns'} onClick={() => onViewChange('week-columns')}><ColumnsIcon /></button>
      </div>
    </div>
  )
}

function ClockToggle({ clock, onChange }: { clock: ClockMode; onChange: (clock: ClockMode) => void }) {
  return (
    <div className={styles.clockToggle} aria-label="Time format">
      {(['12h', '24h'] as const).map(option => (
        <button key={option} type="button" className={clock === option ? styles.active : ''} aria-pressed={clock === option} onClick={() => onChange(option)}>{option}</button>
      ))}
    </div>
  )
}

function EventDetails() {
  const { zone, setZone } = useContext(CalendarContext)
  return (
    <div className={styles.eventDetails}>
      <Link href="/" aria-label="Replova home"><ReplovaLogo variant="icon" surface="light" height={24} decorative eager /></Link>
      <span>Replova</span>
      <h1>Replova Tap demo</h1>
      <p><ClockIcon /> 45m</p>
      <p><LinkIcon /> Calendar invite by email</p>
      <p><GlobeIcon /> <select aria-label="Time zone" value={zone} onChange={event => setZone(event.target.value)}>{Array.from(new Set(['America/Los_Angeles', 'America/New_York', 'Europe/London', 'UTC', zone])).map(name => <option key={name}>{name}</option>)}</select></p>
    </div>
  )
}

function MiniCalendar({ selectedDate, onSelect }: { selectedDate: Date; onSelect: (date: Date) => void }) {
  const [month, setMonth] = useState({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() })
  const { days } = useContext(CalendarContext)
  const calendar = useMemo(() => getMiniCalendar(month.year, month.month), [month.year, month.month])

  function changeMonth(amount: number) {
    const next = new Date(month.year, month.month + amount, 1)
    setMonth({ year: next.getFullYear(), month: next.getMonth() })
  }

  return (
    <div className={styles.miniCalendar}>
      <div className={styles.miniCalendarHead}>
        <strong>{MONTHS[month.month]} <span>{month.year}</span></strong>
        <div>
          <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronIcon direction="left" /></button>
          <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronIcon direction="right" /></button>
        </div>
      </div>
      <div className={styles.miniWeekdays}>{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
      <div className={styles.miniDays}>
        {calendar.map((date, index) => date ? (
          <button
            type="button"
            key={dateKey(date)}
            className={`${Boolean(days[dateKey(date)]) ? styles.available : ''} ${sameDate(date, selectedDate) ? styles.selected : ''}`}
            disabled={!days[dateKey(date)]} aria-label={fullDate(date)} aria-pressed={sameDate(date, selectedDate)}
            onClick={() => onSelect(date)}
          >
            {date.getDate()}
            {sameDate(date, selectedDate) ? <i /> : null}
          </button>
        ) : <span key={`blank-${index}`} />)}
      </div>
    </div>
  )
}

function SchedulerSidebar({ selectedDate, onSelect }: { selectedDate: Date; onSelect: (date: Date) => void }) {
  return (
    <aside className={styles.sidebar}>
      <EventDetails />
      <MiniCalendar selectedDate={selectedDate} onSelect={onSelect} />
    </aside>
  )
}

function MonthCalendar({ selectedDate, visibleMonth, onMonthChange, onSelect }: {
  selectedDate: Date
  visibleMonth: { year: number; month: number }
  onMonthChange: (amount: number) => void
  onSelect: (date: Date) => void
}) {
  const { days } = useContext(CalendarContext)
  const anchor = new Date(visibleMonth.year, visibleMonth.month, 1)
  const dates = getMonthWindow(anchor)

  return (
    <div className={styles.monthCalendar}>
      <div className={styles.monthCalendarHead}>
        <strong>{MONTHS[visibleMonth.month]} <span>{visibleMonth.year}</span></strong>
        <div>
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(-1)}><ChevronIcon direction="left" /></button>
          <button type="button" aria-label="Next month" onClick={() => onMonthChange(1)}><ChevronIcon direction="right" /></button>
        </div>
      </div>
      <div className={styles.monthWeekdays}>{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
      <div className={styles.monthDays}>
        {dates.map(date => {
          const isSelected = sameDate(date, selectedDate)
          const isAvailable = Boolean(days[dateKey(date)])
          const differentMonth = date.getMonth() !== visibleMonth.month
          return (
            <button
              type="button"
              key={dateKey(date)}
              className={`${isAvailable ? styles.available : ''} ${isSelected ? styles.selected : ''} ${differentMonth ? styles.differentMonth : ''}`}
              disabled={!isAvailable} aria-label={fullDate(date)} aria-pressed={isSelected}
              onClick={() => onSelect(date)}
            >
              {differentMonth && date.getDate() === 1 ? <small>{MONTHS[date.getMonth()].slice(0, 3).toUpperCase()}</small> : null}
              <span>{date.getDate()}</span>
              {isSelected ? <i /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TimeButtons({ times, selectedTime, clock, onSelect }: { times: readonly string[]; selectedTime: string | null; clock: ClockMode; onSelect: (time: string) => void }) {
  return (
    <div className={styles.timeButtons}>
      {times.map(time => (
        <button type="button" key={time} className={selectedTime === time ? styles.selectedTime : ''} aria-pressed={selectedTime === time} onClick={() => onSelect(time)}>
          <i />
          {formatTime(time, clock)}
        </button>
      ))}
    </div>
  )
}

function MonthView({ selectedDate, selectedTime, clock, visibleMonth, onClockChange, onMonthChange, onDateSelect, onTimeSelect }: {
  selectedDate: Date
  selectedTime: string | null
  clock: ClockMode
  visibleMonth: { year: number; month: number }
  onClockChange: (clock: ClockMode) => void
  onMonthChange: (amount: number) => void
  onDateSelect: (date: Date) => void
  onTimeSelect: (time: string) => void
}) {
  const { days } = useContext(CalendarContext)
  return (
    <section className={styles.monthCard} aria-label="Choose a Replova demo time">
      <aside className={styles.monthIntro}><EventDetails /></aside>
      <MonthCalendar selectedDate={selectedDate} visibleMonth={visibleMonth} onMonthChange={onMonthChange} onSelect={onDateSelect} />
      <aside className={styles.monthTimes}>
        <div className={styles.monthTimesHead}>
          <strong>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(selectedDate)} {ordinal(selectedDate.getDate())}</strong>
          <ClockToggle clock={clock} onChange={onClockChange} />
        </div>
        <TimeButtons times={Object.keys(days[dateKey(selectedDate)] ?? {})} selectedTime={selectedTime} clock={clock} onSelect={onTimeSelect} />
      </aside>
    </section>
  )
}

function WeekToolbar({ selectedDate, view, clock, onShift, onViewChange, onClockChange }: {
  selectedDate: Date
  view: CalendarView
  clock: ClockMode
  onShift: (amount: number) => void
  onViewChange: (view: CalendarView) => void
  onClockChange: (clock: ClockMode) => void
}) {
  const end = addDays(selectedDate, 6)
  const range = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).formatRange(selectedDate, end)
  return (
    <header className={styles.weekToolbar}>
      <div className={styles.weekRange}>
        <strong>{range}</strong>
        <button type="button" aria-label="Previous week" onClick={() => onShift(-7)}><ChevronIcon direction="left" /></button>
        <button type="button" aria-label="Next week" onClick={() => onShift(7)}><ChevronIcon direction="right" /></button>
      </div>
      <ViewControls view={view} clock={clock} onViewChange={onViewChange} onClockChange={onClockChange} includeClock />
    </header>
  )
}

function WeekDayHeading({ date, selectedDate }: { date: Date; selectedDate: Date }) {
  const selected = sameDate(date, selectedDate)
  return (
    <div className={`${styles.weekDayHeading} ${selected ? styles.current : ''}`}>
      <span>{WEEKDAYS[date.getDay()]}</span>
      <strong>{ordinal(date.getDate())}</strong>
    </div>
  )
}

function WeeklyGrid({ selectedDate, clock, onTimeSelect }: { selectedDate: Date; clock: ClockMode; onTimeSelect: (value: string) => void }) {
  const { days } = useContext(CalendarContext)
  const week = Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index))
  return (
    <div className={styles.weekGridView}>
      <div className={styles.weekGridHead}>
        <span />
        {week.map(date => <WeekDayHeading key={dateKey(date)} date={date} selectedDate={selectedDate} />)}
      </div>
      <div className={styles.weekGridScroller}>
        <div className={styles.weekGridBody}>
          {HOURS.map(hour => (
            <div className={styles.hourRow} key={hour}>
              <time>{formatHour(hour, clock)}</time>
              {week.map(date => {
                const key = dateKey(date)
                const times = Object.keys(days[key] ?? {}).filter(time => Number(formatTime(time, '24h').split(':')[0]) === hour)
                return <span key={key} className={times.length ? styles.openHour : styles.closedHour}>{times.map(time => <button type="button" key={time} aria-label={fullDate(date) + ' ' + time} onClick={() => onTimeSelect(key + '|' + time)}>{formatTime(time, clock)}</button>)}</span>
              })}
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}

function WeeklyColumns({ selectedDate, selectedTime, clock, onTimeSelect }: { selectedDate: Date; selectedTime: string | null; clock: ClockMode; onTimeSelect: (time: string) => void }) {
  const week = Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index))
  const { days } = useContext(CalendarContext)
  const availableDays = week.filter(date => days[dateKey(date)])
  return (
    <div className={styles.weekColumns}>
      {availableDays.map(date => {
        const prefix = `${dateKey(date)}|`
        const activeTime = selectedTime?.startsWith(prefix) ? selectedTime.slice(prefix.length) : null
        return (
          <section key={dateKey(date)} aria-label={`${WEEKDAYS[date.getDay()]} ${date.getDate()}`}>
            <WeekDayHeading date={date} selectedDate={selectedDate} />
            <TimeButtons
              times={Object.keys(days[dateKey(date)])}
              selectedTime={activeTime}
              clock={clock}
              onSelect={time => onTimeSelect(`${prefix}${time}`)}
            />
          </section>
        )
      })}
    </div>
  )
}

export default function DemoScheduler({ initialYear, initialMonth, initialDay }: SchedulerProps) {
  const baseline = useMemo(() => new Date(initialYear, initialMonth, initialDay), [initialYear, initialMonth, initialDay])
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [clock, setClock] = useState<ClockMode>('12h')
  const [requestedDate, setSelectedDate] = useState<Date | null>(null)
  const [requestedMonth, setVisibleMonth] = useState<{ year: number; month: number } | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('idle')
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingForm, setBookingForm] = useState({ name: '', email: '', company: '', website: '' })
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [slots, setSlots] = useState<Slot[]>([])
  const [zone, setDisplayZone] = useState('America/Los_Angeles')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [revision, refresh] = useState(0)
  const requestId = useRef('')
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null)
  const bookingSlot = activeSlot
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/demo/book', { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error()
        const result = await response.json()
        if (!controller.signal.aborted) { setSlots(result.slots.filter((slot: Slot) => slot.start >= Date.now() + DEMO_LEAD_MS)); setFailed(false) }
      } catch { if (!controller.signal.aborted) { setFailed(true); setSlots([]) } }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    const timer = setTimeout(() => refresh(value => value + 1), 30000)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [revision])
  const days = useMemo(() => {
    const result: DaySlots = {}
    const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' })
    for (const slot of slots) {
      const key = dayFormat.format(slot.start)
      const time = timeFormat.format(slot.start).replace(/\s/g, '').toLowerCase()
      const times = result[key] ??= {}
      times[time] = slot
    }
    return result
  }, [slots, zone])
  const first = Object.keys(days)[0]
  const fallbackDate = first ? new Date(first + 'T12:00:00') : baseline
  const selectedDate = requestedDate && days[dateKey(requestedDate)] ? requestedDate : fallbackDate
  const visibleMonth = requestedMonth ?? { year: selectedDate.getFullYear(), month: selectedDate.getMonth() }

  function setZone(nextZone: string) {
    setDisplayZone(nextZone)
    setVisibleMonth(null)
    setSelectedTime(null)
    setNotice(null)
  }

  const bookingSlotLabel = useMemo(() => {
    if (!bookingSlot) return ''
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'full', timeStyle: 'short', hour12: clock === '12h' }).format(bookingSlot.start)
  }, [bookingSlot, clock, zone])

  useEffect(() => {
    if (!bookingOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstFieldRef.current?.focus()
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && bookingStatus !== 'submitting') setBookingOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [bookingOpen, bookingStatus])

  function selectDate(date: Date) {
    setSelectedDate(date)
    setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() })
    setSelectedTime(null)
    setNotice(null)
    setBookingOpen(false)
    setBookingStatus('idle')
    setBookingError(null)
  }

  function changeMonth(amount: number) {
    const next = new Date(visibleMonth.year, visibleMonth.month + amount, 1)
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() })
  }

  function shiftWeek(amount: number) {
    const target = addDays(selectedDate, amount)
    const keys = Object.keys(days)
    const next = amount > 0 ? keys.find(key => key >= dateKey(target)) : keys.filter(key => key <= dateKey(target)).at(-1)
    if (next) selectDate(new Date(next + 'T12:00:00'))
  }

  function selectTime(value: string) {
    const parts = value.split('|')
    const rawTime = parts.at(-1) ?? value
    let noticeDate = selectedDate
    if (parts.length === 2) {
      const [year, month, day] = parts[0].split('-').map(Number)
      noticeDate = new Date(year, month - 1, day)
    }
    const slot = days[dateKey(noticeDate)]?.[rawTime]
    if (!slot || slot.start < Date.now() + DEMO_LEAD_MS) { refresh(value => value + 1); return }
    setActiveSlot(slot)
    requestId.current = crypto.randomUUID()
    setSelectedTime(value)
    const label = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(noticeDate)
    setNotice(`${label} at ${formatTime(rawTime, clock)} selected. Add contact details to confirm the demo.`)
    setBookingStatus('idle')
    setBookingError(null)
    setBookingOpen(true)
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bookingSlot || bookingStatus === 'submitting') return
    setBookingStatus('submitting')
    setBookingError(null)

    try {
      const response = await fetch('/api/demo/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookingForm, ...bookingSlot, requestId: requestId.current }),
      })
      const result = await response.json() as { success?: boolean; slotLabel?: string; error?: string }
      if (!response.ok || !result.success) {
        if (response.status === 409) {
          setBookingOpen(false)
          setSlots(current => current.filter(slot => slot.start !== bookingSlot.start))
          setNotice(result.error || 'Choose another time.')
          refresh(value => value + 1)
        }
        throw new Error(result.error || 'The calendar invitation could not be sent.')
      }
      const confirmedSlot = result.slotLabel || bookingSlotLabel
      setSlots(current => current.filter(slot => slot.start !== bookingSlot.start))
      setBookingStatus('success')
      setNotice(`${confirmedSlot} scheduled successfully. A calendar invite was sent to ${bookingForm.email.trim()}.`)
    } catch (error) {
      setBookingStatus('error')
      setBookingError(error instanceof Error ? error.message : 'The calendar invitation could not be sent.')
    }
  }

  return (
    <CalendarContext.Provider value={{ days, zone, setZone }}><main id="main-content" className={styles.shell}>
      {!first && <div role="status">{loading ? 'Loading available times…' : failed ? <>Availability could not be loaded. <button onClick={() => refresh(v => v + 1)}>Try again</button></> : 'No times are available in the booking window.'}</div>}
      {calendarView === 'month' ? (
        <div className={styles.monthStage}>
          <div className={styles.floatingControls}>
            <ViewControls view={calendarView} clock={clock} onViewChange={setCalendarView} onClockChange={setClock} />
          </div>
          <MonthView
            selectedDate={selectedDate}
            selectedTime={selectedTime}

            clock={clock}
            visibleMonth={visibleMonth}
            onClockChange={setClock}
            onMonthChange={changeMonth}
            onDateSelect={selectDate}
            onTimeSelect={selectTime}
          />
        </div>
      ) : (
        <div className={styles.weekLayout}>
          <SchedulerSidebar selectedDate={selectedDate} onSelect={selectDate} />
          <section className={styles.weekMain} aria-label="Weekly demo availability">
            <WeekToolbar selectedDate={selectedDate} view={calendarView} clock={clock} onShift={shiftWeek} onViewChange={setCalendarView} onClockChange={setClock} />
            {calendarView === 'week-grid'
              ? <WeeklyGrid selectedDate={selectedDate} clock={clock} onTimeSelect={selectTime} />
              : <WeeklyColumns selectedDate={selectedDate} selectedTime={selectedTime} clock={clock} onTimeSelect={selectTime} />}
          </section>
        </div>
      )}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
      {bookingOpen && bookingSlot ? (
        <div className={styles.bookingLayer}>
          <button
            type="button"
            className={styles.bookingBackdrop}
            aria-label="Close demo booking"
            onClick={() => bookingStatus !== 'submitting' && setBookingOpen(false)}
          />
          <section className={styles.bookingPanel} role="dialog" aria-modal="true" aria-labelledby="booking-title">
            {bookingStatus === 'success' ? (
              <div className={styles.bookingSuccess}>
                <span aria-hidden="true">✓</span>
                <p>Demo scheduled</p>
                <h2 id="booking-title">Calendar invite sent</h2>
                <strong>{bookingSlotLabel}</strong>
                <small>The invitation was sent to {bookingForm.email.trim()}. A copy was also sent to the organizer.</small>
                <button type="button" className={styles.primaryAction} onClick={() => setBookingOpen(false)}>Done</button>
              </div>
            ) : (
              <>
                <header className={styles.bookingHeader}>
                  <div>
                    <span>Replova Tap demo</span>
                    <h2 id="booking-title">Confirm your demo</h2>
                  </div>
                  <button type="button" disabled={bookingStatus === 'submitting'} aria-label="Close demo booking" onClick={() => setBookingOpen(false)}>×</button>
                </header>
                <div className={styles.bookingSummary}>
                  <strong>{bookingSlotLabel}</strong>
                  <span>45 minutes · {zone}</span>
                </div>
                <form className={styles.bookingForm} onSubmit={submitBooking}>
                  <label>
                    Name
                    <input
                      ref={firstFieldRef}
                      type="text"
                      name="name"
                      autoComplete="name"
                      maxLength={100}
                      required
                      value={bookingForm.name}
                      onChange={event => setBookingForm(current => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                      value={bookingForm.email}
                      onChange={event => setBookingForm(current => ({ ...current, email: event.target.value }))}
                    />
                  </label>
                  <label>
                    Business <span>Optional</span>
                    <input
                      type="text"
                      name="company"
                      autoComplete="organization"
                      maxLength={120}
                      value={bookingForm.company}
                      onChange={event => setBookingForm(current => ({ ...current, company: event.target.value }))}
                    />
                  </label>
                  <label className={styles.honeypot} aria-hidden="true">
                    Website
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={bookingForm.website}
                      onChange={event => setBookingForm(current => ({ ...current, website: event.target.value }))}
                    />
                  </label>
                  {bookingError ? <p className={styles.bookingError} role="alert">{bookingError}</p> : null}
                  <p className={styles.bookingPrivacy}>Contact details are used only to arrange the demo. See the <Link href="/privacy">privacy policy</Link>.</p>
                  <div className={styles.bookingActions}>
                    <button type="button" onClick={() => setBookingOpen(false)} disabled={bookingStatus === 'submitting'}>Cancel</button>
                    <button type="submit" className={styles.primaryAction} disabled={bookingStatus === 'submitting'}>
                      {bookingStatus === 'submitting' ? 'Sending invite…' : 'Send calendar invite'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </main></CalendarContext.Provider>
  )
}
