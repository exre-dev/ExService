import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { Button } from '@exre/exui'
import { ArrowLeft, ArrowRight, Image as ImageIcon } from 'lucide-react'
import { ContentImage } from '@workspace/components'
import { aboutImage } from '../../content/about/registry'
import type { ContentImageData, RelatedRefs } from '../../content/about/types'
import { AboutImageBackground } from './AboutImageBackground'
import styles from './StoryTimeline.module.scss'

interface ChapterProps {
  yearLabel: string
  photos?: ContentImageData[]
  placeholderPhotos?: number
  children?: ReactNode
}
interface MilestoneProps {
  id: string
  title: string
  dateLabel: string
  image?: ContentImageData
  related?: RelatedRefs
  children?: ReactNode
}
const chapterPositions = new Map<string, number>()

// These author components remain ordinary JSX; the Timeline reads chapter metadata.
export function StoryChapter({ children }: ChapterProps) {
  return <>{children}</>
}
export function StoryMilestone({ id, title, dateLabel, image, children }: MilestoneProps) {
  return (
    <article id={`milestone-${id}`} className={styles.event} tabIndex={-1}>
      <p className={styles.date}>{dateLabel}</p>
      <h2>{title}</h2>
      <div className={styles.eventBody}>{children}</div>
      {image && <ContentImage image={aboutImage(image)} />}
    </article>
  )
}

const photoLayouts = [
  [{ left: 42, top: 6, width: 231, height: 218, angle: -4 }],
  [
    { left: 8, top: 0, width: 184, height: 201, angle: -6 },
    { left: 125, top: 74, width: 192, height: 156, angle: 7 },
  ],
  [
    { left: 132, top: 0, width: 174, height: 207, angle: 5 },
    { left: 8, top: 86, width: 204, height: 145, angle: -5 },
  ],
  [{ left: 19, top: 22, width: 291, height: 192, angle: 3 }],
]
function StoryPhoto({ image, style }: { image?: ContentImageData; style: CSSProperties }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={styles.photo} style={style}>
      {image && !failed ? (
        <img
          src={aboutImage(image).src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={styles.photoPlaceholder}
          role="img"
          aria-label={image ? `${image.alt}（图片暂不可用）` : '照片素材待补充'}
        >
          <ImageIcon aria-hidden="true" />
          <span>IMAGE PLACEHOLDER</span>
        </div>
      )}
    </div>
  )
}
function PhotoAlbum({ chapter, index }: { chapter: ChapterProps; index: number }) {
  const count = chapter.photos?.length ?? chapter.placeholderPhotos ?? 0
  const candidates = photoLayouts.filter((layout) => layout.length === count)
  const layout = candidates[index % candidates.length]
  return (
    <div className={styles.album} role="group" aria-label={`${chapter.yearLabel} 年照片`}>
      {layout ? (
        layout.map((photo, position) => (
          <StoryPhoto
            key={chapter.photos?.[position]?.src ?? position}
            image={chapter.photos?.[position]}
            style={{
              left: `${(photo.left / 330) * 100}%`,
              top: `${(photo.top / 248) * 100}%`,
              width: `${(photo.width / 330) * 100}%`,
              height: `${(photo.height / 248) * 100}%`,
              transform: `rotate(${photo.angle}deg)`,
            }}
          />
        ))
      ) : (
        <p className={styles.noPhotos}>照片仍在整理中。</p>
      )}
    </div>
  )
}

