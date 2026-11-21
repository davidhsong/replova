import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

export async function scopedAnalysis({ origin, cron, client, session, scopedCalls }) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  const sql = async (query, params = []) => (await client.query(query, params)).rows
  const [a] = await sql('select id,account_id from business_workspaces limit 1')
  const [b] = await sql("insert into accounts(owner_email) values('scope-b@example.invalid') returning id")
  const [wb] = await sql("insert into business_workspaces(account_id,name) values($1,'Business B') returning id",[b.id])
  async function site(workspace, name) {
    const [loc] = await sql("insert into restaurants(workspace_id,owner_email,name,active) select $1,owner_email,$3,true from accounts where id=$2 returning id",[workspace.id,workspace.account_id,name])
    const [placard] = await sql("insert into tap_placards(location_id,placement) values($1,'Welcome counter') returning id",[loc.id])
    return { id:loc.id, url:origin+'/t/'+placard.id }
  }
  const a1 = await site(a,'A1'), a2 = await site(a,'A2'), b1 = await site({id:wb.id,account_id:b.id},'B1')
  const tick = async () => {
    const response = await fetch(origin+'/api/cron/pilot',{headers:{Authorization:'Bearer '+cron}})
    assert.equal(response.status,200)
    return (await response.json()).claimed
  }
  const activate = () => sql('insert into tap_analysis_locations(location_id,remaining_claims) values($1,2)',[a1.id])
  const pause = () => sql('delete from tap_analysis_locations where location_id=$1',[a1.id])
  const browser = await chromium.launch()
  try {
    const phone = await browser.newContext({javaScriptEnabled:false,viewport:{width:360,height:640}})
    const form = await phone.newPage()
    async function visit(site, comment) {
      await form.goto(site.url)
      const id = await form.locator('[name=encounter]').inputValue()
      await form.locator('.ratings label').nth(1).click()
      await form.getByLabel('Comment (optional)').fill(comment)
      await form.getByRole('button',{name:'Send feedback'}).click()
      assert.ok(await form.getByText('Your feedback was received.',{exact:false}).isVisible())
      await form.goto(site.url+'?visit='+id)
      assert.ok(await form.getByRole('heading',{name:'Thank you.'}).isVisible())
      assert.ok((await sql("select status from tap_resume($1,$2)",[site.url.split('/').pop(),id]))[0].status==='received')
      return id
    }
    const old = await visit(a1,'Before activation')
    for (const excluded of [a2,b1]) {
      await visit(excluded,'Excluded prior visit')
      await visit(excluded,'Excluded prior retry')
      await sql("update tap_feedback set analysis_status='failed', attempts=1, next_attempt=now()-interval '2 days' where location_id=$1",[excluded.id])
    }
    assert.equal(await tick(),0)
    assert.equal((await sql('select * from tap_claim_analysis()')).length,0)
    await assert.rejects(sql('insert into tap_analysis_locations(location_id) values(gen_random_uuid())'), /foreign key/)
    for (const role of ['anon','authenticated']) {
      await sql('set role '+role)
      try {
        await assert.rejects(sql('insert into tap_analysis_locations(location_id) values($1)',[a2.id]),/permission denied/)
        await assert.rejects(sql('select * from tap_claim_scoped_analysis()'),/permission denied/)
      } finally { await sql('reset role') }
    }
    await activate()
    const written = 'Equipment rattled by the window'
    const id = await visit(a1,written), control = await visit(a1,'')
    assert.equal((await Promise.all([tick(),tick()])).reduce((x,y)=>x+y,0),1)
    assert.deepEqual(scopedCalls,[written])
    assert.equal((await sql('select analysis_status from tap_feedback where id=$1',[id]))[0].analysis_status,'failed')
    await sql('select tap_retry_analysis($1,$2)',[a1.id,id])
    assert.equal(await tick(),1)
    assert.deepEqual(scopedCalls,[written,written])
    assert.equal((await sql('select remaining_claims from tap_analysis_locations'))[0].remaining_claims,0)
    const [ready] = await sql('select analysis_status,attempts,sentiment from tap_feedback where id=$1',[control])
    assert.deepEqual(ready,{analysis_status:'ready',attempts:0,sentiment:null})
    assert.equal((await sql('select attempts from tap_feedback where id=$1',[old]))[0].attempts,0)
    const owner = await browser.newContext()
    await owner.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:origin}])
    const page = await owner.newPage()
    for (const [loc,total] of [[a1,3],[a2,2]]) {
      const switchLocation = await owner.request.post(origin+'/api/active-location',{data:{restaurantId:loc.id}})
      assert.equal(switchLocation.status(),200)
      await page.goto(origin+'/dashboard/feedback',{waitUntil:'domcontentloaded',timeout:90000})
      assert.equal(await page.locator('.pilot-row').count(),total)
      assert.ok(await page.getByText(total+' submissions in this period.',{exact:false}).count())
      assert.ok(await page.getByText('Saved · analysis not scheduled',{exact:true}).count())
      assert.equal(await page.getByRole('button',{name:'Retry analysis'}).count(),0)
    }
    assert.equal((await sql('select count(*)::int n from tap_feedback where location_id=$1',[b1.id]))[0].n,2)
    await sql('select tap_retry_analysis($1,id) from tap_feedback where location_id=$1',[a2.id])
    assert.equal((await sql("select count(*)::int n from tap_feedback where location_id=any($1) and attempts=1 and analysis_status='failed'",[[a2.id,b1.id]]))[0].n,4)
    await pause()
    await activate()
    const abandoned = await visit(a1,'Lease test')
    const [first] = await sql('select lease from tap_claim_scoped_analysis()')
    await sql("update tap_feedback set next_attempt=now()-interval '1 second' where id=$1",[abandoned])
    const [second] = await sql('select lease from tap_claim_scoped_analysis()')
    assert.notEqual(first.lease,second.lease)
    const canStart = async lease => (await sql('select tap_analysis_can_start($1,$2) ok',[abandoned,lease]))[0].ok
    assert.equal(await canStart(first.lease),false)
    assert.equal(await canStart(second.lease),true)
    await pause()
    assert.equal(await canStart(second.lease),false)
    await activate()
    assert.equal(await canStart(second.lease),false)
    assert.equal(await tick(),0)
    assert.deepEqual(scopedCalls,[written,written])
    console.log('PASS two workspaces, three placards, scoped overlap, retry, expired leases, activation windows, role restrictions, owner switch, receipts and rating-only control')
  } finally { await browser.close() }
}
