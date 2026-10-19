import type { MouseEvent, ReactNode } from 'react'
import { Button } from '@exre/exui'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { ContentImage } from '@workspace/components'
import { aboutImage } from '../../content/about/registry'
import type { AboutPage } from '../../content/about/types'
import { AboutImageBackground } from './AboutImageBackground'
import styles from './Donations.module.scss'

export function Donations({
  page,
  children,
}: {
  page: Extract<AboutPage, { kind: 'donations' }>
  children?: ReactNode
}) {
  function explore(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    const instant =
      event.detail === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({
      block: 'start',
      behavior: instant ? 'instant' : 'smooth',
    })
    target.focus({ preventScroll: true })
  }
  return (
    <div className={styles.donations}>
      <header className={styles.hero}>
        <AboutImageBackground />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{page.eyebrow ?? 'SUPPORT EXRE'}</p>
          <h1 tabIndex={-1}>
            让热爱，
            <br />
            继续发生。
          </h1>
          <div className={styles.intro}>{children ?? <p>{page.description}</p>}</div>
          <div className={styles.actions}>
            <Button asChild variant="secondary" className={styles.primaryEntry}>
              <a href="#donation-channels" onClick={(event) => explore(event, 'donation-channels')}>
                了解捐赠方式
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
            <a
              className={styles.donorEntry}
              href="#donation-donors"
              onClick={(event) => explore(event, 'donation-donors')}
            >
              认识支持我们的人
              <ArrowDown aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>
      <section className={styles.section} aria-labelledby="donation-channels">
        <div className={styles.heading}>
          <h2 id="donation-channels" tabIndex={-1}>
            支持 Exre
          </h2>
        </div>
        <p className={styles.sectionCopy}>在这里了解捐赠方式。</p>
        {!page.channels.length ? (
          <div className={styles.empty}>
            <img
              className={styles.emptyIcon}
              src="/3d-icons/Wallet.png"
              alt=""
              width={64}
              height={64}
            />
            <div>
              <h3>渠道信息正在整理</h3>
              <p>核对完成后，我们会在这里公布捐赠方式。感谢你的关注与支持。</p>
            </div>
          </div>
        ) : (
          <div className={styles.channels}>
            {page.channels.map((channel) => (
              <article key={channel.id} className={styles.channel} aria-label={channel.name}>
                <div className={styles.channelCopy}>
                  <h3>{channel.name}</h3>
                  {channel.description && (
                    <p className={styles.description}>{channel.description}</p>
                  )}
                  {channel.url && (
                    <a
                      className={styles.entry}
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      前往{channel.name}
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  )}
                </div>
                {channel.qrCode && (
                  <div className={styles.qr}>
                    <ContentImage image={aboutImage(channel.qrCode)} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className={styles.section} aria-labelledby="donation-donors">
        <div className={styles.heading}>
          <h2 id="donation-donors" tabIndex={-1}>
            感谢每一份支持
          </h2>
        </div>
        <p className={styles.sectionCopy}>这里记录捐赠者的公开昵称与日期。</p>
        {!page.donors.length ? (
          <div className={styles.empty}>
            <img
              className={styles.emptyIcon}
              src="/3d-icons/Heart.png"
              alt=""
              width={64}
              height={64}
            />
            <div>
              <h3>每一份心意，我们都记得。</h3>
              <p>公开名单将在核对后补充。谢谢你与 Exre 同行。</p>
            </div>
          </div>
        ) : (
          <ul className={styles.donors}>
            {page.donors.map((donor) => (
              <li key={donor.id}>
                <span className={styles.avatar} aria-hidden="true">
                  {Array.from(donor.nickname)[0]}
                </span>
                <div className={styles.donorCopy}>
                  <span className={styles.nickname}>{donor.nickname}</span>
                  <time dateTime={donor.date}>{donor.date}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.footnote}>
          页面仅展示经核对的渠道与公开记录。请以正式公布的信息为准。
        </p>
      </section>
    </div>
  )
}
