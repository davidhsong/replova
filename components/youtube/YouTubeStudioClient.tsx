'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { IconExternal, IconRefresh, IconSearch } from '@/components/icons'
import type { YouTubeStudioQueueCounts } from '@/lib/youtubeStudioView'

type Channel = {
  channelId: string
  title: string
  avatarUrl: string | null
  channelUrl: string
  subscriberCount: number | null
  subscriberCountHidden: boolean
  videoCount: number | null
  viewCount: number | null
  syncedAt: string | null
  partial: boolean
}

type Video = {
  videoId: string
  title: string
  description: string
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number | null
  commentCount: number | null
  privacyStatus: 'public' | 'unlisted' | 'private' | null
  uploadPosition: number | null
  available: boolean
  syncedAt: string
  queue: YouTubeStudioQueueCounts
}

type Playlist = {
  playlistId: string
  title: string
  description: string
  thumbnailUrl: string | null
  publishedAt: string | null
  itemCount: number
  ownedVideoCount: number
  membershipComplete: boolean
  syncedAt: string
  videoIds: string[]
}

type StudioData = {
  connected: true
  channel: Channel
  videos: Video[]
  allVideoCount: number
  playlists: Playlist[]
  selectedPlaylist: Playlist | null
  totals: YouTubeStudioQueueCounts
  queueTruncated: boolean
  needsRefresh: boolean
}

type Props = {
  mode: 'overview' | 'videos' | 'playlists' | 'playlist'
  playlistId?: string
}

function formatNumber(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function Thumbnail({ src, title, kind = 'video' }: { src: string | null; title: string; kind?: 'video' | 'playlist' }) {
  return (
    <div className={`youtube-studio-thumbnail is-${kind}`}>
      {src ? (
        // YouTube thumbnail URLs are rendered unchanged, without an image proxy or transformation.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Thumbnail for ${title}`} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="youtube-studio-thumbnail-missing">
          <span aria-hidden="true" />
          <small>Thumbnail unavailable</small>
        </div>
      )}
    </div>
  )
}

function VideoCard({ video, index }: { video: Video; index: number }) {
  return (
    <article className="youtube-studio-video-card" style={{ '--video-index': index } as CSSProperties}>
      <Link href={`/dashboard/youtube/videos/${encodeURIComponent(video.videoId)}`} className="youtube-studio-video-link">
        <Thumbnail src={video.thumbnailUrl} title={video.title} />
        <div className="youtube-studio-video-copy">
          <div className="youtube-studio-video-title-row">
            <h2>{video.title}</h2>
            {video.privacyStatus && video.privacyStatus !== 'public' && <span>{video.privacyStatus}</span>}
          </div>
          <p>{formatDate(video.publishedAt)}</p>
        </div>
      </Link>
      <div className="youtube-studio-video-metrics" aria-label={`Metrics for ${video.title}`}>
        <span><strong>{formatNumber(video.viewCount)}</strong> views</span>
        <span><strong>{formatNumber(video.commentCount)}</strong> YouTube comments</span>
        <span><strong>{video.queue.syncedComments}</strong> synced</span>
      </div>
      <div className="youtube-studio-workflow-counts">
        <Link href={`/dashboard/youtube/videos/${encodeURIComponent(video.videoId)}`} data-tone={video.queue.needsReview > 0 ? 'attention' : 'quiet'}>
          <strong>{video.queue.needsReview}</strong><span>Needs review</span>
        </Link>
        <Link href={`/dashboard/youtube/videos/${encodeURIComponent(video.videoId)}`}>
          <strong>{video.queue.approved}</strong><span>Approved</span>
        </Link>
        <Link href={`/dashboard/youtube/videos/${encodeURIComponent(video.videoId)}`} data-tone="positive">
          <strong>{video.queue.published}</strong><span>Published</span>
        </Link>
        <Link href={`/dashboard/youtube/videos/${encodeURIComponent(video.videoId)}`} data-tone={video.queue.failed > 0 ? 'negative' : 'quiet'}>
          <strong>{video.queue.failed}</strong><span>Failed</span>
        </Link>
      </div>
    </article>
  )
}

function VideoGrid({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <div className="youtube-studio-empty">
        <strong>No matching videos</strong>
        <p>Refresh channel content or clear the search to see uploaded videos.</p>
      </div>
    )
  }
  return (
    <div className="youtube-studio-video-grid">
      {videos.map((video, index) => <VideoCard key={video.videoId} video={video} index={index} />)}
    </div>
  )
}

