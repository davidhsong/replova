import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { fetchYouTubeStudioCatalog } from '../lib/youtubeStudioApi'
import {
  summarizeYouTubeQueueRows,
  totalYouTubeQueueCounts,
} from '../lib/youtubeStudioView'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '030_youtube_studio_catalog.sql')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const studioIds = {
  connectionA: '10000000-0000-4000-8000-000000000001',
  connectionB: '10000000-0000-4000-8000-000000000002',
}

async function createStudioDb({ repeatMigration = false } = {}): Promise<PGlite> {
  const migrationSql = await readFile(migrationPath, 'utf8')
  const db = new PGlite()
  await db.exec(`
    CREATE FUNCTION gen_random_uuid() RETURNS uuid
    LANGUAGE sql VOLATILE
    AS $$ SELECT md5(random()::text || clock_timestamp()::text)::uuid $$;
    CREATE SCHEMA auth;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE TABLE youtube_connections (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL,
      channel_id text NOT NULL,
      channel_title text
    );
  `)
  await db.exec(migrationSql)
  if (repeatMigration) await db.exec(migrationSql)
  return db
}

async function seedStudioCatalog(db: PGlite): Promise<void> {
  await db.exec(`
    INSERT INTO youtube_connections (id, user_id, channel_id, channel_title) VALUES
      ('${studioIds.connectionA}', '20000000-0000-4000-8000-000000000001', 'channel-a', 'A'),
      ('${studioIds.connectionB}', '20000000-0000-4000-8000-000000000002', 'channel-b', 'B');
    INSERT INTO youtube_videos (connection_id, video_id, channel_id, title) VALUES
      ('${studioIds.connectionA}', 'video-a', 'channel-a', 'Video A'),
      ('${studioIds.connectionA}', 'video-b', 'channel-a', 'Video B'),
      ('${studioIds.connectionA}', 'video-c', 'channel-a', 'Video C'),
      ('${studioIds.connectionB}', 'video-only-b', 'channel-b', 'Other owner video');
    INSERT INTO youtube_playlists (connection_id, playlist_id, channel_id, title) VALUES
      ('${studioIds.connectionA}', 'playlist-a', 'channel-a', 'Playlist A'),
      ('${studioIds.connectionA}', 'playlist-b', 'channel-a', 'Playlist B'),
      ('${studioIds.connectionB}', 'playlist-only-b', 'channel-b', 'Other owner playlist');
  `)
}

async function replaceMemberships({
  db,
  connectionId = studioIds.connectionA,
  playlistId = 'playlist-a',
  memberships,
  complete,
  refreshedAt,
}: {
  db: PGlite
  connectionId?: string
  playlistId?: string
  memberships: Array<{ video_id: string; position: number }>
  complete: boolean
  refreshedAt: string
}): Promise<number> {
  const result = await db.query<{ saved: number }>(`
    SELECT replace_youtube_playlist_memberships(
      $1::uuid, $2::text, $3::jsonb, $4::boolean, $5::timestamptz
    ) AS saved
  `, [connectionId, playlistId, JSON.stringify(memberships), complete, refreshedAt])
  return result.rows[0].saved
}

