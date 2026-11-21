'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './TapFilm.module.css'

const filmUrl = '/tap-showcase/replova-tap-shop-film.mp4'

const chapters = [
  { label: 'Leave feedback', start: 0 },
  { label: 'Read feedback', start: 10.7 },
  { label: 'Improve pickup', start: 20.5 },
] as const

export function TapFilm() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const manualOnly = useRef(false)
  const pendingStart = useRef<number | null>(null)
  const playRequest = useRef(0)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  function readPosition(video: HTMLVideoElement) {
    const index = chapters.findLastIndex(chapter => video.currentTime >= chapter.start)
    setChapterIndex(Math.max(0, index))
    setEnded(video.ended)
  }

  function play(video: HTMLVideoElement, start?: number) {
    const request = ++playRequest.current
    // Attach the file at playback time so the poster alone can serve reduced-motion visitors.
    if (!video.hasAttribute('src')) video.src = filmUrl
    if (video.error) {
      video.load()
      setUnavailable(false)
    }
    if (start !== undefined) {
      // Before metadata, currentTime sets the native default playback start position.
      // Retain just the latest target for engines that defer that initial seek.
      pendingStart.current = video.readyState === 0 ? start : null
      video.currentTime = start
    }
    video.muted = true
    void video.play().catch((error: DOMException) => {
      if (request === playRequest.current && error.name !== 'AbortError') {
        manualOnly.current = true
        setPlaying(false)
      }
    })
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visibleFraction = 0

    function syncVisibility() {
      if (!video) return
      if (document.hidden || visibleFraction === 0) video.pause()
      else if (visibleFraction >= 0.5 && !motion.matches && !manualOnly.current && !video.ended && video.paused) play(video)
    }

    function motionChanged() {
      if (motion.matches) video?.pause()
      else syncVisibility()
    }

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visibleFraction = entry.intersectionRatio
      syncVisibility()
    }, { threshold: [0, 0.5] })
    observer?.observe(video)
    document.addEventListener('visibilitychange', syncVisibility)
    motion.addEventListener('change', motionChanged)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', syncVisibility)
      motion.removeEventListener('change', motionChanged)
      video.pause()
    }
  }, [])

  function startAt(seconds: number) {
    const video = videoRef.current
    if (!video) return
    manualOnly.current = false
    play(video, seconds)
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    if (!video.error && !video.paused && !video.ended) {
      manualOnly.current = true
      video.pause()
    } else {
      manualOnly.current = false
      play(video, video.ended ? 0 : undefined)
    }
  }

  return (
    <figure className={styles.frame} aria-label="Replova Tap demo">
      <video
        ref={videoRef}
        id="tap-film"
        width={720}
        height={792}
        poster="/tap-showcase/tap-film-poster.webp"
        preload="none"
        muted
        playsInline
        aria-label="A tea shop uses private feedback to improve pickup"
        aria-describedby="tap-film-description"
        onLoadedMetadata={({ currentTarget }) => {
          const start = pendingStart.current
          pendingStart.current = null
          if (start !== null && Math.abs(currentTarget.currentTime - start) > 1 / 30) currentTarget.currentTime = start
          readPosition(currentTarget)
        }}
        onTimeUpdate={({ currentTarget }) => readPosition(currentTarget)}
        onSeeking={({ currentTarget }) => readPosition(currentTarget)}
        onSeeked={({ currentTarget }) => readPosition(currentTarget)}
        onPlay={() => { setPlaying(true); setEnded(false) }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setEnded(true) }}
        onError={() => { setUnavailable(true); setPlaying(false) }}
      />
      <figcaption className={styles.footer}>
        <div className={styles.chapters} role="group" aria-label="Film chapters">
          {chapters.map((chapter, index) => (
            <button key={chapter.label} type="button" aria-controls="tap-film"
              aria-label={`Play chapter ${index + 1}: ${chapter.label}`}
              aria-current={index === chapterIndex ? 'step' : undefined}
              onClick={() => startAt(chapter.start)}
            >
              <span className={styles.circle} aria-hidden="true">
                {(index < chapterIndex || ended) && <svg viewBox="0 0 16 16" width="12" height="12" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              {chapter.label}
            </button>
          ))}
        </div>
        <span className={styles.caption}>Tea shop example <span aria-hidden="true">·</span> 34 sec</span>
        <span id="tap-film-description" className="sr-only">A customer taps the counter placard, rates the visit, and asks which shelf is for pickup. A receipt confirms the submission. The manager reads the comment, types at the workstation, and sets a sign on the pickup shelf. The next customer takes the amber drink and turns toward the exit with it.</span>
        <div className={styles.controls}>
          <button type="button" aria-controls="tap-film" onClick={togglePlayback}>{ended ? 'Replay' : playing ? 'Pause' : 'Play'}</button>
          {!ended && <button type="button" aria-controls="tap-film" onClick={() => startAt(0)}>Replay</button>}
        </div>
      </figcaption>
      {unavailable && <p role="status">The film couldn’t load. Select Play to try again.</p>}
      <noscript><a href={filmUrl}>Watch the 34-second Tap demo</a></noscript>
    </figure>
  )
}