export function StoryTimeline({
  headline = 'Exre 历程',
  eyebrow = 'OUR JOURNEY',
  note,
  children,
}: {
  headline?: string
  eyebrow?: string
  note?: string
  children?: ReactNode
}) {
  const chapters = useMemo(() => {
    const items = Children.toArray(children)
    const grouped = items.filter(
      (child): child is ReactElement<ChapterProps> =>
        isValidElement<ChapterProps>(child) && typeof child.props.yearLabel === 'string',
    )
    if (grouped.length) return grouped
    // Older author content used Timeline > Milestone without chapter grouping.
    return items
      .filter(
        (child): child is ReactElement<MilestoneProps> =>
          isValidElement<MilestoneProps>(child) &&
          typeof child.props.id === 'string' &&
          typeof child.props.dateLabel === 'string',
      )
      .map((event) => (
        <StoryChapter
          key={event.key}
          yearLabel={event.props.dateLabel}
          photos={event.props.image ? [event.props.image] : undefined}
        >
          {event}
        </StoryChapter>
      ))
  }, [children])
  const chapterSignature = JSON.stringify(
    chapters.map((chapter) => [
      chapter.props.yearLabel,
      ...Children.toArray(chapter.props.children).map((event) =>
        isValidElement<{ id?: string }>(event) ? event.props.id : null,
      ),
    ]),
  )
  const [active, setActive] = useState(0)
  const viewport = useRef<HTMLDivElement>(null)
  const chapterNodes = useRef<(HTMLElement | null)[]>([])
  const pending = useRef<number | null>(null)
  const selected = useRef(0)
  const { hash, key } = useLocation()
  const navigation = useNavigationType()
  const clamped = Math.min(active, Math.max(0, chapters.length - 1))
  const offset = useCallback(
    (index: number) =>
      (chapterNodes.current[index]?.offsetLeft ?? 0) - (chapterNodes.current[0]?.offsetLeft ?? 0),
    [],
  )
  const select = useCallback(
    (index: number, instant = false) => {
      const next = Math.max(0, Math.min(chapters.length - 1, index))
      selected.current = next
      chapterPositions.set(key, next)
      if (chapterPositions.size > 100)
        chapterPositions.delete(chapterPositions.keys().next().value!)
      pending.current = next
      setActive(next)
      const target = viewport.current
      if (!target) return
      const left = offset(next)
      if (Math.abs(target.scrollLeft - left) < 2) {
        pending.current = null
        return
      }
      const behavior =
        instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth'
      target.scrollTo?.({ left, behavior })
    },
    [chapters.length, key, offset],
  )
  const syncScroll = useCallback(() => {
    const target = viewport.current
    if (!target || !chapters.length) return
    if (pending.current !== null) {
      if (Math.abs(target.scrollLeft - offset(pending.current)) > 2) return
      pending.current = null
    }
    let nearest = 0
    for (let index = 1; index < chapters.length; index++)
      if (
        Math.abs(target.scrollLeft - offset(index)) < Math.abs(target.scrollLeft - offset(nearest))
      )
        nearest = index
    selected.current = nearest
    chapterPositions.set(key, nearest)
    setActive(nearest)
  }, [chapters.length, key, offset])
  useLayoutEffect(() => {
    let anchor: string
    try {
      anchor = decodeURIComponent(hash.slice(1))
    } catch {
      return
    }
    const index = chapterNodes.current.findIndex(
      (node) =>
        node && Array.from(node.querySelectorAll('[id]')).some((element) => element.id === anchor),
    )
    if (index >= 0) select(index, true)
    else select(navigation === 'POP' ? (chapterPositions.get(key) ?? 0) : 0, true)
  }, [hash, key, navigation, chapterSignature, select])
  useLayoutEffect(() => {
    const target = viewport.current
    if (!target) return
    const finish = () => {
      pending.current = null
      syncScroll()
    }
    target.addEventListener('scrollend', finish)
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => select(selected.current, true))
    resize?.observe(target)
    return () => {
      target.removeEventListener('scrollend', finish)
      resize?.disconnect()
    }
  }, [select, syncScroll])

  return (
    <section className={styles.timeline} aria-label="Exre 历程">
      <AboutImageBackground />
      <header className={styles.heading}>
        <div>
          <p className={`${styles.eyebrow} ex-glass`}>{eyebrow}</p>
          <h1 tabIndex={-1}>{headline.replace(/\\n/g, '\n')}</h1>
        </div>
        <div className={`${styles.controls} ex-glass`}>
          <Button
            variant="ghost"
            aria-label="上一阶段"
            disabled={!chapters.length || clamped === 0}
            onClick={() => select(selected.current - 1)}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            aria-label="下一阶段"
            disabled={!chapters.length || clamped === chapters.length - 1}
            onClick={() => select(selected.current + 1)}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </header>
      {!chapters.length ? (
        <p className={styles.empty}>历程仍在整理中。</p>
      ) : (
        <>
          <div
            ref={viewport}
            className={styles.viewport}
            role="region"
            aria-label="历程展示"
            tabIndex={0}
            onScroll={syncScroll}
            onPointerDown={() => {
              pending.current = null
            }}
            onWheel={() => {
              pending.current = null
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                select(
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? chapters.length - 1
                      : selected.current + (event.key === 'ArrowRight' ? 1 : -1),
                  true,
                )
              }
            }}
          >
            <div className={styles.track}>
              {chapters.map((chapter, index) => (
                <section
                  key={chapter.key ?? index}
                  ref={(node) => {
                    chapterNodes.current[index] = node
                  }}
                  className={styles.chapter}
                  aria-label={`${chapter.props.yearLabel} 年历程`}
                >
                  <PhotoAlbum chapter={chapter.props} index={index} />
                  <div className={styles.events}>
                    <p className={styles.yearMarker}>{chapter.props.yearLabel}</p>
                    {chapter.props.children}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <nav className={styles.years} aria-label="历程年份">
            <span
              className={styles.progress}
              aria-hidden="true"
              style={{
                width: `${chapters.length > 1 ? (clamped / (chapters.length - 1)) * 100 : 0}%`,
              }}
            />
            {chapters.map((chapter, index) => (
              <Button
                variant="ghost"
                key={chapter.key ?? index}
                aria-current={index === clamped ? 'step' : undefined}
                onClick={() => select(index)}
              >
                {chapter.props.yearLabel}
              </Button>
            ))}
          </nav>
        </>
      )}
      {note && (
        <footer className={styles.footer}>
          <p>{note}</p>
        </footer>
      )}
    </section>
  )
}