test('catalog fetch follows uploads pagination and retains only owned videos in owned playlists', async () => {
  const requests: Array<{ url: URL; authorization: string | null }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    requests.push({ url, authorization: headers.get('authorization') })

    if (url.pathname.endsWith('/channels')) {
      return jsonResponse({ items: [{
        id: 'channel-a',
        snippet: {
          title: 'Channel A',
          thumbnails: { high: { url: 'https://yt.example/avatar.jpg' } },
        },
        contentDetails: { relatedPlaylists: { uploads: 'UU-channel-a' } },
        statistics: {
          subscriberCount: '1200',
          videoCount: '2',
          viewCount: '9876',
        },
      }] })
    }

    if (url.pathname.endsWith('/playlists')) {
      assert.equal(url.searchParams.get('mine'), 'true')
      return jsonResponse({ items: [
        {
          id: 'PL-owned',
          snippet: {
            channelId: 'channel-a',
            title: 'Launches',
            description: 'Product launches',
            publishedAt: '2026-11-01T00:00:00Z',
            thumbnails: { medium: { url: 'https://yt.example/playlist.jpg' } },
          },
          contentDetails: { itemCount: 3 },
        },
        {
          id: 'PL-shared',
          snippet: { channelId: 'channel-a', title: 'Shared video playlist' },
          contentDetails: { itemCount: 1 },
        },
        {
          id: 'PL-empty',
          snippet: { channelId: 'channel-a', title: 'Empty playlist' },
          contentDetails: { itemCount: 0 },
        },
        {
          id: 'PL-other-channel',
          snippet: { channelId: 'channel-b', title: 'Not owned' },
          contentDetails: { itemCount: 1 },
        },
      ] })
    }

    if (url.pathname.endsWith('/playlistItems')) {
      const playlistId = url.searchParams.get('playlistId')
      const pageToken = url.searchParams.get('pageToken')
      if (playlistId === 'UU-channel-a' && !pageToken) {
        return jsonResponse({
          nextPageToken: 'uploads-page-2',
          items: [{ snippet: { position: 0 }, contentDetails: { videoId: 'video-a' } }],
        })
      }
      if (playlistId === 'UU-channel-a' && pageToken === 'uploads-page-2') {
        return jsonResponse({
          items: [{ snippet: { position: 1 }, contentDetails: { videoId: 'video-b' } }],
        })
      }
      if (playlistId === 'PL-owned') {
        return jsonResponse({ items: [
          { snippet: { position: 0 }, contentDetails: { videoId: 'video-b' } },
          { snippet: { position: 1 }, contentDetails: { videoId: 'external-video' } },
          { snippet: { position: 2 }, contentDetails: { videoId: 'video-a' } },
        ] })
      }
      if (playlistId === 'PL-shared') {
        return jsonResponse({
          items: [{ snippet: { position: 0 }, contentDetails: { videoId: 'video-a' } }],
        })
      }
      if (playlistId === 'PL-empty') return jsonResponse({ items: [] })
    }

    if (url.pathname.endsWith('/videos')) {
      assert.equal(url.searchParams.get('part'), 'snippet,statistics,status')
      assert.equal(url.searchParams.has('maxResults'), false)
      return jsonResponse({ items: [
        {
          id: 'video-a',
          snippet: {
            channelId: 'channel-a',
            title: 'First upload',
            description: 'One',
            publishedAt: '2026-11-10T00:00:00Z',
            thumbnails: { high: { url: 'https://yt.example/video-a.jpg' } },
          },
          statistics: { viewCount: '50', commentCount: '4' },
          status: { privacyStatus: 'public' },
        },
        {
          id: 'video-b',
          snippet: {
            channelId: 'channel-a',
            title: 'Second upload',
            description: 'Two',
            publishedAt: '2026-11-11T00:00:00Z',
          },
          statistics: { viewCount: '25', commentCount: '0' },
          status: { privacyStatus: 'unlisted' },
        },
        {
          id: 'external-video',
          snippet: { channelId: 'channel-b', title: 'External upload' },
          statistics: { viewCount: '999' },
          status: { privacyStatus: 'public' },
        },
      ] })
    }

    throw new Error(`Unexpected YouTube request: ${url}`)
  }

  const catalog = await fetchYouTubeStudioCatalog({
    accessToken: 'token-user-a',
    expectedChannelId: 'channel-a',
    fetchImpl,
  })

  assert.equal(catalog.channel.title, 'Channel A')
  assert.equal(catalog.channel.avatarUrl, 'https://yt.example/avatar.jpg')
  assert.deepEqual(catalog.videos.map(video => video.videoId), ['video-a', 'video-b'])
  assert.equal(catalog.videos[1].thumbnailUrl, null)
  assert.deepEqual(catalog.playlists.map(playlist => playlist.playlistId), ['PL-owned', 'PL-shared', 'PL-empty'])
  assert.deepEqual(catalog.playlists[0].memberships, [
    { videoId: 'video-b', position: 0 },
    { videoId: 'video-a', position: 2 },
  ])
  assert.deepEqual(catalog.playlists[1].memberships, [{ videoId: 'video-a', position: 0 }])
  assert.deepEqual(catalog.playlists[2].memberships, [])
  assert.equal(catalog.uploadsComplete, true)
  assert.equal(catalog.playlistsComplete, true)
  assert.equal(catalog.partial, false)
  assert.equal(
    requests.filter(request => request.url.searchParams.get('playlistId') === 'UU-channel-a').length,
    2
  )
  assert.equal(requests.every(request => request.authorization === 'Bearer token-user-a'), true)
})

