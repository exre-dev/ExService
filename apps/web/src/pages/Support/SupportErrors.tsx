import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@exre/exui'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { ContentImage, ContentProse } from '@workspace/components'
import { createMdxComponents } from '../../content/mdx'
import { supportImage, supportRegistry, supportStore } from '../../content/support/registry'
import type { ContentImageData, ErrorEntry } from '../../content/support/types'
import { useContent } from '../../content/useContent'
import { useSupportFocus } from './useSupportFocus'
import styles from './Support.module.scss'

const mdxComponents = createMdxComponents({
  a: ({ href, children, ...props }: ComponentProps<'a'>) =>
    href?.startsWith('/') || href?.startsWith('#') ? (
      <Link {...props} to={href}>
        {children}
      </Link>
    ) : (
      <a {...props} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  ContentImage: ({ image }: { image: ContentImageData }) => (
    <ContentImage image={supportImage(image)} />
  ),
})
function categoryLabel(error: ErrorEntry) {
  return supportRegistry.categories.find((category) => category.id === error.category)!.label
}
export function ErrorList() {
  const root = useRef<HTMLElement>(null)
  useSupportFocus(root)
  const errors = [...supportRegistry.errors].sort(
    (a, b) => a.order - b.order || a.slug.localeCompare(b.slug),
  )
  return (
    <main ref={root} className={styles.support}>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link to="/support">支持中心</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">常见错误</span>
      </nav>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>找到解决办法</p>
        <h1 tabIndex={-1}>常见错误</h1>
        <p className={styles.description}>按问题表现查找说明，逐步排查。</p>
        <p className={styles.count}>共 {errors.length} 条</p>
      </header>
      {errors.length ? (
        <div className={styles.errorList}>
          {errors.map((error) => (
            <Link to={error.url} key={error.slug} className={styles.errorEntry}>
              <div>
                <h2>{error.title}</h2>
                <p>{error.description}</p>
              </div>
              <span className={styles.category}>{categoryLabel(error)}</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyPanel}>
          <p>常见错误内容整理中</p>
        </div>
      )}
      <Link className={styles.backLink} to="/support">
        <ArrowLeft aria-hidden="true" />
        返回支持首页
      </Link>
    </main>
  )
}
export function ErrorDetail() {
  const { slug } = useParams()
  const error = supportRegistry.errors.find((entry) => entry.slug === slug)
  return error ? <ErrorArticle key={error.id} error={error} /> : <SupportNotFound />
}
interface Heading {
  id: string
  title: string
  level: number
}
function ErrorArticle({ error }: { error: ErrorEntry }) {
  const state = useContent(supportStore, error.id)
  const root = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  useSupportFocus(root, state.status === 'ready')
  useEffect(() => {
    if (state.status !== 'ready' || !body.current) {
      setHeadings([])
      return
    }
    setHeadings(
      Array.from(body.current.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'))
        .filter((heading) => heading.id && heading.textContent?.trim())
        .map((heading) => ({
          id: heading.id,
          title: heading.textContent!.trim(),
          level: Number(heading.tagName.slice(1)),
        })),
    )
  }, [state.status, error.id])
  return (
    <main ref={root} className={styles.support}>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link to="/support">支持中心</Link>
        <span aria-hidden="true">/</span>
        <Link to="/support/errors">常见错误</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{error.title}</span>
      </nav>
      <header className={styles.pageHeader}>
        <span className={styles.category}>{categoryLabel(error)}</span>
        <h1 tabIndex={-1}>{error.title}</h1>
        <p className={styles.description}>{error.description}</p>
      </header>
      <div className={styles.readingGrid}>
        <div ref={body} className={styles.readingBody}>
          {state.status === 'loading' ? (
            <p role="status" className={styles.loading}>
              正在加载内容…
            </p>
          ) : state.status === 'error' ? (
            <div role="alert" className={styles.loading}>
              <p>内容暂时无法加载</p>
              <div className={styles.recovery}>
                <Button variant="outline" onClick={state.retry}>
                  重试
                </Button>
                <Button variant="ghost" onClick={() => window.location.reload()}>
                  重新加载当前页面
                </Button>
              </div>
            </div>
          ) : (
            <ContentProse>
              <state.module.default components={mdxComponents} />
            </ContentProse>
          )}
        </div>
        {headings.length > 0 && (
          <nav className={styles.toc} aria-label="正文目录">
            <p className={styles.eyebrow}>本页目录</p>
            {headings.map((heading) => (
              <Link
                className={heading.level === 3 ? styles.tocSubheading : undefined}
                key={heading.id}
                to={`#${encodeURIComponent(heading.id)}`}
              >
                {heading.title}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className={styles.articleFooter}>
        <Link className={styles.textLink} to="/support#contacts">
          返回支持页联系成员
          <ArrowUpRight aria-hidden="true" />
        </Link>
        <Link className={styles.backLink} to="/support/errors">
          <ArrowLeft aria-hidden="true" />
          返回常见错误列表
        </Link>
      </div>
    </main>
  )
}
export function SupportNotFound() {
  const root = useRef<HTMLElement>(null)
  useSupportFocus(root)
  return (
    <main ref={root} className={styles.support}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>支持中心</p>
        <h1 tabIndex={-1}>找不到这个页面</h1>
        <p className={styles.description}>该页面不存在，或内容尚未发布。</p>
      </header>
      <div className={styles.recovery}>
        <Link className={styles.textLink} to="/support/errors">
          返回常见错误列表
        </Link>
        <Link className={styles.textLink} to="/support">
          返回支持首页
        </Link>
      </div>
    </main>
  )
}
