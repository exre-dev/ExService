import { useState, type ReactNode } from 'react'
import { Image } from 'lucide-react'
import styles from './Content.module.scss'

export interface ContentImageProps {
  image: {
    src: string
    alt: string
    width: number
    height: number
    caption?: string
    position?: { x: number; y: number }
  }
  eager?: boolean
}
export function ContentImage({ image, eager = false }: ContentImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>()
  return (
    <figure className={styles.image}>
      {failedSrc === image.src ? (
        <div
          className={styles.imageFallback}
          role="img"
          aria-label={image.alt}
          style={{ aspectRatio: `${image.width}/${image.height}` }}
        >
          <Image aria-hidden="true" />
          <span>图片暂不可用</span>
        </div>
      ) : (
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailedSrc(image.src)}
          style={{ objectPosition: `${image.position?.x ?? 50}% ${image.position?.y ?? 50}%` }}
        />
      )}
      {image.caption && <figcaption>{image.caption}</figcaption>}
    </figure>
  )
}
export function Callout({
  title,
  kind,
  children,
}: {
  title: string
  kind: 'info' | 'note'
  children?: ReactNode
}) {
  return (
    <aside className={styles.callout} data-kind={kind}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  )
}
export function ContentProse({ children }: { children?: ReactNode }) {
  return <div className={styles.prose}>{children}</div>
}