test('workflow counts remain isolated by video and preserve every queue state', () => {
  const summaries = summarizeYouTubeQueueRows([
    { video_id: 'video-a', processing_state: 'awaiting_approval', approval_status: 'pending' },
    { video_id: 'video-a', processing_state: 'ready_to_publish', approval_status: 'approved' },
    { video_id: 'video-a', processing_state: 'published', approval_status: 'approved' },
    { video_id: 'video-b', processing_state: 'publish_failed', approval_status: 'approved' },
    { video_id: 'video-b', processing_state: 'rejected', approval_status: 'rejected' },
  ])

  assert.deepEqual(summaries.get('video-a'), {
    syncedComments: 3,
    needsReview: 1,
    approved: 1,
    published: 1,
    failed: 0,
    skipped: 0,
  })
  assert.deepEqual(summaries.get('video-b'), {
    syncedComments: 2,
    needsReview: 0,
    approved: 0,
    published: 0,
    failed: 1,
    skipped: 1,
  })
  assert.deepEqual(totalYouTubeQueueCounts(summaries.values()), {
    syncedComments: 5,
    needsReview: 1,
    approved: 1,
    published: 1,
    failed: 1,
    skipped: 1,
  })
})

test('migration 030 is repeatable and rejects direct cross-channel or cross-connection memberships', async () => {
  const db = await createStudioDb({ repeatMigration: true })
  await seedStudioCatalog(db)

  await assert.rejects(
    db.query(`
      INSERT INTO youtube_videos (connection_id, video_id, channel_id, title)
      VALUES ('${studioIds.connectionA}', 'wrong-channel', 'channel-b', 'Wrong channel')
    `),
    /foreign key/i
  )
  await assert.rejects(
    db.query(`
      INSERT INTO youtube_playlist_videos (connection_id, playlist_id, video_id, position)
      SELECT '${studioIds.connectionA}', playlist.id, video.id, 0
      FROM youtube_playlists AS playlist, youtube_videos AS video
      WHERE playlist.connection_id = '${studioIds.connectionA}' AND playlist.playlist_id = 'playlist-a'
        AND video.connection_id = '${studioIds.connectionB}' AND video.video_id = 'video-only-b'
    `),
    /foreign key/i
  )
  await assert.rejects(
    db.query(`
      INSERT INTO youtube_playlist_videos (connection_id, playlist_id, video_id, position)
      SELECT '${studioIds.connectionB}', playlist.id, video.id, 0
      FROM youtube_playlists AS playlist, youtube_videos AS video
      WHERE playlist.connection_id = '${studioIds.connectionA}' AND playlist.playlist_id = 'playlist-a'
        AND video.connection_id = '${studioIds.connectionB}' AND video.video_id = 'video-only-b'
    `),
    /foreign key/i
  )

  const saved = await replaceMemberships({
    db,
    memberships: [{ video_id: 'video-only-b', position: 0 }],
    complete: true,
    refreshedAt: new Date(Date.now() - 4_000).toISOString(),
  })
  const count = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM youtube_playlist_videos')
  assert.equal(saved, 0)
  assert.equal(count.rows[0].count, 0)
  await db.close()
})

