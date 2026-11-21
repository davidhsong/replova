'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './TapFilm.module.css'

const filmUrl = '/tap-showcase/replova-illustrated-tap.mp4'

export function TapFilm() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const manualOnly = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  function play(video: HTMLVideoElement) {
    // Attach the file at playback time so the poster alone can serve reduced-motion visitors.
    if (!video.hasAttribute('src')) video.src = filmUrl
    video.muted = true
    void video.play().catch((error: DOMException) => {
      if (error.name !== 'AbortError') {
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

  function handlePlayback(restart: boolean) {
    const video = videoRef.current
    if (!video) return
    if (!restart && !video.error && !video.paused && !video.ended) {
      manualOnly.current = true
      video.pause()
      return
    }
    manualOnly.current = false
    if (restart || video.ended) video.currentTime = 0
    if (video.error) {
      video.load()
      setUnavailable(false)
    }
    play(video)
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
        aria-label="From a counter tap to a clearer pickup shelf"
        aria-describedby="tap-film-description"
        onPlay={() => { setPlaying(true); setEnded(false) }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setEnded(true) }}
        onError={() => { setUnavailable(true); setPlaying(false) }}
      />
      <figcaption className={styles.footer}>
        <span className={styles.caption}>Replova Tap <span aria-hidden="true">·</span> 30 seconds</span>
        <span id="tap-film-description" className="sr-only">A customer taps the counter placard, rates the visit, and asks which shelf is for pickup. A receipt confirms the submission. The manager reads the comment in the inbox and labels the pickup shelf.</span>
        <div className={styles.controls}>
          <button type="button" aria-controls="tap-film" onClick={() => handlePlayback(ended)}>{ended ? 'Replay' : playing ? 'Pause' : 'Play'}</button>
          {!ended && <button type="button" aria-controls="tap-film" onClick={() => handlePlayback(true)}>Replay</button>}
        </div>
      </figcaption>
      {unavailable && <p role="status">The film couldn’t load. Select Play to try again.</p>}
      <noscript><a href={filmUrl}>Watch the 30-second Tap demo</a></noscript>
    </figure>
  )
}

