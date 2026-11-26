export const DEMO_TIME_ZONE = 'America/Los_Angeles'
export const DEMO_DURATION_MINUTES = 45

const WEEKLY_TIMES: Record<number, readonly string[]> = {
  0: ['9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '2:15pm', '3:00pm', '3:45pm'],
  1: ['7:30am', '8:15am', '9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '2:15pm', '3:15pm', '4:00pm', '4:45pm'],
  2: ['7:30am', '8:15am', '10:00am', '12:00pm', '12:45pm', '3:15pm', '4:00pm', '4:45pm'],
  3: ['7:30am', '8:30am', '9:15am', '10:00am', '10:45am', '11:30am', '12:15pm', '1:00pm', '1:45pm', '3:15pm', '4:00pm', '4:45pm', '5:30pm', '6:15pm'],
  4: [],
  5: ['7:30am', '8:15am', '9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '3:30pm', '4:15pm', '5:00pm', '5:45pm'],
  6: ['9:00am', '9:45am', '10:30am', '11:15am', '12:00pm', '12:45pm', '1:30pm', '2:15pm', '3:00pm', '3:45pm'],
}

type CalendarInviteInput = {
  uid: string
  attendeeName: string
  attendeeEmail: string
  company?: string
  organizerEmail: string
  start: Date
  end: Date
  meetingUrl?: string
}

export function validateDemoMeetingUrl(value: string | undefined) {
  const candidate = value?.trim()
  if (!candidate) return undefined
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' && url.hostname === 'meet.google.com'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function parseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error('Invalid date')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error('Invalid date')
  }
  return { year, month, day }
}

function parseTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})(am|pm)$/)
  if (!match) throw new Error('Invalid time')
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) throw new Error('Invalid time')
  if (match[3] === 'pm' && hour !== 12) hour += 12
  if (match[3] === 'am' && hour === 12) hour = 0
  return { hour, minute }
}

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DEMO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function zonedParts(date: Date) {
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

export function demoSlotToUtc(dateValue: string, timeValue: string) {
  const date = parseDate(dateValue)
  const time = parseTime(timeValue)
  const desired = { ...date, ...time, second: 0 }
  const desiredAsUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute)
  let timestamp = desiredAsUtc

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(timestamp))
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second)
    const correction = desiredAsUtc - actualAsUtc
    if (correction === 0) break
    timestamp += correction
  }

  const result = new Date(timestamp)
  const check = zonedParts(result)
  if (Object.entries(desired).some(([key, value]) => check[key as keyof typeof check] !== value)) {
    throw new Error('Invalid local time')
  }
  return result
}

export const DEMO_LEAD_MS = 5 * 60 * 1000
const DAY_MS = 86400000

function businessDay(now: Date) {
  const { year, month, day } = zonedParts(now)
  return Date.UTC(year, month - 1, day)
}

function scheduledTimes(day: Date, today: number) {
  const offset = (day.getTime() - today) / DAY_MS
  return offset >= 0 && offset <= 45 && offset !== 2 ? WEEKLY_TIMES[day.getUTCDay()] : []
}

function withinBookingWindow(start: number, now: number) {
  return start >= now + DEMO_LEAD_MS && start <= now + 46 * DAY_MS
}

export function validateDemoSlot(dateValue: string, timeValue: string, now = new Date()) {
  const start = demoSlotToUtc(dateValue, timeValue)
  const day = new Date(dateValue + 'T00:00:00Z')
  if (!scheduledTimes(day, businessDay(now)).includes(timeValue) || !withinBookingWindow(start.getTime(), now.getTime())) {
    throw new Error('Demo time is unavailable')
  }
  return { start, end: new Date(start.getTime() + DEMO_DURATION_MINUTES * 60000) }
}

export function demoAvailability(now: Date, reserved: ReadonlySet<number>) {
  const today = businessDay(now)
  const slots: { date: string; time: string; start: number }[] = []
  for (let offset = 0; offset <= 45; offset++) {
    const calendarDay = new Date(today + offset * DAY_MS)
    const date = calendarDay.toISOString().slice(0, 10)
    for (const time of scheduledTimes(calendarDay, today)) {
      const start = demoSlotToUtc(date, time).getTime()
      if (withinBookingWindow(start, now.getTime()) && !reserved.has(start)) slots.push({ date, time, start })
    }
  }
  return slots
}

export function formatDemoSlot(start: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DEMO_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(start)
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

function safeCalendarName(value: string) {
  return value.replace(/[\r\n";:]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function createDemoCalendarInvite({
  uid,
  attendeeName,
  attendeeEmail,
  company,
  organizerEmail,
  start,
  end,
  meetingUrl,
}: CalendarInviteInput) {
  const description = [
    'A 45-minute introduction to Replova.',
    `Attendee: ${attendeeName} (${attendeeEmail})`,
    company ? `Business: ${company}` : null,
    meetingUrl ? `Google Meet: ${meetingUrl}` : null,
    'Reply to this invitation if any details need to change.',
  ].filter(Boolean).join('\n')

  return [
    'BEGIN:VCALENDAR',
    'PRODID:-//Replova//Demo Scheduler//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    'SUMMARY:Replova Tap demo',
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(meetingUrl || 'Online')}`,
    meetingUrl ? `URL:${escapeIcs(meetingUrl)}` : null,
    `ORGANIZER;CN=Replova:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${safeCalendarName(attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].filter(value => value !== null).join('\r\n')
}