test('full playlist replacement deduplicates canonical videos and preserves multi-playlist membership', async () => {
  const db = await createStudioDb()
  await seedStudioCatalog(db)
  const firstAt = new Date(Date.now() - 4_000).toISOString()
  const secondAt = new Date(Date.now() - 3_000).toISOString()
  const thirdAt = new Date(Date.now() - 2_000).toISOString()

  assert.equal(await replaceMemberships({
    db,
    memberships: [
      { video_id: 'video-a', position: 5 },
      { video_id: 'video-a', position: 1 },
      { video_id: 'video-b', position: 2 },
    ],
    complete: true,
    refreshedAt: firstAt,
  }), 2)
  assert.equal(await replaceMemberships({
    db,
    playlistId: 'playlist-b',
    memberships: [{ video_id: 'video-a', position: 0 }],
    complete: true,
    refreshedAt: secondAt,
  }), 1)
  assert.equal(await replaceMemberships({
    db,
    memberships: [{ video_id: 'video-c', position: 4 }],
    complete: true,
    refreshedAt: thirdAt,
  }), 1)

  const rows = await db.query<{ playlist_id: string; video_id: string; position: number }>(`
    SELECT playlist.playlist_id, video.video_id, membership.position
    FROM youtube_playlist_videos AS membership
    JOIN youtube_playlists AS playlist ON playlist.id = membership.playlist_id
    JOIN youtube_videos AS video ON video.id = membership.video_id
    ORDER BY playlist.playlist_id, membership.position
  `)
  assert.deepEqual(rows.rows, [
    { playlist_id: 'playlist-a', video_id: 'video-c', position: 4 },
    { playlist_id: 'playlist-b', video_id: 'video-a', position: 0 },
  ])
  await db.close()
})

test('partial playlist refreshes are additive and never erase valid existing memberships', async () => {
  const db = await createStudioDb()
  await seedStudioCatalog(db)
  const firstAt = new Date(Date.now() - 4_000).toISOString()
  const partialAt = new Date(Date.now() - 3_000).toISOString()
  const emptyPartialAt = new Date(Date.now() - 2_000).toISOString()

  await replaceMemberships({
    db,
    memberships: [{ video_id: 'video-a', position: 0 }],
    complete: true,
    refreshedAt: firstAt,
  })
  await replaceMemberships({
    db,
    memberships: [{ video_id: 'video-b', position: 1 }],
    complete: false,
    refreshedAt: partialAt,
  })
  await replaceMemberships({
    db,
    memberships: [],
    complete: false,
    refreshedAt: emptyPartialAt,
  })

  const rows = await db.query<{ video_id: string; position: number }>(`
    SELECT video.video_id, membership.position
    FROM youtube_playlist_videos AS membership
    JOIN youtube_videos AS video ON video.id = membership.video_id
    ORDER BY membership.position
  `)
  const playlist = await db.query<{ complete: boolean; synced_at: string }>(`
    SELECT membership_complete AS complete, membership_synced_at::text AS synced_at
    FROM youtube_playlists
    WHERE connection_id = '${studioIds.connectionA}' AND playlist_id = 'playlist-a'
  `)
  assert.deepEqual(rows.rows, [
    { video_id: 'video-a', position: 0 },
    { video_id: 'video-b', position: 1 },
  ])
  assert.equal(playlist.rows[0].complete, false)
  assert.ok(playlist.rows[0].synced_at)
  await db.close()
})

