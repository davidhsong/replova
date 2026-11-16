import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { NextRequest } from 'next/server'
import {
  getAuthCallbackRedirects,
  getAuthEmailRedirectTo,
  type AuthRedirectEnvironment,
} from '../lib/authRedirect'
import { authLinkErrorMessage } from '../lib/authError'
import { GET as authCallback } from '../app/auth/callback/route'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productionEnvironment: AuthRedirectEnvironment = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_BASE_URL: 'https://www.replova.app',
}

function browserRequest(url: string, origin = new URL(url).origin, extraHeaders: HeadersInit = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { Origin: origin, ...Object.fromEntries(new Headers(extraHeaders)) },
  })
}

test('production magic links return to production and preserve the feedback demo destination', () => {
  const redirect = getAuthEmailRedirectTo(
    browserRequest('https://www.replova.app/api/auth/magic-link'),
    '/dashboard/feedback-demo',
    productionEnvironment
  )

  assert.equal(
    redirect,
    'https://www.replova.app/signin?next=%2Fdashboard%2Ffeedback-demo'
  )
})

test('Vercel Preview magic links use the current allowlisted deployment instead of production', () => {
  const previewHost = 'replova-mcxthsa7l-davidhsongg-7397s-projects.vercel.app'
  const previewOrigin = `https://${previewHost}`
  const environment: AuthRedirectEnvironment = {
    ...productionEnvironment,
    VERCEL_URL: previewHost,
  }

  assert.equal(
    getAuthEmailRedirectTo(
      browserRequest(`${previewOrigin}/api/auth/magic-link`),
      '/dashboard/feedback-demo',
      environment
    ),
    `${previewOrigin}/signin?next=%2Fdashboard%2Ffeedback-demo`
  )
  assert.equal(
    getAuthEmailRedirectTo(
      browserRequest(`${previewOrigin}/api/auth/magic-link`),
      '/dashboard/feedback-demo',
      { ...productionEnvironment, NEXT_PUBLIC_VERCEL_URL: previewHost }
    ),
    `${previewOrigin}/signin?next=%2Fdashboard%2Ffeedback-demo`
  )
})

test('Playbook demo sign-in returns to the same Preview deployment', () => {
  const previewHost = 'replova-527ba6m1t-davidhsongg-7397s-projects.vercel.app'
  const previewOrigin = `https://${previewHost}`
  const environment: AuthRedirectEnvironment = {
    ...productionEnvironment,
    VERCEL_URL: previewHost,
  }

  assert.equal(
    getAuthEmailRedirectTo(
      browserRequest(`${previewOrigin}/api/auth/magic-link`),
      '/dashboard/playbook/demo',
      environment
    ),
    `${previewOrigin}/signin?next=%2Fdashboard%2Fplaybook%2Fdemo`
  )
  assert.equal(
    getAuthCallbackRedirects(
      `${previewOrigin}/auth/callback`,
      '/dashboard/playbook/demo',
      environment
    )?.success.toString(),
    `${previewOrigin}/dashboard/playbook/demo`
  )
})

test('localhost development magic links remain on localhost', () => {
  const environment: AuthRedirectEnvironment = {
    NODE_ENV: 'development',
    NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
  }

  assert.equal(
    getAuthEmailRedirectTo(
      browserRequest('http://localhost:3000/api/auth/magic-link'),
      '/dashboard/feedback-demo',
      environment
    ),
    'http://localhost:3000/signin?next=%2Fdashboard%2Ffeedback-demo'
  )
})

test('internal destinations retain query and hash while external destinations fall back safely', () => {
  const request = browserRequest('https://www.replova.app/api/auth/magic-link')

  assert.equal(
    getAuthEmailRedirectTo(
      request,
      '/dashboard/feedback-demo?view=issues#open',
      productionEnvironment
    ),
    'https://www.replova.app/signin?next=%2Fdashboard%2Ffeedback-demo%3Fview%3Dissues%23open'
  )
  assert.equal(
    getAuthEmailRedirectTo(request, 'https://attacker.example/steal', productionEnvironment),
    'https://www.replova.app/signin?next=%2Fdashboard'
  )
  assert.equal(
    getAuthEmailRedirectTo(request, '//attacker.example/steal', productionEnvironment),
    'https://www.replova.app/signin?next=%2Fdashboard'
  )
})

test('untrusted origins and spoofed hosts cannot control authentication redirects', () => {
  assert.equal(
    getAuthEmailRedirectTo(
      browserRequest('https://attacker.example/api/auth/magic-link'),
      '/dashboard/feedback-demo',
      productionEnvironment
    ),
    null
  )
  assert.equal(
    getAuthEmailRedirectTo(
      browserRequest(
        'https://www.replova.app/api/auth/magic-link',
        'https://www.replova.app',
        { 'x-forwarded-host': 'attacker.example', host: 'attacker.example' }
      ),
      '/dashboard/feedback-demo',
      productionEnvironment
    ),
    'https://www.replova.app/signin?next=%2Fdashboard%2Ffeedback-demo'
  )
  assert.equal(
    getAuthEmailRedirectTo(
      browserRequest(
        'https://attacker.example/api/auth/magic-link',
        'https://www.replova.app'
      ),
      '/dashboard/feedback-demo',
      productionEnvironment
    ),
    null
  )
})

