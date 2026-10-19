import { Dialog, useIsMobile } from '@exre/exui'
import type { MDXComponents } from 'mdx/types'
import { useContent } from '../../content/useContent'
import { aboutStore, aboutRegistry } from '../../content/about/registry'
import { AboutBody } from './AboutBody'
import styles from './MemberModal.module.scss'

export function MemberModal({
  slug,
  trigger,
  components,
  onClose,
}: {
  slug: string
  trigger: HTMLElement
  components: MDXComponents
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const member = aboutRegistry.members.find((item) => item.slug === slug)!
  const state = useContent(aboutStore, member.id)
  const returnFocus = () => {
    if (trigger.isConnected && trigger.getClientRects().length) {
      trigger.focus({ preventScroll: true })
      if (document.activeElement === trigger) return
    }
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
  }
  return (
    <Dialog
      open
      title={member.title}
      description={member.role}
      responsiveFullscreen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      contentProps={{
        className: styles.content,
        style: isMobile ? { width: '100vw', maxWidth: '100vw' } : undefined,
        closeLabel: '关闭成员简介',
        onCloseAutoFocus: (event) => {
          event.preventDefault()
          returnFocus()
        },
      }}
    >
      <p>{member.summary}</p>
      <AboutBody state={state} retry={state.retry} components={components} />
      {member.links.map((link) => (
        <p key={link.url}>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </p>
      ))}
    </Dialog>
  )
}