test('serialized concurrent replacements reject stale generations after acquiring the playlist lock', async () => {
  const db = await createStudioDb()
  await seedStudioCatalog(db)
  const olderAt = new Date(Date.now() - 4_000).toISOString()
  const newerAt = new Date(Date.now() - 2_000).toISOString()

  const newer = replaceMemberships({
    db,
    memberships: [{ video_id: 'video-b', position: 0 }],
    complete: true,
    refreshedAt: newerAt,
  })
  const stale = replaceMemberships({
    db,
    memberships: [{ video_id: 'video-a', position: 0 }],
    complete: true,
    refreshedAt: olderAt,
  })
  const [newerSaved, staleSaved] = await Promise.all([newer, stale])

  const rows = await db.query<{ video_id: string }>(`
    SELECT video.video_id
    FROM youtube_playlist_videos AS membership
    JOIN youtube_videos AS video ON video.id = membership.video_id
  `)
  assert.equal(newerSaved, 1)
  assert.equal(staleSaved, 0)
  assert.deepEqual(rows.rows, [{ video_id: 'video-b' }])
  await db.close()
})

test('hub routes preserve owner scoping, saved queue state, confirmation, and mobile layout', async () => {
  const [studioRoute, queueRoute, persistence, migration, queueUi, studioUi, styles, worker] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'api', 'youtube', 'studio', 'route.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'api', 'youtube', 'reply-queue', 'route.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'lib', 'youtubeStudioPersistence.ts'), 'utf8'),
    readFile(migrationPath, 'utf8'),
    readFile(path.join(repoRoot, 'components', 'youtube', 'YouTubeReplyQueue.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'youtube', 'YouTubeStudioClient.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'globals.css'), 'utf8'),
    readFile(path.join(repoRoot, 'lib', 'youtubeAutomationWorker.ts'), 'utf8'),
  ])

  assert.match(studioRoute, /\.eq\('user_id', user\.id\)/)
  assert.match(studioRoute, /\.eq\('connection_id', connectionId\)/)
  assert.match(studioRoute, /\.in\('playlist_id', playlistInternalIds\)/)
  assert.match(queueRoute, /query = query\.eq\('video_id', videoId\)/)
  assert.match(queueRoute, /\.eq\('connection_id', connection\.id\)/)
  assert.doesNotMatch(persistence, /youtube_comment_queue|generated_reply|edited_reply|approval_status/)
  assert.match(persistence, /catalog\.uploadsComplete/)
  assert.match(persistence, /is_available: false/)
  assert.match(persistence, /catalog\.playlistsComplete/)
  assert.match(persistence, /is_active: false/)
  assert.match(persistence, /p_membership_complete: playlist\.membershipComplete/)
  assert.match(persistence, /p_refreshed_at: syncedAt/)
  assert.match(migration, /UNIQUE \(connection_id, video_id\)/)
  assert.match(migration, /FOREIGN KEY \(connection_id, playlist_id\)[\s\S]*REFERENCES youtube_playlists\(connection_id, id\)/)
  assert.match(migration, /FOREIGN KEY \(connection_id, video_id\)[\s\S]*REFERENCES youtube_videos\(connection_id, id\)/)
  assert.match(migration, /FOREIGN KEY \(connection_id, channel_id\)[\s\S]*REFERENCES youtube_connections\(id, channel_id\)/)
  assert.match(migration, /FOR UPDATE/)
  assert.match(migration, /p_refreshed_at <= target_membership_synced_at/)
  assert.match(migration, /IF p_membership_complete THEN/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION replace_youtube_playlist_memberships[\s\S]*TO service_role/)
  assert.doesNotMatch(migration, /UPDATE\s+youtube_comment_queue|DELETE\s+FROM\s+youtube_comment_queue/i)
  assert.match(queueUi, /confirmed: true/)
  assert.match(queueUi, /Publish this saved reply to YouTube\?/)
  assert.match(studioUi, /Thumbnail unavailable/)
  assert.match(studioUi, /Search video titles and indexed comments/)
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*youtube-studio-video-grid \{ grid-template-columns: 1fr/)
  assert.match(styles, /youtube-studio-nav-links a \{ min-height: 46px/)
  assert.doesNotMatch(worker, /verifyAndPublishYouTubeReply|claim_youtube_publish/i)
})