function PlaylistGrid({ playlists, allVideoCount }: { playlists: Playlist[]; allVideoCount: number }) {
  return (
    <div className="youtube-studio-playlist-grid">
      <Link href="/dashboard/youtube/videos" className="youtube-studio-playlist-card is-all-videos">
        <div className="youtube-studio-all-videos-art" aria-hidden="true"><span /><span /><span /></div>
        <div><h2>All Videos</h2><p>{allVideoCount} indexed upload{allVideoCount === 1 ? '' : 's'}, including videos with no synced comments.</p></div>
      </Link>
      {playlists.map(playlist => (
        <Link
          href={`/dashboard/youtube/playlists/${encodeURIComponent(playlist.playlistId)}`}
          className="youtube-studio-playlist-card"
          key={playlist.playlistId}
        >
          <Thumbnail src={playlist.thumbnailUrl} title={playlist.title} kind="playlist" />
          <div>
            <h2>{playlist.title}</h2>
            <p>
              {playlist.ownedVideoCount} owned video{playlist.ownedVideoCount === 1 ? '' : 's'} in playlist order
              {playlist.itemCount !== playlist.ownedVideoCount ? ` · ${playlist.itemCount} total items` : ''}
            </p>
            {!playlist.membershipComplete && <small>Partial playlist index</small>}
          </div>
        </Link>
      ))}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="youtube-studio-loading" aria-label="Loading YouTube channel content">
      <div className="youtube-studio-channel-skeleton skeleton" />
      <div className="youtube-studio-video-grid">
        {[0, 1, 2, 3].map(item => <div key={item} className="youtube-studio-card-skeleton skeleton" />)}
      </div>
    </div>
  )
}

