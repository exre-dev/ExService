import { Modal } from '@exre/exui'
import type { MDXComponents } from 'mdx/types'
import { useContent } from '../../content/useContent'
import { aboutStore, aboutRegistry } from '../../content/about/registry'
import { AboutBody } from './AboutBody'

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
  const member = aboutRegistry.members.find((item) => item.slug === slug)!
  const state = useContent(aboutStore, member.id)
  return (
    <Modal
      open
      title={member.title}
      description={member.role}
      size="md"
      closeLabel="关闭成员简介"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        if (trigger.isConnected && trigger.getClientRects().length) trigger.focus()
        else document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
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
    </Modal>
  )
}
