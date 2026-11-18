'use client'

import Link from 'next/link'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
const MONTH_TIMES = ['7:30am', '8:15am', '10:00am', '12:00pm', '12:45pm', '3:15pm', '4:00pm', '4:45pm'] as const
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

const COLUMN_TIMES: Record<number, readonly string[]> = {
  0: ['9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '2:15pm', '3:00pm', '3:45pm'],
  1: ['7:30am', '8:15am', '9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '2:15pm', '3:15pm', '4:00pm', '4:45pm'],
  2: ['7:30am', '8:15am', '10:00am', '12:00pm', '12:45pm', '3:15pm', '4:00pm', '4:45pm'],
  3: ['7:30am', '8:30am', '9:15am', '10:00am', '10:45am', '11:30am', '12:15pm', '1:00pm', '1:45pm', '3:15pm', '4:00pm', '4:45pm', '5:30pm', '6:15pm'],
  4: [],
  5: ['7:30am', '8:15am', '9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '3:30pm', '4:15pm', '5:00pm', '5:45pm'],
  6: ['9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '2:15pm', '3:00pm', '3:45pm'],
}

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

function dayDifference(date: Date, baseline: Date) {
  const value = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const start = Date.UTC(baseline.getFullYear(), baseline.getMonth(), baseline.getDate())
  return Math.round((value - start) / 86_400_000)
}

function isAvailableDate(date: Date, baseline: Date) {
  const difference = dayDifference(date, baseline)
  return difference >= 0 && difference <= 45 && difference !== 2
}

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
  const selectedWeekStart = addDays(selectedDate, -selectedDate.getDay())
  const start = addDays(selectedWeekStart, -7)
  return Array.from({ length: 35 }, (_, index) => addDays(start, index))
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
  return (
    <div className={styles.eventDetails}>
      <ReplovaLogo variant="icon" surface="light" height={24} decorative eager />
      <span>Replova</span>
      <h1>Replova Introduction</h1>
      <p><ClockIcon /> 45m</p>
      <p><LinkIcon /> Calendar invite by email</p>
      <p><GlobeIcon /> America/Los Angeles <span className={styles.chevron}><ChevronIcon /></span></p>
    </div>
  )
}

function MiniCalendar({ selectedDate, baseline, onSelect }: { selectedDate: Date; baseline: Date; onSelect: (date: Date) => void }) {
  const [month, setMonth] = useState({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() })
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
            className={`${isAvailableDate(date, baseline) ? styles.available : ''} ${sameDate(date, selectedDate) ? styles.selected : ''}`}
            aria-pressed={sameDate(date, selectedDate)}
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

function SchedulerSidebar({ selectedDate, baseline, onSelect }: { selectedDate: Date; baseline: Date; onSelect: (date: Date) => void }) {
  return (
    <aside className={styles.sidebar}>
      <EventDetails />
      <MiniCalendar selectedDate={selectedDate} baseline={baseline} onSelect={onSelect} />
    </aside>
  )
}

function MonthCalendar({ selectedDate, baseline, visibleMonth, onMonthChange, onSelect }: {
  selectedDate: Date
  baseline: Date
  visibleMonth: { year: number; month: number }
  onMonthChange: (amount: number) => void
  onSelect: (date: Date) => void
}) {
  const anchor = new Date(visibleMonth.year, visibleMonth.month, selectedDate.getDate())
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
          const isAvailable = isAvailableDate(date, baseline)
          const differentMonth = date.getMonth() !== visibleMonth.month
          return (
            <button
              type="button"
              key={dateKey(date)}
              className={`${isAvailable ? styles.available : ''} ${isSelected ? styles.selected : ''} ${differentMonth ? styles.differentMonth : ''}`}
              aria-pressed={isSelected}
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

function MonthView({ selectedDate, selectedTime, baseline, clock, visibleMonth, onClockChange, onMonthChange, onDateSelect, onTimeSelect }: {
  selectedDate: Date
  selectedTime: string | null
  baseline: Date
  clock: ClockMode
  visibleMonth: { year: number; month: number }
  onClockChange: (clock: ClockMode) => void
  onMonthChange: (amount: number) => void
  onDateSelect: (date: Date) => void
  onTimeSelect: (time: string) => void
}) {
  return (
    <section className={styles.monthCard} aria-label="Choose a Replova demo time">
      <aside className={styles.monthIntro}><EventDetails /></aside>
      <MonthCalendar selectedDate={selectedDate} baseline={baseline} visibleMonth={visibleMonth} onMonthChange={onMonthChange} onSelect={onDateSelect} />
      <aside className={styles.monthTimes}>
        <div className={styles.monthTimesHead}>
          <strong>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(selectedDate)} {ordinal(selectedDate.getDate())}</strong>
          <ClockToggle clock={clock} onChange={onClockChange} />
        </div>
        <TimeButtons times={MONTH_TIMES} selectedTime={selectedTime} clock={clock} onSelect={onTimeSelect} />
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
  const range = `${MONTHS[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
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

function isGridHourAvailable(day: number, hour: number) {
  if (day === 2) return hour === 5 || hour === 8 || hour === 10 || hour >= 12
  if (day === 3) return hour >= 9
  if (day === 5 || day === 1) return hour >= 8
  if (day === 0 || day === 6) return hour >= 9
  return false
}

function WeeklyGrid({ selectedDate, clock }: { selectedDate: Date; clock: ClockMode }) {
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
            <div className={`${styles.hourRow} ${hour === 5 ? styles.currentHourRow : ''}`} key={hour}>
              <time>{formatHour(hour, clock)}</time>
              {week.map(date => <span key={`${dateKey(date)}-${hour}`} className={isGridHourAvailable(date.getDay(), hour) ? styles.openHour : styles.closedHour} />)}
            </div>
          ))}
          <div className={styles.currentTimeLine}><strong>{formatHour(5, clock)}</strong><span /></div>
        </div>
      </div>
    </div>
  )
}

function WeeklyColumns({ selectedDate, selectedTime, clock, onTimeSelect }: { selectedDate: Date; selectedTime: string | null; clock: ClockMode; onTimeSelect: (time: string) => void }) {
  const week = Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index))
  const availableDays = week.filter(date => (COLUMN_TIMES[date.getDay()] ?? []).length > 0)
  return (
    <div className={styles.weekColumns}>
      {availableDays.map(date => {
        const prefix = `${dateKey(date)}|`
        const activeTime = selectedTime?.startsWith(prefix) ? selectedTime.slice(prefix.length) : null
        return (
          <section key={dateKey(date)} aria-label={`${WEEKDAYS[date.getDay()]} ${date.getDate()}`}>
            <WeekDayHeading date={date} selectedDate={selectedDate} />
            <TimeButtons
              times={COLUMN_TIMES[date.getDay()] ?? []}
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
  const [selectedDate, setSelectedDate] = useState(baseline)
  const [visibleMonth, setVisibleMonth] = useState({ year: initialYear, month: initialMonth })
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('idle')
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingForm, setBookingForm] = useState({ name: '', email: '', company: '', website: '' })
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const bookingSlot = useMemo(() => {
    if (!selectedTime) return null
    const parts = selectedTime.split('|')
    return parts.length === 2
      ? { date: parts[0], time: parts[1] }
      : { date: dateKey(selectedDate), time: selectedTime }
  }, [selectedDate, selectedTime])

  const bookingSlotLabel = useMemo(() => {
    if (!bookingSlot) return ''
    const [year, month, day] = bookingSlot.date.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
    return `${dateLabel} at ${formatTime(bookingSlot.time, clock)}`
  }, [bookingSlot, clock])

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
    selectDate(addDays(selectedDate, amount))
  }

  function selectTime(value: string) {
    const parts = value.split('|')
    const rawTime = parts.at(-1) ?? value
    let noticeDate = selectedDate
    if (parts.length === 2) {
      const [year, month, day] = parts[0].split('-').map(Number)
      noticeDate = new Date(year, month - 1, day)
    }
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
        body: JSON.stringify({ ...bookingForm, ...bookingSlot }),
      })
      const result = await response.json() as { success?: boolean; slotLabel?: string; error?: string }
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The calendar invitation could not be sent.')
      }
      const confirmedSlot = result.slotLabel || bookingSlotLabel
      setBookingStatus('success')
      setNotice(`${confirmedSlot} scheduled successfully. A calendar invite was sent to ${bookingForm.email.trim()}.`)
    } catch (error) {
      setBookingStatus('error')
      setBookingError(error instanceof Error ? error.message : 'The calendar invitation could not be sent.')
    }
  }

  return (
    <main id="main-content" className={styles.shell}>
      {calendarView === 'month' ? (
        <div className={styles.monthStage}>
          <div className={styles.floatingControls}>
            <ViewControls view={calendarView} clock={clock} onViewChange={setCalendarView} onClockChange={setClock} />
          </div>
          <MonthView
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            baseline={baseline}
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
          <SchedulerSidebar selectedDate={selectedDate} baseline={baseline} onSelect={selectDate} />
          <section className={styles.weekMain} aria-label="Weekly demo availability">
            <WeekToolbar selectedDate={selectedDate} view={calendarView} clock={clock} onShift={shiftWeek} onViewChange={setCalendarView} onClockChange={setClock} />
            {calendarView === 'week-grid'
              ? <WeeklyGrid selectedDate={selectedDate} clock={clock} />
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
                    <span>Replova introduction</span>
                    <h2 id="booking-title">Confirm your demo</h2>
                  </div>
                  <button type="button" aria-label="Close demo booking" onClick={() => setBookingOpen(false)}>×</button>
                </header>
                <div className={styles.bookingSummary}>
                  <strong>{bookingSlotLabel}</strong>
                  <span>45 minutes · America/Los Angeles</span>
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
    </main>
  )
}