export default function YouTubeStudioClient({ mode, playlistId }: Props) {
  const [data, setData] = useState<StudioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const autoRefreshAttempted = useRef(false)
  const searchReady = useRef(false)

  const load = useCallback(async (query = '') => {
    setError(null)
    const params = new URLSearchParams()
    if (playlistId) params.set('playlistId', playlistId)
    if (query.trim()) params.set('q', query.trim())
    const response = await fetch(`/api/youtube/studio${params.size ? `?${params}` : ''}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error ?? 'Could not load YouTube channel content.')
    const nextData = payload as StudioData
    setData(nextData)
    return nextData
  }, [playlistId])

  const refresh = useCallback(async ({ automatic = false }: { automatic?: boolean } = {}) => {
    setSyncing(true)
    if (!automatic) setNotice(null)
    setError(null)
    try {
      const response = await fetch('/api/youtube/studio', { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Could not refresh YouTube channel content.')
      await load()
      setNotice(payload.partial === true
        ? 'Channel content refreshed within the configured pagination limits.'
        : `Channel refreshed: ${payload.videos ?? 0} videos and ${payload.playlists ?? 0} playlists indexed.`)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh YouTube channel content.')
    } finally {
      setSyncing(false)
    }
  }, [load])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      void load().then(nextData => {
        if (cancelled || !nextData.needsRefresh || autoRefreshAttempted.current) return
        autoRefreshAttempted.current = true
        void refresh({ automatic: true })
      }).catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load YouTube channel content.')
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [load, refresh])

  useEffect(() => {
    if (mode !== 'videos' && mode !== 'playlist') return
    if (!searchReady.current) {
      searchReady.current = true
      return
    }
    const timeout = window.setTimeout(() => {
      setLoading(true)
      void load(search).catch(searchError => {
        setError(searchError instanceof Error ? searchError.message : 'Could not search YouTube content.')
      }).finally(() => setLoading(false))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [load, mode, search])

  if (loading && !data) return <LoadingState />
  if (!data) {
    return (
      <div className="youtube-studio-blocked">
        <span className="t-eyebrow">YouTube content</span>
        <h1>Connect your channel to continue</h1>
        <p>{error ?? 'Authorize the YouTube channel you want to manage from Replova.'}</p>
        <div>
          <Link href="/dashboard/settings#youtube" className="btn btn-primary">Open YouTube Settings</Link>
          <button type="button" className="btn btn-quiet" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  const title = mode === 'overview'
    ? 'Channel overview'
    : mode === 'videos' ? 'All videos'
      : mode === 'playlists' ? 'Playlists'
        : data.selectedPlaylist?.title ?? 'Playlist'
  const description = mode === 'overview'
    ? 'See channel content and move from videos to comments and AI replies.'
    : mode === 'videos' ? 'Uploaded videos stay visible even when they have no synced comments.'
      : mode === 'playlists' ? 'Browse playlists owned by this channel. External-channel videos are excluded.'
        : `${data.videos.length} owned video${data.videos.length === 1 ? '' : 's'} shown in YouTube playlist order.`

  return (
    <>
      <header className="page-header product-page-header youtube-studio-page-header">
        <div>
          <div className="t-eyebrow">YouTube / {mode === 'playlist' ? 'Playlists' : title}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => refresh()} disabled={syncing}>
          <span className={syncing ? 'spin' : undefined}><IconRefresh s={13} /></span>
          {syncing ? 'Refreshing…' : 'Refresh channel'}
        </button>
      </header>

      <div className="page-body youtube-studio-page">
        <section className="youtube-studio-channel" aria-label="Connected YouTube channel">
          <div className="youtube-studio-channel-identity">
            {data.channel.avatarUrl ? (
              // Channel avatar is rendered exactly as returned by YouTube.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.channel.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : <div className="youtube-studio-channel-initial">{data.channel.title.slice(0, 1).toUpperCase()}</div>}
            <div>
              <span>Connected channel</span>
              <strong>{data.channel.title}</strong>
              <a href={data.channel.channelUrl} target="_blank" rel="noreferrer">
                View on YouTube <IconExternal s={11} />
              </a>
            </div>
          </div>
          <div className="youtube-studio-channel-stats">
            <span><strong>{formatNumber(data.channel.subscriberCountHidden ? null : data.channel.subscriberCount)}</strong> subscribers</span>
            <span><strong>{formatNumber(data.channel.videoCount ?? data.allVideoCount)}</strong> videos</span>
            <span><strong>{formatNumber(data.channel.viewCount)}</strong> channel views</span>
          </div>
        </section>

        {error && <p className="simple-message is-error" role="alert">{error}</p>}
        {notice && <p className="simple-message is-success" role="status">{notice}</p>}
        {(data.channel.partial || data.queueTruncated) && (
          <p className="simple-message" role="status">Large channel detected. Replova indexed content within safe API and local search limits.</p>
        )}

        {mode === 'overview' && (
          <>
            <section className="youtube-studio-overview" aria-label="YouTube workflow summary">
              <div className="youtube-studio-overview-primary">
                <span>Reply workflow</span>
                <strong>{data.totals.needsReview}</strong>
                <p>AI drafts waiting for review across {data.allVideoCount} indexed videos.</p>
                <Link href="/dashboard/youtube/replies" className="btn btn-primary btn-sm">Review drafts</Link>
              </div>
              <div className="youtube-studio-overview-stats">
                <span><strong>{data.totals.syncedComments}</strong><small>Synced comments</small></span>
                <span><strong>{data.totals.approved}</strong><small>Approved</small></span>
                <span><strong>{data.totals.published}</strong><small>Published</small></span>
                <span data-tone={data.totals.failed > 0 ? 'negative' : undefined}><strong>{data.totals.failed}</strong><small>Failed</small></span>
              </div>
            </section>
            <section className="youtube-studio-section-heading">
              <div><span>Recent uploads</span><h2>Move from a video to its conversations</h2></div>
              <Link href="/dashboard/youtube/videos">View all videos</Link>
            </section>
            <VideoGrid videos={data.videos.slice(0, 6)} />
            <section className="youtube-studio-section-heading">
              <div><span>Content groups</span><h2>Playlists</h2></div>
              <Link href="/dashboard/youtube/playlists">View all playlists</Link>
            </section>
            <PlaylistGrid playlists={data.playlists.slice(0, 4)} allVideoCount={data.allVideoCount} />
          </>
        )}

        {(mode === 'videos' || mode === 'playlist') && (
          <>
            <label className="youtube-studio-search">
              <span className="sr-only">Search video titles and indexed comments</span>
              <IconSearch s={15} />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value.slice(0, 100))}
                placeholder="Search video titles and indexed comments"
              />
            </label>
            {loading ? <LoadingState /> : <VideoGrid videos={data.videos} />}
          </>
        )}

        {mode === 'playlists' && <PlaylistGrid playlists={data.playlists} allVideoCount={data.allVideoCount} />}
      </div>
    </>
  )
}
