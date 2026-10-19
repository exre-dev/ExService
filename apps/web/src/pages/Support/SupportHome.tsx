import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button, ExMessage, Tabs, TabsList, TabsTrigger, TabsContent } from '@exre/exui'
import { ArrowRight, ArrowUpRight, Copy, ChevronDown } from 'lucide-react'
import { supportImage, supportRegistry } from '../../content/support/registry'
import type { ClickUpConfig, ContactEntry, ErrorEntry } from '../../content/support/types'
import { useSupportFocus } from './useSupportFocus'
import styles from './Support.module.scss'
import { useFeedback } from './feedback/FeedbackProvider'

const feedback = [
  {
    title: '功能和需求',
    description: '报告问题，提出功能、资源、文档或活动需求。',
    icon: 'Discovery',
    area: 'development' as const,
  },
  {
    title: '投诉和建议',
    description: '反馈你遇到的不当行为或不满意的体验。',
    icon: 'Message',
    area: 'community' as const,
  },
]
export function FeedbackEntries() {
  const { openFeedback } = useFeedback()
  return (
    <section className={styles.section} aria-labelledby="feedback-title">
      <div className={styles.sectionHeading}>
        <h2 id="feedback-title">反馈与建议</h2>
      </div>
      <div className={styles.feedbackGrid}>
        {feedback.map((item) => (
          <article key={item.title} className={styles.feedbackCard}>
            <img
              className={styles.featureIcon}
              src={`/3d-icons/${item.icon}.png`}
              alt=""
              width={128}
              height={128}
              loading="lazy"
            />
            <h3 id={`feedback-${item.icon}-title`}>
              {item.title}
              <ArrowRight className={styles.feedbackArrow} aria-hidden="true" />
            </h3>
            <p id={`feedback-${item.icon}-description`}>{item.description}</p>
            <button
              type="button"
              className={styles.feedbackTrigger}
              aria-labelledby={`feedback-${item.icon}-title`}
              aria-describedby={`feedback-${item.icon}-description`}
              onClick={(event) => openFeedback(item.area, event.currentTarget)}
            />
          </article>
        ))}
      </div>
    </section>
  )
}
export function FeaturedErrors({
  errors,
  hasErrors,
}: {
  errors: ErrorEntry[]
  hasErrors: boolean
}) {
  return (
    <section aria-labelledby="solutions-title" className={styles.solutions}>
      <div className={styles.solutionsIntro}>
        <img
          className={styles.featureIcon}
          src="/3d-icons/Document.png"
          alt=""
          width={128}
          height={128}
          loading="lazy"
        />
        <h3 id="solutions-title">先试试这些办法。</h3>
        <p className={styles.description}>我们整理了常见问题与排查步骤，也许答案就在这里。</p>
      </div>
      <div className={styles.errorPanel}>
        {errors.length ? (
          errors.map((error) => (
            <details className={styles.disclosure} key={error.slug}>
              <summary>
                <span>{error.title}</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className={styles.quickAnswer}>
                <p>{error.quickAnswer}</p>
                <Link className={styles.textLink} to={error.url}>
                  查看完整说明
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </div>
            </details>
          ))
        ) : (
          <p className={styles.empty}>
            {hasErrors ? '精选案例整理中，可查看全部常见错误。' : '常见错误内容整理中'}
          </p>
        )}
        <Link className={styles.moreLink} to="/support/errors">
          查看更多常见错误
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
function ContactAvatar({ contact }: { contact: ContactEntry }) {
  const image = contact.avatar ? supportImage(contact.avatar) : undefined
  const [failedSrc, setFailedSrc] = useState<string>()
  return (
    <div className={styles.avatar}>
      {image?.src && image.src !== failedSrc ? (
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          onError={() => setFailedSrc(image.src)}
        />
      ) : (
        <span aria-hidden="true">{Array.from(contact.name)[0]}</span>
      )}
    </div>
  )
}
async function copyQQ(contact: ContactEntry) {
  try {
    await navigator.clipboard.writeText(contact.qq!)
    ExMessage.info('QQ 已复制')
  } catch {
    ExMessage.error('复制失败，请手动选择并复制 QQ 号码')
  }
}
export function ContactCards({ contacts }: { contacts: ContactEntry[] }) {
  return (
    <section
      id="contacts"
      tabIndex={-1}
      aria-labelledby="contacts-title"
      className={styles.contacts}
    >
      <div className={styles.contactsHeading}>
        <h3 id="contacts-title">还需要帮助？联系相关成员。</h3>
        <p>按职责选择联系人</p>
      </div>
      {contacts.length ? (
        <div className={styles.contactGrid}>
          {contacts.map((contact) => (
            <article key={contact.id} className={styles.contactCard}>
              <ContactAvatar contact={contact} />
              <h4>{contact.name}</h4>
              <p className={styles.role}>{contact.role}</p>
              {(contact.qq || contact.email) && (
                <div className={styles.contactLinks}>
                  {contact.qq && (
                    <div className={styles.qq}>
                      <span>
                        QQ <span className={styles.selectable}>{contact.qq}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`复制${contact.name}的 QQ`}
                        onClick={() => {
                          void copyQQ(contact)
                        }}
                      >
                        <Copy aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                  {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>联系人资料整理中</p>
      )}
    </section>
  )
}
export function ClickUpPanel({ config }: { config: ClickUpConfig | null }) {
  return (
    <section className={styles.section} aria-labelledby="development-title">
      <div className={styles.sectionHeading}>
        <h2 id="development-title">开发进度</h2>
      </div>
      {config ? (
        <Tabs defaultValue="game" activationMode="manual">
          <div className={styles.viewToolbar}>
            <div className={`ex-glass ${styles.viewTabsGlass}`}>
              <TabsList className={styles.viewTabs} aria-label="开发进度视图">
                <TabsTrigger value="game">游戏</TabsTrigger>
                <TabsTrigger value="community">社区</TabsTrigger>
                <TabsTrigger value="requestBucket">需求桶</TabsTrigger>
              </TabsList>
            </div>
          </div>
          {(['game', 'community', 'requestBucket'] as const).map((view) => (
            <TabsContent key={view} value={view} className={styles.viewPanel}>
              <div className={styles.embedShell}>
                <iframe
                  className={styles.embed}
                  src={config[view].embedUrl}
                  title={config[view].title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  height={view === 'requestBucket' ? 700 : undefined}
                />
              </div>
              <div className={styles.embedFallback}>
                <p>
                  尚未进入开发跟踪的已提交需求，可在「需求桶」Tab 中查看。
                  <br />
                  {config[view].publicUrl
                    ? '若面板无法显示，可在新标签页打开 ClickUp。'
                    : '若面板无法显示，请稍后重试。'}
                </p>
                {config[view].publicUrl && (
                  <a
                    className={styles.textLink}
                    href={config[view].publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    在 ClickUp 中打开
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className={styles.emptyPanel}>
          <p>开发面板暂未配置</p>
        </div>
      )}
    </section>
  )
}
export function SupportHome() {
  const root = useRef<HTMLElement>(null)
  useSupportFocus(root)
  const featured = supportRegistry.featured
    .map((slug) => supportRegistry.errors.find((error) => error.slug === slug)!)
    .filter(Boolean)
  const contacts = [...supportRegistry.contacts].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  )
  return (
    <main ref={root} className={styles.support}>
      <section className={styles.hero} aria-labelledby="support-title">
        <div>
          <p className={styles.eyebrow}>支持中心</p>
          <h1 id="support-title" tabIndex={-1}>
            遇到问题，
            <br />
            一起解决。
          </h1>
        </div>
        <p className={styles.heroDescription}>
          从常见问题中寻找答案，联系具体成员，或了解开发进度。我们在这里，与你一起找到下一步。
        </p>
      </section>
      <FeedbackEntries />
      <section className={styles.helpSection} aria-labelledby="help-title">
        <div className={styles.helpHeading}>
          <h2 id="help-title">找到答案，也找到我们。</h2>
        </div>
        <div className={styles.helpPanel}>
          <FeaturedErrors errors={featured} hasErrors={supportRegistry.errors.length > 0} />
          <ContactCards contacts={contacts} />
        </div>
      </section>
      <ClickUpPanel config={supportRegistry.clickup} />
    </main>
  )
}
