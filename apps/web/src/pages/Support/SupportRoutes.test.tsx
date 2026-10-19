// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { ExMessageContext, ThemeProvider } from '@exre/exui'
import userEvent from '@testing-library/user-event'
import type { ContentLoader, ContentModule } from '../../content/store'
import type { SupportRegistry } from '../../content/support/types'
import { SupportRoutes } from './SupportRoutes'
import { FeedbackProvider } from './feedback/FeedbackProvider'

const fixture = vi.hoisted(() => ({
  registry: {
    errors: [],
    featured: [],
    contacts: [],
    categories: [],
    clickup: null,
  } as SupportRegistry,
  loaders: {} as Record<string, ContentLoader>,
}))
vi.mock('./feedback/api', () => ({
  getFeedbackOptions: async () => ({
    available: false,
    reason: 'not_configured',
    fields: [],
    kinds: [],
    actions: [],
    limits: {
      titleCodePoints: 200,
      userContentBytes: 65536,
      fileBytes: 20971520,
      files: 5,
      totalFileBytes: 104857600,
      largeFileInfoBytes: 16384,
    },
  }),
  feedbackPort: {},
}))
vi.mock('../../content/support/registry', async () => {
  const { createContentStore } = await import('../../content/store')
  return {
    supportRegistry: fixture.registry,
    supportStore: createContentStore(
      new Proxy(
        {},
        {
          get: (_, id) => fixture.loaders[String(id)],
          getOwnPropertyDescriptor: (_, id) =>
            Object.hasOwn(fixture.loaders, id)
              ? { configurable: true, enumerable: true, value: fixture.loaders[String(id)] }
              : undefined,
        },
      ),
    ),
    supportImage: (image: unknown) => image,
  }
})
import { supportStore } from '../../content/support/registry'

