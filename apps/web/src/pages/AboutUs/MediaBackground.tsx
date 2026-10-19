import { useEffect, useRef, useState } from 'react'
import styles from './MediaPage.module.scss'

export function MediaBackground({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  const [hasSource, setHasSource] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const wanted = !reduced
  const source = !failed && (wanted || hasSource) ? src : undefined

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(query.matches)
    const visibility = () => setVisible(document.visibilityState === 'visible')
    query.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      query.removeEventListener('change', motion)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current!
    // Strict Mode replays cleanup while retaining this DOM node.
    if (source) video.setAttribute('src', source)
    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current!
    if (!wanted || !visible || failed) {
      video.pause()
      return
    }
    setHasSource(true)
    let cancelled = false
    // Autoplay rejection is a recoverable browser policy decision.
    void video.play().catch(() => {
      if (!cancelled) setBlocked(true)
    })
    return () => {
      cancelled = true
    }
  }, [wanted, visible, failed, source])

  return (
    <div className={styles.background} aria-hidden="true">
      <video
        key={src}
        ref={videoRef}
        src={source}
        autoPlay={wanted && visible && !failed && !blocked}
        muted
        loop
        playsInline
        preload="metadata"
        data-static={failed || reduced ? '' : undefined}
        onPlay={() => {
          if (!wanted || !visible || failed) {
            videoRef.current?.pause()
            return
          }
          setBlocked(false)
        }}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
