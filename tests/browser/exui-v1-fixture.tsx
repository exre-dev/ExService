// Isolated browser hosts for real shared components. No backend or persistent account.
import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { ExMessageContext, GlassSeed, ThemeProvider, useTheme } from '@exre/exui'
import {
  SettingsPanel,
  type SettingsCategory,
  type SettingsTheme,
} from '@components/src/SettingsPanel'
import { TiptapEditor } from '@components/src/tiptap/TiptapEditor'
import type { TiptapEditorHandle } from '@components/src/tiptap/types'
import { FeedbackProvider, useFeedback } from '@web/src/pages/Support/feedback/FeedbackProvider'
import { MemberModal } from '@web/src/pages/AboutUs/MemberModal'
import { aboutRegistry } from '@web/src/content/about/registry'
import { SiteHeader } from '@components/src/SiteHeader'
import { AuthProvider } from '@web/src/auth/AuthContext'
import { writeToken } from '@web/src/auth/storage'
import { SettingsModal } from '@web/src/settings/SettingsExperience'
import '@exre/exui/style.css'
import '@web/src/styles/website-theme.css'
import '@web/src/styles/index.scss'

document.documentElement.classList.add('website-theme-profile')

function SettingsFixture() {
  const { theme, setTheme } = useTheme()
  const [category, setCategory] = useState<SettingsCategory>('general')
  const panel = (
    <SettingsPanel
      category={category}
      onCategoryChange={setCategory}
      theme={theme as SettingsTheme}
      onThemeChange={setTheme}
      profile={{
        email: 'browser@example.test',
        nickname: '浏览器用户',
        qq: null,
        fivemId: null,
        avatarUrl: null,
      }}
      profileStatus="ready"
      profileError={null}
      onRetry={() => undefined}
      notifications={{
        identityEpoch: 1,
        preferences: { announcement: true, personal_update: true },
        status: 'ready',
        saving: false,
        conflict: false,
        failure: null,
        onRetryRead: () => undefined,
        onSaveField: async (_field, values) => values,
      }}
      onSave={async () => undefined}
      onUpload={async () => undefined}
      onRemoveAvatar={async () => undefined}
      onLogout={() => undefined}
      logoutPending={false}
      actionPending={false}
    />
  )
  return <main style={{ maxWidth: '70rem', margin: 'auto' }}>{panel}</main>
}

function SettingsModalFixture() {
  const [open, setOpen] = useState(true)
  return (
    <main style={{ padding: '2rem' }}>
      <button type="button" onClick={() => setOpen(true)}>
        打开设置验收弹窗
      </button>
      {open && <SettingsModal initialCategory="general" onClose={() => setOpen(false)} />}
    </main>
  )
}

function EmojiFixture() {
  const editor = useRef<TiptapEditorHandle>(null)
  const [editable, setEditable] = useState(true)
  return (
    <main style={{ maxWidth: '45rem', margin: '2rem auto', padding: '1rem' }}>
      <button type="button" style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 100 }}>
        外部焦点
      </button>
      <TiptapEditor
        ref={editor}
        ariaLabel="浏览器 Emoji 编辑器"
        editable={editable}
        initialContent={{ format: 'markdown', content: '前 后' }}
      />
      <button
        type="button"
        style={{ position: 'fixed', bottom: 0, left: 0, zIndex: 100 }}
        onClick={() => editor.current?.replaceContent({ format: 'markdown', content: '替换内容' })}
      >
        替换文档
      </button>
      <button
        type="button"
        style={{ position: 'fixed', bottom: '2rem', left: 0, zIndex: 100 }}
        onClick={() => setEditable((value) => !value)}
      >
        切换只读
      </button>
      <button
        type="button"
        onClick={() => {
          const result = editor.current?.exportMarkdown()
          document.querySelector('[data-markdown-result]')!.textContent = result?.ok
            ? result.value
            : 'ERROR'
        }}
      >
        导出 Markdown
      </button>
      <output data-markdown-result />
    </main>
  )
}

function FeedbackEntry() {
  const { openFeedback } = useFeedback()
  return (
    <main style={{ padding: '2rem' }}>
      <button type="button" onClick={(event) => openFeedback('community', event.currentTarget)}>
        打开投诉和建议
      </button>
    </main>
  )
}

function MemberFixture() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <main>
      <h1 tabIndex={-1}>成员简介验收</h1>
      <button ref={trigger} onClick={() => setOpen(true)}>
        打开成员简介
      </button>
      {open && trigger.current && (
        <MemberModal
          slug={aboutRegistry.members[0]!.slug}
          trigger={trigger.current}
          components={{}}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  )
}

function HeaderFixture() {
  const params = new URLSearchParams(location.search)
  const authenticated = params.get('auth') === 'yes'
  const notifications = params.get('notifications') === 'yes'
  const noop = () => undefined
  return (
    <BrowserRouter>
      <SiteHeader
        auth={{
          state: authenticated
            ? { status: 'authenticated', nickname: '浏览器成员', initial: '浏', avatarUrl: null }
            : { status: 'anonymous' },
          onLogin: noop,
          onRegister: noop,
          onRetry: noop,
          onLogout: noop,
          onProfile: noop,
          onSettings: noop,
        }}
        notifications={
          notifications ? (
            <button type="button" aria-label="通知验收">
              通知
            </button>
          ) : undefined
        }
      />
      <main>
        <h1>顶栏验收</h1>
      </main>
    </BrowserRouter>
  )
}

const mode = new URLSearchParams(location.search).get('mode')
if (mode === 'settings-modal') writeToken(window.localStorage, 'isolated-settings-browser-token')
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <GlassSeed />
      <ExMessageContext />
      {mode === 'settings-modal' ? (
        <AuthProvider>
          <SettingsModalFixture />
        </AuthProvider>
      ) : mode === 'emoji' ? (
        <EmojiFixture />
      ) : mode === 'feedback' ? (
        <BrowserRouter>
          <FeedbackProvider>
            <FeedbackEntry />
          </FeedbackProvider>
        </BrowserRouter>
      ) : mode === 'member' ? (
        <MemberFixture />
      ) : mode === 'header' ? (
        <HeaderFixture />
      ) : (
        <SettingsFixture />
      )}
    </ThemeProvider>
  </StrictMode>,
)