test('callback redirects use only trusted origins and internal destinations', () => {
  const previewHost = 'replova-mcxthsa7l-davidhsongg-7397s-projects.vercel.app'
  const previewOrigin = `https://${previewHost}`
  const environment: AuthRedirectEnvironment = {
    ...productionEnvironment,
    VERCEL_URL: previewHost,
  }
  const redirects = getAuthCallbackRedirects(
    `${previewOrigin}/auth/callback`,
    '/dashboard/feedback-demo',
    environment
  )

  assert.equal(redirects?.success.toString(), `${previewOrigin}/dashboard/feedback-demo`)
  assert.equal(
    redirects?.error.toString(),
    `${previewOrigin}/signin?error=invalid_link&next=%2Fdashboard%2Ffeedback-demo`
  )
  const unsafeNext = getAuthCallbackRedirects(
    `${previewOrigin}/auth/callback`,
    'https://attacker.example/steal',
    environment
  )
  assert.equal(unsafeNext?.success.toString(), `${previewOrigin}/dashboard`)
  assert.equal(
    unsafeNext?.error.toString(),
    `${previewOrigin}/signin?error=invalid_link&next=%2Fdashboard`
  )
  assert.equal(
    getAuthCallbackRedirects(
      'https://attacker.example/auth/callback',
      '/dashboard/feedback-demo',
      environment
    ),
    null
  )
})

test('missing, invalid, and expired callback links return the safe sign-in error', async () => {
  const missing = await authCallback(new NextRequest(
    'https://www.replova.app/auth/callback?next=/dashboard/feedback-demo'
  ))
  assert.equal(missing.status, 307)
  assert.equal(
    missing.headers.get('location'),
    'https://www.replova.app/signin?error=invalid_link&next=%2Fdashboard%2Ffeedback-demo'
  )

  const invalidType = await authCallback(new NextRequest(
    'https://www.replova.app/auth/callback?token_hash=invalid&type=unexpected&next=/dashboard/feedback-demo'
  ))
  assert.equal(invalidType.status, 307)
  assert.equal(
    invalidType.headers.get('location'),
    'https://www.replova.app/signin?error=invalid_link&next=%2Fdashboard%2Ffeedback-demo'
  )

  const originalFetch = globalThis.fetch
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.invalid'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  globalThis.fetch = async () => Response.json(
    { message: 'Token has expired or is invalid' },
    { status: 400 }
  )

  try {
    const expired = await authCallback(new NextRequest(
      'https://www.replova.app/auth/callback?token_hash=expired&type=email&next=/dashboard/feedback-demo'
    ))
    assert.equal(expired.status, 307)
    assert.equal(
      expired.headers.get('location'),
      'https://www.replova.app/signin?error=invalid_link&next=%2Fdashboard%2Ffeedback-demo'
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  }
})

test('sign-in surfaces provider errors safely and keeps a retry path', () => {
  assert.equal(
    authLinkErrorMessage(
      '?next=%2Fdashboard%2Fplaybook%2Fdemo',
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
    ),
    'That sign-in link has expired or already been used. Request a new one and use the newest email.'
  )
  assert.equal(
    authLinkErrorMessage(
      '?error=invalid_link&next=%2Fdashboard%2Fplaybook%2Fdemo',
      '',
    ),
    'That sign-in link has expired or already been used. Request a new one and use the newest email.'
  )
  assert.equal(
    authLinkErrorMessage('', '#error=access_denied&error_description=<script>'),
    'That sign-in link is invalid. Request a new one and use the newest email.'
  )
  assert.equal(authLinkErrorMessage('', '#access_token=test'), null)
})

test('both OTP routes use trusted request-origin redirects and retain account safeguards', async () => {
  const magicLinkRoute = await readFile(
    path.join(repoRoot, 'app', 'api', 'auth', 'magic-link', 'route.ts'),
    'utf8'
  )
  const signupRoute = await readFile(
    path.join(repoRoot, 'app', 'api', 'auth', 'signup', 'route.ts'),
    'utf8'
  )
  const signInPage = await readFile(
    path.join(repoRoot, 'app', 'signin', 'page.tsx'),
    'utf8'
  )
  const authCallbackRoute = await readFile(
    path.join(repoRoot, 'app', 'auth', 'callback', 'route.ts'),
    'utf8'
  )
  const sessionRoute = await readFile(
    path.join(repoRoot, 'app', 'api', 'auth', 'session', 'route.ts'),
    'utf8'
  )
  const middlewareClient = await readFile(
    path.join(repoRoot, 'utils', 'supabase', 'middleware.ts'),
    'utf8'
  )
  const proxy = await readFile(path.join(repoRoot, 'proxy.ts'), 'utf8')

  for (const source of [magicLinkRoute, signupRoute]) {
    assert.match(source, /getAuthEmailRedirectTo/)
    assert.match(source, /shouldCreateUser:\s*false/)
    assert.doesNotMatch(source, /emailRedirectTo:\s*`\$\{BASE_URL\}/)
  }
  assert.match(magicLinkRoute, /\.from\(['"]accounts['"]\)/)
  assert.match(signupRoute, /email_confirm:\s*false/)
  assert.match(signInPage, /authLinkErrorMessage/)
  assert.match(signInPage, /window\.history\.replaceState/)
  assert.match(signInPage, /access_token/)
  assert.match(signInPage, /refresh_token/)
  assert.match(signInPage, /fetch\('\/api\/auth\/session'/)
  assert.match(sessionRoute, /isSameOriginRequest/)
  assert.match(sessionRoute, /auth\.setSession/)
  assert.match(sessionRoute, /auth\.getUser/)
  assert.match(authCallbackRoute, /exchangeCodeForSession/)
  assert.match(authCallbackRoute, /verifyOtp/)
  assert.match(middlewareClient, /getAll\(\)/)
  assert.match(middlewareClient, /setAll\(cookiesToSet\)/)
  assert.match(proxy, /request\.nextUrl\.pathname.*request\.nextUrl\.search/)
})
