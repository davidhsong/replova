import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import jsQR from 'jsqr'
import sharp from 'sharp'

// Hosting and scheduler credentials are supplied by the staging operator in memory.
export async function verifyScheduledTap({ origin, env, bypass, activate, arm, cleanup }) {
  assert.match(origin,/^https:\/\/replova-staging-[a-z0-9]+-davidhsongg-7397s-projects\.vercel\.app$/)
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://yhoblsunpmheyoqtdlvu.supabase.co')
  assert.equal(env.STAGING_EXPECTED_SUPABASE_PROJECT_NAME,'replova-staging')
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
  const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options)
  const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options)
  const data=r=>{if(r.error)throw Error('Staging operation failed '+r.error.code);return r.data}
  const browser=await chromium.launch()
  async function context(options) {
    const ctx=await browser.newContext({baseURL:origin,...options})
    // Set the Vercel cookie on this origin only. Pages never receive the bypass header.
    const auth=await ctx.request.get(origin+'/signin',{headers:{'x-vercel-protection-bypass':bypass,'x-vercel-set-bypass-cookie':'true'},maxRedirects:0})
    assert.ok([200,302,307].includes(auth.status()),'Preview protection handshake failed')
    return ctx
  }
  let loc
  try {
    const owner=await context({viewport:{width:390,height:844}})
    const email='tap-scope-'+randomUUID()+'@example.invalid'
    data(await admin.auth.admin.createUser({email,email_confirm:true}))
    const link=data(await admin.auth.admin.generateLink({type:'magiclink',email}))
    const {session}=data(await anon.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token}))
    const headers={Origin:origin}
    assert.equal((await owner.request.post('/api/auth/session',{headers,data:{accessToken:session.access_token,refreshToken:session.refresh_token}})).status(),200)
    const workspace='Scoped Tap rehearsal'
    assert.ok((await owner.request.post('/api/onboarding/workspace',{headers,data:{name:workspace}})).ok())
    const page=await owner.newPage()
    await page.goto('/dashboard')
    const trial=page.getByRole('button',{name:'Start my free trial'})
    if(await trial.isVisible()){await page.getByRole('checkbox').check();await trial.click();await trial.waitFor({state:'hidden'})}
    await page.goto('/dashboard/tap')
    await page.getByLabel('Location name').fill('North desk')
    await page.getByLabel('Location time zone').fill('America/Los_Angeles')
    await page.getByRole('button',{name:'Create location'}).click()
    await page.getByLabel('Placement (optional)').fill('Welcome counter')
    await page.getByRole('button',{name:'Create Tap link'}).click()
    const downloaded=page.waitForEvent('download')
    await page.getByRole('link',{name:'Download printable QR'}).click()
    const {data:pixels,info}=await sharp(await (await downloaded).path()).resize(800,800).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    const url=jsQR(new Uint8ClampedArray(pixels),info.width,info.height).data
    assert.equal(url,await page.locator('.pilot-placard code').innerText())
    assert.equal(new URL(url).origin,origin)
    const placard=data(await admin.from('tap_placards').select('location_id').eq('id',url.split('/').pop()).single())
    loc=placard.location_id
    await activate(loc,email)
    const mobile=await context({viewport:{width:360,height:640},isMobile:true,hasTouch:true,javaScriptEnabled:false})
    const form=await mobile.newPage()
    async function visit(comment) {
      await form.goto(url)
      assert.equal(await form.locator('script').count(),0)
      assert.ok((await form.locator('body').innerText()).includes(workspace+' · North desk'))
      const id=await form.locator('[name=encounter]').inputValue()
      await form.locator('.ratings label').nth(comment?1:4).tap()
      if(comment)await form.getByLabel('Comment (optional)').fill(comment)
      const start=Date.now()
      await form.getByRole('button',{name:'Send feedback'}).tap()
      await form.getByRole('heading',{name:'Thank you.'}).waitFor()
      const receiptMs=Date.now()-start
      await form.reload()
      assert.ok(await form.getByRole('heading',{name:'Thank you.'}).isVisible())
      return {id,start,receiptMs}
    }
    const comment='The waiting area was tidy and the directions were helpful.'
    const written=await visit(comment),control=await visit('')
    await arm(loc,written.id,control.id)
    let visibleMs
    for(let i=0;i<100;i++){
      await page.goto('/dashboard/feedback?location='+loc)
      if(await page.locator('#entry-'+written.id).getByText('Comment sentiment: positive',{exact:true}).count()){
        visibleMs=Date.now()-written.start;break
      }
      await delay(2000)
    }
    assert.ok(visibleMs,'Owner result was not visible within the observation window')
    assert.equal(await page.locator('.pilot-row').count(),2)
    assert.ok(await page.getByText('2 submissions in this period.',{exact:false}).count())
    assert.equal(await page.locator('#entry-'+control.id+' p').innerText(),'Rating only')
    const rows=data(await admin.from('tap_feedback').select('id,rating,sentiment,themes,analysis_status,attempts,analysis_receipt').eq('location_id',loc))
    const result=rows.find(r=>r.id===written.id),rating=rows.find(r=>r.id===control.id)
    assert.equal(rows.length,2)
    assert.equal(result.analysis_status,'ready');assert.equal(result.rating,2)
    assert.equal(result.sentiment,'positive');assert.deepEqual(result.themes,[])
    assert.ok(result.attempts>0 && result.attempts<=2)
    assert.equal(result.analysis_receipt.model,'gpt-6-luna')
    assert.match(result.analysis_receipt.requestId,/^req_/)
    assert.ok(result.analysis_receipt.inputTokens>0 && result.analysis_receipt.outputTokens>0)
    assert.deepEqual([rating.rating,rating.analysis_status,rating.attempts,rating.analysis_receipt,rating.sentiment],[5,'ready',0,null,null])
    return {location:loc,written:written.id,control:control.id,writtenReceiptMs:written.receiptMs,ratingReceiptMs:control.receiptMs,
      ownerVisibleMs:visibleMs,attempts:result.attempts,receipt:result.analysis_receipt}
  } finally {
    try {await cleanup(loc)} finally {await browser.close()}
  }
}