function Location() {
  const location = useLocation()
  return <div aria-label="当前地址">{location.pathname + location.search + location.hash}</div>
}
function show(path = '/support') {
  return render(
    <ThemeProvider>
      <ExMessageContext />
      <MemoryRouter initialEntries={[path]}>
        <FeedbackProvider>
          <Routes>
            <Route path="/support/*" element={<SupportRoutes />} />
          </Routes>
          <Location />
        </FeedbackProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}
function addErrors() {
  fixture.registry.categories.push({ id: 'general', label: '常规排查', order: 0 })
  fixture.registry.errors.push(
    {
      id: 'errors/second.mdx',
      url: '/support/errors/second',
      slug: 'second',
      title: '第二个问题',
      description: '第二个摘要',
      category: 'general',
      quickAnswer: '第二个快速说明',
      order: 2,
      featuredOrder: 2,
    },
    {
      id: 'errors/first.mdx',
      url: '/support/errors/first',
      slug: 'first',
      title: '第一个问题',
      description: '第一个摘要',
      category: 'general',
      quickAnswer: '第一个快速说明',
      order: 1,
      featuredOrder: 1,
    },
  )
  fixture.registry.featured.push('first', 'second')
  fixture.loaders['errors/first.mdx'] = async () => ({
    default: () => (
      <>
        <h2 id="symptoms">问题表现</h2>
        <p>真实正文</p>
        <h3 id="checks">排查步骤</h3>
        <pre>
          <code>不是目录标题</code>
        </pre>
      </>
    ),
  })
  fixture.loaders['errors/second.mdx'] = async () => ({ default: () => <p>没有标题的正文</p> })
}
beforeEach(() => {
  sessionStorage.clear()
  localStorage.setItem('exwebsite.auth.token', 'b'.repeat(43))
  fixture.registry.errors.length = 0
  fixture.registry.featured.length = 0
  fixture.registry.contacts.length = 0
  fixture.registry.categories.length = 0
  fixture.registry.clickup = null
  Object.keys(fixture.loaders).forEach((id) => delete fixture.loaders[id])
  supportStore.clear()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('opens both feedback entry modals, preserving focus and empty content states', async () => {
  const user = userEvent.setup()
  show()
  expect(screen.queryByText('即将开放')).toBeNull()
  const cards = within(screen.getByRole('region', { name: '反馈与建议' })).getAllByRole('article')
  expect(cards).toHaveLength(2)
  for (const card of cards) {
    const title = within(card).getByRole('heading', { level: 3 }).textContent!
    expect(within(card).queryByRole('link')).toBeNull()
    const trigger = within(card).getByRole('button', { name: title })
    await user.click(trigger)
    const modal = await screen.findByRole('dialog', { name: title })
    expect(within(modal).queryByLabelText('标题')).toBeNull()
    expect(await within(modal).findByText('反馈提交暂未配置，请稍后再试。')).toBeTruthy()
    await user.click(within(modal).getByRole('button', { name: '关闭反馈表单' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: title })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }
  expect(screen.getByText('常见错误内容整理中')).toBeTruthy()
  expect(screen.getByText('联系人资料整理中')).toBeTruthy()
  expect(screen.getByText('开发面板暂未配置')).toBeTruthy()
  expect(document.querySelector('iframe')).toBeNull()
})
it('uses independently closed native disclosure rows and navigates only through their detail links', () => {
  addErrors()
  show()
  const summaries = Array.from(document.querySelectorAll('summary'))
  expect(summaries.map((row) => row.textContent)).toEqual(['第一个问题', '第二个问题'])
  const rows = summaries.map((row) => row.parentElement as HTMLDetailsElement)
  expect(rows.every((row) => !row.open)).toBe(true)
  fireEvent.click(summaries[0]!)
  fireEvent.click(summaries[1]!)
  expect(rows.every((row) => row.open)).toBe(true)
  expect(screen.getByLabelText('当前地址').textContent).toBe('/support')
  fireEvent.click(summaries[0]!)
  expect(rows[0]!.open).toBe(false)
  expect(rows[1]!.open).toBe(true)
  fireEvent.click(within(rows[1]!).getByRole('link', { name: '查看完整说明' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('第二个问题')
})
it('provides the list entry when published errors have no selected featured rows', () => {
  addErrors()
  fixture.registry.featured.length = 0
  show()
  expect(document.querySelector('summary')).toBeNull()
  expect(screen.queryByText('常见错误内容整理中')).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: /查看更多常见错误/ }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('常见错误')
  expect(screen.getByText('共 2 条')).toBeTruthy()
})
it('sorts the whole list by editorial order and supplies category labels and summaries', () => {
  addErrors()
  show('/support/errors')
  const entries = screen
    .getAllByRole('link')
    .filter((link) => /^\/support\/errors\//.test(link.getAttribute('href') ?? ''))
  expect(entries.map((link) => link.getAttribute('href'))).toEqual([
    '/support/errors/first',
    '/support/errors/second',
  ])
  expect(within(entries[0]!).getByText('第一个摘要')).toBeTruthy()
  expect(within(entries[0]!).getByText('常规排查')).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
})
it('scrolls the new page heading into view when navigating without a hash from a lower list entry', () => {
  addErrors()
  show('/support/errors')
  vi.stubGlobal('scrollY', 1200)
  const lowerEntry = screen.getByRole('link', { name: /第二个问题/ })
  lowerEntry.focus()
  const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView)
  scroll.mockClear()
  fireEvent.click(lowerEntry)
  const heading = screen.getByRole('heading', { level: 1, name: '第二个问题' })
  expect(document.activeElement).toBe(heading)
  expect(scroll.mock.contexts).toEqual([heading])
  expect(scroll).toHaveBeenCalledWith({ block: 'start' })
})
it('does not scroll or steal focus when delayed content finishes after interaction on a no-hash page', async () => {
  addErrors()
  let resolve!: (module: ContentModule) => void
  fixture.loaders['errors/first.mdx'] = () =>
    new Promise((done) => {
      resolve = done
    })
  show('/support/errors/first')
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  const returnLink = screen.getByRole('link', { name: '返回常见错误列表' })
  returnLink.focus()
  const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView)
  scroll.mockClear()
  await act(async () => resolve({ default: () => <h2 id="late">迟到的标题</h2> }))
  expect(document.activeElement).toBe(returnLink)
  expect(scroll).not.toHaveBeenCalled()
})
it.each(['/support/errors/missing', '/support/unknown', '/support/errors/first/extra'])(
  'renders a protected-module 404 with known return routes for %s',
  (path) => {
    show(path)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/404|不存在|找不到/)
    expect(screen.getByRole('link', { name: '返回支持首页' }).getAttribute('href')).toBe('/support')
    expect(screen.getByRole('link', { name: '返回常见错误列表' }).getAttribute('href')).toBe(
      '/support/errors',
    )
  },
)
it('normalizes trailing slashes with query and hash intact', async () => {
  show('/support/errors///?from=menu#checks')
  await waitFor(() =>
    expect(screen.getByLabelText('当前地址').textContent).toBe('/support/errors?from=menu#checks'),
  )
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('常见错误')
})
it('creates a directory only from rendered h2/h3 and clears it when the next article has no headings', async () => {
  addErrors()
  show('/support/errors/first')
  await screen.findByText('真实正文')
  const toc = await screen.findByRole('navigation', { name: '正文目录' })
  expect(
    within(toc)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href')),
  ).toEqual(['/support/errors/first#symptoms', '/support/errors/first#checks'])
  expect(within(toc).queryByText('不是目录标题')).toBeNull()
  fireEvent.click(within(toc).getByRole('link', { name: '排查步骤' }))
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById('checks')))
  fireEvent.click(screen.getByRole('link', { name: '返回常见错误列表' }))
  fireEvent.click(screen.getByRole('link', { name: /第二个问题/ }))
  await screen.findByText('没有标题的正文')
  expect(screen.queryByRole('navigation', { name: '正文目录' })).toBeNull()
})
it('honors a deep-link hash after delayed content is rendered', async () => {
  addErrors()
  let resolve!: (module: ContentModule) => void
  fixture.loaders['errors/first.mdx'] = () =>
    new Promise((done) => {
      resolve = done
    })
  show('/support/errors/first#late')
  expect(screen.getByRole('status').textContent).toMatch(/加载/)
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  await act(async () => resolve({ default: () => <h2 id="late">迟到的标题</h2> }))
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById('late')))
  expect(screen.getByLabelText('当前地址').textContent).toBe('/support/errors/first#late')
})
it('isolates a delayed article result after leaving the detail route', async () => {
  addErrors()
  let resolve!: (module: ContentModule) => void
  fixture.loaders['errors/first.mdx'] = () =>
    new Promise((done) => {
      resolve = done
    })
  show('/support/errors/first')
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('link', { name: '返回常见错误列表' }))
  await act(async () => resolve({ default: () => <h2 id="stale">过时的正文</h2> }))
  expect(screen.queryByText('过时的正文')).toBeNull()
  expect(screen.queryByRole('navigation', { name: '正文目录' })).toBeNull()
})
it('offers retry and document reload and renders content after retry succeeds', async () => {
  addErrors()
  let attempts = 0
  fixture.loaders['errors/first.mdx'] = async () => {
    if (++attempts === 1) throw new Error('private import error')
    return { default: () => <h2 id="recovered">已恢复的正文</h2> }
  }
  show('/support/errors/first')
  await screen.findByRole('alert')
  expect(screen.queryByText('private import error')).toBeNull()
  expect(screen.getByRole('button', { name: '重新加载当前页面' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  await screen.findByRole('heading', { name: '已恢复的正文' })
})
it('keeps QQ selectable on copy failure, uses safe mailto and a missing-avatar fallback', async () => {
  fixture.registry.contacts.push(
    {
      id: 'person',
      name: '成员甲',
      role: '开发',
      order: 0,
      qq: '001234',
      email: 'person@example.com',
    },
    { id: 'other', name: '成员乙', role: '设计', order: 1 },
  )
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error('denied')
      },
    },
  })
  show()
  expect(screen.getByRole('link', { name: 'person@example.com' }).getAttribute('href')).toBe(
    'mailto:person@example.com',
  )
  fireEvent.click(screen.getByRole('button', { name: '复制成员甲的 QQ' }))
  expect(await screen.findByText(/复制失败/)).toBeTruthy()
  expect(screen.getByText('001234')).toBeTruthy()
  expect(
    within(screen.getByRole('region', { name: '还需要帮助？联系相关成员。' })).getAllByRole(
      'button',
    ),
  ).toHaveLength(1)
})
it('reports successful QQ copy without exposing internal errors', async () => {
  fixture.registry.contacts.push({
    id: 'person',
    name: '成员甲',
    role: '开发',
    order: 0,
    qq: '001234',
  })
  let copied = ''
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value
      },
    },
  })
  show()
  fireEvent.click(screen.getByRole('button', { name: '复制成员甲的 QQ' }))
  expect(await screen.findByText(/QQ 已复制/)).toBeTruthy()
  expect(copied).toBe('001234')
})
it('keeps ClickUp last and renders only explicit accessible iframe props and the public fallback', () => {
  fixture.registry.clickup = {
    game: {
      title: '游戏开发任务视图',
      embedUrl: 'https://fixture.example/embed/view?x=1',
      publicUrl: 'https://fixture.example/view',
    },
    community: {
      title: '社区开发任务视图',
      embedUrl: 'https://fixture.example/embed/community',
      publicUrl: 'https://fixture.example/community',
    },
    requestBucket: { title: '需求桶任务视图', embedUrl: 'https://fixture.example/embed/requests' },
  }
  show()
  const iframe = screen.getByTitle('游戏开发任务视图')
  expect(iframe.getAttribute('src')).toBe('https://fixture.example/embed/view?x=1')
  expect(iframe.getAttribute('loading')).toBe('lazy')
  expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer')
  expect(iframe.hasAttribute('sandbox')).toBe(false)
  expect(iframe.hasAttribute('allow')).toBe(false)
  const link = screen.getByRole('link', { name: /在 ClickUp 中打开/ })
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  const sections = document.querySelectorAll('main > section')
  expect(sections[sections.length - 1]!.contains(iframe)).toBe(true)
})
it('retains panel guidance without inventing an external link when publicUrl is absent', () => {
  fixture.registry.clickup = {
    game: { title: '游戏开发任务视图', embedUrl: 'https://fixture.example/embed/view' },
    community: { title: '社区开发任务视图', embedUrl: 'https://fixture.example/embed/community' },
    requestBucket: { title: '需求桶任务视图', embedUrl: 'https://fixture.example/embed/requests' },
  }
  show()
  expect(screen.getByTitle('游戏开发任务视图')).toBeTruthy()
  expect(screen.queryByRole('link', { name: /在 ClickUp 中打开/ })).toBeNull()
  expect(screen.getByText(/若面板无法显示/)).toBeTruthy()
})
it('loads only the selected ClickUp view and switches its iframe and external fallback together', async () => {
  fixture.registry.clickup = {
    game: {
      title: '游戏开发任务视图',
      embedUrl: 'https://fixture.example/embed/game',
      publicUrl: 'https://fixture.example/game',
    },
    community: {
      title: '社区开发任务视图',
      embedUrl: 'https://fixture.example/embed/community',
      publicUrl: 'https://fixture.example/community',
    },
    requestBucket: { title: '需求桶任务视图', embedUrl: 'https://fixture.example/embed/requests' },
  }
  const user = userEvent.setup()
  show()
  expect(screen.getByRole('tab', { name: '游戏' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByTitle('社区开发任务视图')).toBeNull()
  await user.click(screen.getByRole('tab', { name: '社区' }))
  expect(screen.getByRole('tab', { name: '社区' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByTitle('游戏开发任务视图')).toBeNull()
  expect(document.querySelectorAll('iframe')).toHaveLength(1)
  const panel = screen.getByRole('tabpanel', { name: '社区' })
  expect(within(panel).getByTitle('社区开发任务视图').getAttribute('src')).toBe(
    'https://fixture.example/embed/community',
  )
  expect(
    within(panel)
      .getByRole('link', { name: /在 ClickUp 中打开/ })
      .getAttribute('href'),
  ).toBe('https://fixture.example/community')
})
it('supports keyboard view selection without loading a panel on focus alone', async () => {
  fixture.registry.clickup = {
    game: { title: '游戏开发任务视图', embedUrl: 'https://fixture.example/embed/game' },
    community: { title: '社区开发任务视图', embedUrl: 'https://fixture.example/embed/community' },
    requestBucket: { title: '需求桶任务视图', embedUrl: 'https://fixture.example/embed/requests' },
  }
  const user = userEvent.setup()
  show()
  screen.getByRole('tab', { name: '游戏' }).focus()
  await user.keyboard('{ArrowRight}')
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: '社区' }))
  expect(screen.queryByTitle('社区开发任务视图')).toBeNull()
  await user.keyboard('{Enter}')
  expect(screen.getByTitle('社区开发任务视图')).toBeTruthy()
  expect(screen.queryByTitle('游戏开发任务视图')).toBeNull()
  await user.keyboard('{ArrowRight}')
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: '需求桶' }))
  expect(screen.queryByTitle('需求桶任务视图')).toBeNull()
  await user.keyboard(' ')
  expect(screen.getByTitle('需求桶任务视图')).toBeTruthy()
  expect(screen.queryByTitle('社区开发任务视图')).toBeNull()
  expect(document.querySelectorAll('iframe')).toHaveLength(1)
})
it('shows the request bucket as the third tab and switches its iframe and fallback without the old menu', async () => {
  fixture.registry.clickup = {
    game: {
      title: '游戏开发任务视图',
      embedUrl: 'https://fixture.example/embed/game',
      publicUrl: 'https://fixture.example/game',
    },
    community: {
      title: '社区开发任务视图',
      embedUrl: 'https://fixture.example/embed/community',
      publicUrl: 'https://fixture.example/community',
    },
    requestBucket: {
      title: '需求桶任务视图',
      embedUrl: 'https://sharing.clickup.com/90181517066/l/h/2kzktfra-8598/c454f2386b70b2c',
      publicUrl: 'https://fixture.example/requests',
    },
  }
  const user = userEvent.setup()
  show()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    '游戏',
    '社区',
    '需求桶',
  ])
  expect(screen.queryByText('查看需求桶')).toBeNull()
  expect(screen.queryByText(/上方「查看需求桶」/)).toBeNull()
  expect(screen.queryByTitle('需求桶任务视图')).toBeNull()
  await user.click(screen.getByRole('tab', { name: '需求桶' }))
  expect(screen.getByRole('tab', { name: '需求桶' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByTitle('游戏开发任务视图')).toBeNull()
  expect(screen.queryByTitle('社区开发任务视图')).toBeNull()
  expect(document.querySelectorAll('iframe')).toHaveLength(1)
  const panel = screen.getByRole('tabpanel', { name: '需求桶' })
  expect(within(panel).getByTitle('需求桶任务视图').getAttribute('src')).toBe(
    'https://sharing.clickup.com/90181517066/l/h/2kzktfra-8598/c454f2386b70b2c',
  )
  expect(
    within(panel)
      .getByRole('link', { name: /在 ClickUp 中打开/ })
      .getAttribute('href'),
  ).toBe('https://fixture.example/requests')
  await user.click(screen.getByRole('tab', { name: '游戏' }))
  expect(screen.queryByTitle('需求桶任务视图')).toBeNull()
  expect(document.querySelectorAll('iframe')).toHaveLength(1)
  expect(screen.getByTitle('游戏开发任务视图')).toBeTruthy()
})
it('does not invent a request bucket fallback when its public URL is absent', async () => {
  fixture.registry.clickup = {
    game: {
      title: '游戏开发任务视图',
      embedUrl: 'https://fixture.example/embed/game',
      publicUrl: 'https://fixture.example/game',
    },
    community: { title: '社区开发任务视图', embedUrl: 'https://fixture.example/embed/community' },
    requestBucket: { title: '需求桶任务视图', embedUrl: 'https://fixture.example/embed/requests' },
  }
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('tab', { name: '需求桶' }))
  expect(screen.getByTitle('需求桶任务视图')).toBeTruthy()
  expect(screen.queryByRole('link', { name: /在 ClickUp 中打开/ })).toBeNull()
  expect(screen.getByText(/若面板无法显示，请稍后重试/)).toBeTruthy()
})
it('replaces a failed contact avatar with the member initial while preserving identity and controls', () => {
  fixture.registry.contacts.push({
    id: 'person',
    name: '成员甲',
    role: '开发',
    order: 0,
    avatar: { src: '/portrait.webp', alt: '成员甲的头像', width: 100, height: 100 },
  })
  show()
  fireEvent.error(screen.getByRole('img', { name: '成员甲的头像' }))
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('成')).toBeTruthy()
  expect(screen.getByRole('heading', { name: '成员甲' })).toBeTruthy()
  expect(
    within(screen.getByRole('region', { name: '还需要帮助？联系相关成员。' })).queryByRole(
      'button',
    ),
  ).toBeNull()
})
