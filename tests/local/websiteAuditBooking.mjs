import assert from 'node:assert/strict'
import net from 'node:net'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright-core'

// Run against the disposable PostgREST rehearsal with SMTP directed to loopback.
export async function checkDemoBooking(origin) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  // Next normalizes loopback request URLs to localhost. Use that same browser origin.
  origin = 'http://localhost:3673'
  const messages = []
  const smtp = net.createServer(socket => {
    socket.setEncoding('utf8')
    socket.write('220 localhost audit capture\r\n')
    let buffer = '', message = '', collecting = false
    socket.on('data', chunk => {
      buffer += chunk
      while (buffer.includes('\r\n')) {
        const index = buffer.indexOf('\r\n')
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        if (collecting && line !== '.') { message += line + '\n'; continue }
        if (collecting) { collecting = false; messages.push(message); message = ''; socket.write('250 queued\r\n') }
        else if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n')
        else if (/^AUTH/.test(line)) socket.write('235 authenticated\r\n')
        else if (/^RCPT TO:<rejected@example\.invalid>/i.test(line)) socket.write('550 recipient rejected\r\n')
        else if (/^DATA/.test(line)) { collecting = true; socket.write('354 send message\r\n') }
        else if (/^QUIT/.test(line)) socket.end('221 bye\r\n')
        else socket.write('250 OK\r\n')
      }
    })
  })
  await new Promise((resolve, reject) => smtp.once('error', reject).listen(3688, '127.0.0.1', resolve))
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce' })
    await page.goto(origin + '/industries/hotels-short-stays')
    await page.getByRole('main').getByRole('link', { name: 'Request a demo' }).click()
    await page.waitForURL('**/demo?industry=hotels-short-stays')
    const api = origin + '/api/demo/book'
    const slots = (await (await fetch(api)).json()).slots
    const slot = slots[0]
    for (const [view, selector] of [['Month view','[class*=timeButtons] button'],['Weekly grid view','[class*=hourRow] button'],['Weekly column view','[class*=weekColumns] button']]) {
      await page.getByRole('button',{name:view, exact:true}).click()
      await page.locator(selector).first().click()
      await page.getByRole('dialog').waitFor()
      assert.equal(await page.locator('input[name=name]').evaluate(el=>el===document.activeElement),true)
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button',{name:'Month view',exact:true}).click()
    await page.locator('[class*=timeButtons] button').first().click()
    await page.getByLabel('Name',{exact:true}).fill('Audit visitor')
    await page.getByLabel('Email',{exact:true}).fill('ui@example.invalid')
    const requestId = randomUUID()
    const post = (id, chosen=slot, email='local-'+id+'@example.invalid') => fetch(api,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({...chosen,requestId:id,name:'Test visitor',email})})
    const secondId = randomUUID()
    const results = await Promise.all([post(requestId), post(secondId)])
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
    assert.equal((await post(results[0].ok ? requestId : secondId)).status,200)
    assert.equal(messages.length,1)
    await page.getByRole('button',{name:'Send calendar invite'}).click()
    await page.getByRole('dialog').waitFor({state:'hidden'})
    await page.locator('[class*=timeButtons] button').first().click()
    assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'Audit visitor')
    await page.getByRole('button',{name:'Send calendar invite'}).click()
    await page.getByRole('heading',{name:'Calendar invite sent'}).waitFor()
    assert.equal(messages.length,2)
    assert.match(messages[0],/text\/calendar/i)
    await page.getByRole('button',{name:'Done'}).click()
    await page.getByLabel('Time zone').selectOption('America/New_York')
    const updated = (await (await fetch(api)).json()).slots
    assert.ok(!updated.some(s=>s.start===slot.start))
    const partialId = randomUUID()
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await post(partialId, updated[0], 'rejected@example.invalid')).status, 503)
    }
    assert.equal(messages.length, 3, 'An owner-only delivery must not send again on retry')
    assert.equal((await post(randomUUID(), updated[0])).status, 409)
    await page.clock.setFixedTime(new Date('2026-11-25T19:59:00-08:00'))
    const lateNovember = { date: '2026-11-28', time: '9:00am', start: Date.parse('2026-11-28T17:00Z') }
    const lateDecember = { date: '2026-12-29', time: '7:30am', start: Date.parse('2026-12-29T15:30Z') }
    let available = [lateNovember, lateDecember]
    await page.route('**/api/demo/book', route => route.fulfill({ json: { slots: available } }))
    await page.reload()
    await page.getByRole('button', { name: '9:00am', exact: true }).waitFor()
    for (const day of [24, 25, 26]) {
      const date = new Date(2026, 10, day).toLocaleDateString('en-US', { dateStyle: 'full' })
      assert.ok(await page.getByRole('button', { name: date, exact: true }).isDisabled())
    }
    await page.getByRole('button', { name: 'Weekly column view' }).click()
    assert.match(await page.locator('[class*=weekRange] strong').innerText(), /Nov.*Dec/)
    await page.getByRole('button', { name: 'Next week' }).click()
    assert.match(await page.locator('[class*=weekRange] strong').innerText(), /Dec.*2026.*Jan.*2027/)
    await page.getByLabel('Time zone').selectOption('America/New_York')
    await page.getByRole('button', { name: '10:30am', exact: true }).click()
    assert.match(await page.locator('[class*=bookingSummary] strong').innerText(), /10:30/)
    available = []
    await page.reload()
    await page.getByText('No times are available in the booking window.').waitFor()
    console.log('PASS frozen clock, cross-month and cross-year ranges, time zone conversion and empty window')
    console.log('PASS three calendar views, focus/Escape, concurrent slot claim, SMTP capture, retained form, confirmed booking and time zone selection')
  } finally {
    await browser.close()
    await new Promise(resolve => smtp.close(resolve))
  }
}
