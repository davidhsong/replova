import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDemoCalendarInvite,
  demoSlotToUtc,
  formatDemoSlot,
  validateDemoSlot,
} from '../lib/demoBooking'

test('demo slots preserve Los Angeles local time across standard and daylight time', () => {
  assert.equal(demoSlotToUtc('2027-01-15', '7:30am').toISOString(), '2027-01-15T15:30:00.000Z')
  assert.equal(demoSlotToUtc('2027-07-15', '7:30am').toISOString(), '2027-07-15T14:30:00.000Z')
  assert.match(formatDemoSlot(demoSlotToUtc('2027-07-15', '3:15pm')), /Thursday, July 15, 2027 at 3:15 PM PDT/)
})

test('demo slot validation rejects unsupported, past, and distant bookings', () => {
  const now = new Date('2027-01-10T12:00:00.000Z')
  assert.throws(() => validateDemoSlot('2027-01-09', '7:30am', now))
  assert.throws(() => validateDemoSlot('2027-03-10', '7:30am', now))
  assert.throws(() => validateDemoSlot('2027-01-15', '2:00am', now))
  assert.equal(validateDemoSlot('2027-01-15', '7:30am', now).end.toISOString(), '2027-01-15T16:15:00.000Z')
})

test('calendar invite is a confirmed request with one attendee and no owner address leak', () => {
  const start = demoSlotToUtc('2027-01-15', '7:30am')
  const invite = createDemoCalendarInvite({
    uid: 'booking-id@replova.app',
    attendeeName: 'Taylor Rivera',
    attendeeEmail: 'taylor@example.com',
    company: 'Rivera Dental',
    organizerEmail: 'hello@replova.app',
    start,
    end: new Date(start.getTime() + 45 * 60 * 1000),
  })

  assert.match(invite, /METHOD:REQUEST\r\n/)
  assert.match(invite, /ORGANIZER;CN=Replova:mailto:hello@replova\.app/)
  assert.match(invite, /ATTENDEE;CN=Taylor Rivera;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:taylor@example\.com/)
  assert.match(invite, /DTSTART:20270115T153000Z/)
  assert.match(invite, /DTEND:20270115T161500Z/)
  assert.match(invite, /STATUS:CONFIRMED/)
  assert.doesNotMatch(invite, /davidhsongg/)
})
