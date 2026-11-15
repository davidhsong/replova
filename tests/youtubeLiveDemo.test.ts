import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { requestYouTubeCommentThreadsPage } from '../lib/youtubeCommentApiPage'
import {
  canReconnectYouTubeChannel,
  createYouTubeOAuthState,
  getYouTubeRedirectUri,
  verifyYouTubeOAuthState,
  youtubeOAuthStatesMatch,
} from '../lib/youtubeOAuth'

function withYouTubeKey<T>(run: () => T): T {
  const original = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
  process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  try {
    return run()
  } finally {
    if (original === undefined) delete process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
    else process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = original
  }
}

test('OAuth state is short-lived and bound to one authenticated owner and workspace', () => {
  withYouTubeKey(() => {
    const nowMs = Date.UTC(2026, 10, 14, 12, 0, 0)
    const state = createYouTubeOAuthState({
      userId: 'user-a',
      workspaceId: 'workspace-a',
      nowMs,
    })

    assert.equal(youtubeOAuthStatesMatch(state, state), true)
    assert.equal(verifyYouTubeOAuthState({ state, userId: 'user-a', workspaceId: 'workspace-a', nowMs }), true)
    assert.equal(verifyYouTubeOAuthState({ state, userId: 'user-b', workspaceId: 'workspace-a', nowMs }), false)
    assert.equal(verifyYouTubeOAuthState({ state, userId: 'user-a', workspaceId: 'workspace-b', nowMs }), false)
    assert.equal(verifyYouTubeOAuthState({ state, userId: 'user-a', workspaceId: 'workspace-a', nowMs: nowMs + 600_000 }), false)

    const tampered = `${state.slice(0, -1)}${state.endsWith('A') ? 'B' : 'A'}`
    assert.equal(verifyYouTubeOAuthState({ state: tampered, userId: 'user-a', workspaceId: 'workspace-a', nowMs }), false)
  })
})

test('OAuth callback URI is exact and rejects non-origin base URLs', () => {
  assert.equal(
    getYouTubeRedirectUri('https://www.replova.app'),
    'https://www.replova.app/api/auth/youtube/callback'
  )
  assert.throws(() => getYouTubeRedirectUri('https://www.replova.app/unexpected'))
  assert.throws(() => getYouTubeRedirectUri('https://user:password@www.replova.app'))
})

test('reconnect preserves a connection only for the same authorized channel', () => {
  assert.equal(canReconnectYouTubeChannel(null, 'channel-a'), true)
  assert.equal(canReconnectYouTubeChannel('channel-a', 'channel-a'), true)
  assert.equal(canReconnectYouTubeChannel('channel-a', 'channel-b'), false)
})

test('mocked YouTube pages retain multiple video ids and advance the API page token', async () => {
  const requestedUrls: URL[] = []
  const responses = [
    {
      nextPageToken: 'page-2',
      items: [
        { id: 'thread-a', snippet: { videoId: 'video-a', topLevelComment: { id: 'comment-a' } } },
        { id: 'thread-b', snippet: { videoId: 'video-b', topLevelComment: { id: 'comment-b' } } },
      ],
    },
    {
      items: [
        { id: 'thread-c', snippet: { videoId: 'video-c', topLevelComment: { id: 'comment-c' } } },
      ],
    },
  ]
  const fetchImpl: typeof fetch = async input => {
    requestedUrls.push(new URL(String(input)))
    const body = responses.shift()
    assert.ok(body)
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const first = await requestYouTubeCommentThreadsPage({
    accessToken: 'access-user-a',
    channelId: 'channel-a',
    maxResults: 100,
    fetchImpl,
  })
  const second = await requestYouTubeCommentThreadsPage({
    accessToken: 'access-user-a',
    channelId: 'channel-a',
    pageToken: first.data.nextPageToken,
    maxResults: 100,
    fetchImpl,
  })

  assert.deepEqual(first.data.items?.map(item => item.snippet?.videoId), ['video-a', 'video-b'])
  assert.deepEqual(second.data.items?.map(item => item.snippet?.videoId), ['video-c'])
  assert.equal(requestedUrls[0].searchParams.get('allThreadsRelatedToChannelId'), 'channel-a')
  assert.equal(requestedUrls[0].searchParams.get('pageToken'), null)
  assert.equal(requestedUrls[1].searchParams.get('pageToken'), 'page-2')
  assert.equal(requestedUrls.every(url => url.searchParams.get('order') === 'time'), true)
})

test('YouTube routes enforce owner isolation without restaurant or developer allowlists', async () => {
  const [start, callback, comments, queue, knowledge, publish, settings] = await Promise.all([
    readFile(new URL('../app/api/auth/youtube/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/auth/youtube/callback/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/comments/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/reply-queue/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/replies/generate/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/replies/publish/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/settings/page.tsx', import.meta.url), 'utf8'),
  ])
  const serverSources = `${start}\n${callback}\n${comments}\n${queue}\n${knowledge}\n${publish}`

  assert.match(start, /getYouTubeWorkspaceForUser/)
  assert.match(callback, /verifyYouTubeOAuthState/)
  assert.match(callback, /userId: user\.id/)
  assert.match(callback, /user_id: user\.id/)
  assert.equal((serverSources.match(/\.eq\('user_id', user\.id\)/g) ?? []).length >= 5, true)
  assert.doesNotMatch(serverSources, /DEVELOPER_EMAILS|developerAccess|restaurants?\b/i)
  assert.match(publish, /body\.confirmed !== true/)
  assert.match(settings, /Publish this reply publicly on YouTube\?/)
  assert.match(settings, /href="\/api\/auth\/youtube" className="text-link">Reconnect/)
  assert.match(settings, /JSON\.stringify\(\{ confirmed: true \}\)/)
})

test('background worker remains sync-and-draft only with no unattended publishing path', async () => {
  const [worker, endpoint, policy] = await Promise.all([
    readFile(new URL('../lib/youtubeAutomationWorker.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/automation/run/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/automation/policy/route.ts', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(`${worker}\n${endpoint}`, /verifyAndPublishYouTubeReply|comments\?part=snippet|claim_youtube_publish/i)
  assert.match(policy, /runtimeEnabled: false/)
})
