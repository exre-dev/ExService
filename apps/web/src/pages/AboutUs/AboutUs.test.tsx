// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router'
import { ThemeProvider } from '@exre/exui'
import type { ComponentType, ReactNode } from 'react'
import { createContentStore, type ContentModule } from '../../content/store'
import { aboutStore } from '../../content/about/registry'
import { AboutUs } from './AboutUs'
import { AboutBody } from './AboutBody'

vi.mock('../../content/about/registry', () => {
  const pages = [
    {
      id: 'index.mdx',
      url: '/aboutus',
      title: '关于 Exre',
      description: 'Intro',
      section: 'home',
      kind: 'home',
      hero: { headline: '共同创造', summary: 'Summary' },
      introHeading: '认识我们',
    },
    ...['communities', 'story'].map((section) => ({
      id: `${section}.mdx`,
      url: `/aboutus/${section}`,
      section,
      kind: 'section',
      title: { communities: '社区', story: '历程' }[section],
      description: `${section} introduction`,
    })),
    {
      id: 'media.mdx',
      url: '/aboutus/media',
      section: 'media',
      kind: 'media',
      title: '音乐和影像',
      description: 'media introduction',
      backgroundVideoUrl: 'https://example.com/background.mp4',
      playlist: {
        embedUrl: 'https://embed.music.apple.com/us/playlist/example/pl.u-test',
        title: '我们的歌单',
        description: '音乐介绍',
      },
      videos: { title: '影像记录', description: '影像介绍' },
    },
    {
      id: 'team.mdx',
      url: '/aboutus/team',
      section: 'team',
      kind: 'team',
      title: '团队',
      description: 'team introduction',
      recruitment: {
        eyebrow: 'BUILD WITH US',
        title: '加入 Exre，一起创造。',
        description: '共同开发',
        highlights: ['共同创作'],
        entryEyebrow: 'NEXT STEP',
        entryTitle: '从这里开始。',
        entryDescription: '通过招募入口，了解加入方式。',
        buttonLabel: '加入开发团队',
      },
    },
    {
      id: 'donations.mdx',
      url: '/aboutus/donations',
      section: 'donations',
      kind: 'donations',
      title: '捐赠',
      description: '捐赠信息',
      channels: [],
      donors: [],
    },
    {
      id: 'community.mdx',
      url: '/aboutus/communities/example-community',
      section: 'communities',
      kind: 'community',
      slug: 'example-community',
      title: '社区故事占位',
      description: '社区介绍',
      status: 'unknown',
      order: 0,
      related: { members: ['person'] },
    },
    {
      id: 'rifling.mdx',
      url: '/aboutus/communities/rifling-911',
      section: 'communities',
      kind: 'community',
      slug: 'rifling-911',
      title: 'Rifling-911',
      description: 'Rifling introduction',
      status: 'unknown',
      order: 0,
      theme: {
        colorBack: '#0868de',
        accent: '#065ed1',
        colorFill: '#ffffff7d',
        colorStroke: '#ffffff',
      },
    },
    {
      id: 'caep.mdx',
      url: '/aboutus/communities/caep',
      section: 'communities',
      kind: 'community',
      slug: 'caep',
      title: 'CAEP',
      description: 'CAEP introduction',
      status: 'archived',
      order: 1,
      theme: {
        colorBack: '#0c7b6f',
        accent: '#087265',
        colorFill: '#ffffff7d',
        colorStroke: '#ffffff',
      },
    },
  ]
  return {
    aboutRegistry: {
      pages,
      members: [
        {
          id: 'person.mdx',
          slug: 'person',
          title: '贡献者甲',
          role: '设计',
          summary: '介绍甲',
          kind: 'contributor',
          order: 0,
          links: [],
        },
      ],
      media: [
        { id: 'song', title: '音乐甲', type: 'music', creator: '作者甲', usage: '使用背景' },
        { id: 'film', title: '视频乙', type: 'video', creator: '作者乙', usage: '使用背景' },
      ],
      milestones: [],
    },
    aboutStore: createContentStore(
      Object.fromEntries(
        [...pages.map((page) => page.id), 'person.mdx'].map((id) => [
          id,
          async () => ({
            default: () => <p>{id === 'person.mdx' ? '成员甲的正文' : `正文 ${id}`}</p>,
          }),
        ]),
      ),
    ),
    aboutImage: (value: unknown) => value,
    aboutTarget: () => '/aboutus',
  }
})
vi.mock('@paper-design/shaders-react', () => ({ MeshGradient: () => <div /> }))
vi.mock('../../config/team-config', async () => ({
  teamConfig: (await import('../../config/team')).parseTeamConfig({
    teams: [
      {
        id: 'showcase-member',
        name: '团队测试成员',
        role: '开发',
        bio: '测试简介',
        strengths: [],
        theme: { colorBack: '#0868de', accent: '#065ed1' },
      },
    ],
  }),
}))
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function show(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AboutUs />
      </MemoryRouter>
    </ThemeProvider>,
  )
}
it('switches the community presentation and its document destination together', async () => {
  const user = userEvent.setup()
  show('/aboutus/communities')
  const caep = screen.getByRole('tab', { name: 'CAEP' })
  await user.click(caep)
  expect(caep.getAttribute('aria-selected')).toBe('true')
  const panel = screen.getByRole('tabpanel', { name: 'CAEP' })
  expect(within(panel).getByRole('heading', { name: 'CAEP' })).toBeTruthy()
  expect(within(panel).getByText('CAEP introduction')).toBeTruthy()
  expect(within(panel).getByRole('img').getAttribute('src')).toBe(
    '/images/heros/join/caep/hero.png',
  )
  expect(within(panel).getByRole('link', { name: '查看社区文档' }).getAttribute('href')).toBe(
    '/aboutus/communities/caep',
  )
  await user.click(screen.getByRole('tab', { name: 'Rifling-911' }))
  expect(screen.getByRole('link', { name: '查看社区文档' }).getAttribute('href')).toBe(
    '/aboutus/communities/rifling-911',
  )
})
it('uses the selected community shader palette with a readable fallback when WebGL is unavailable', async () => {
  const user = userEvent.setup()
  show('/aboutus/communities')
  await user.click(screen.getByRole('tab', { name: 'Rifling-911' }))
  const riflingPanel = screen.getByRole('tabpanel', { name: 'Rifling-911' })
  const riflingBackground = riflingPanel.querySelector<HTMLElement>('[data-team-background="dot"]')
  expect(riflingBackground?.style.background).toBe('rgb(8, 104, 222)')
  expect(riflingBackground?.getAttribute('data-state')).toBe('fallback')
  await user.click(screen.getByRole('tab', { name: 'CAEP' }))
  const caepPanel = screen.getByRole('tabpanel', { name: 'CAEP' })
  expect(
    caepPanel.querySelector<HTMLElement>('[data-team-background="dot"]')?.style.background,
  ).toBe('rgb(12, 123, 111)')
  expect(within(caepPanel).getByRole('link', { name: '查看社区文档' }).getAttribute('href')).toBe(
    '/aboutus/communities/caep',
  )
})
function storyModule(withMember = false): ContentModule {
  return {
    default: ({ components }) => {
      const Timeline = components!.Timeline as ComponentType<{
        headline: string
        children: ReactNode
      }>
      const Chapter = (components!.StoryChapter ?? 'section') as ComponentType<{
        yearLabel: string
        placeholderPhotos: number
        children: ReactNode
      }>
      const Milestone = components!.Milestone as ComponentType<{
        id: string
        title: string
        dateLabel: string
        children: ReactNode
        related?: { members: string[] }
      }>
      return (
        <Timeline headline="一起创造的故事">
          <Chapter yearLabel="2016" placeholderPhotos={1}>
            <Milestone id="beginning" title="故事起点" dateLabel="示例日期">
              第一阶段
            </Milestone>
          </Chapter>
          <Chapter yearLabel="2018" placeholderPhotos={2}>
            <Milestone
              id="creating"
              title="共同创作"
              dateLabel="示例日期"
              related={withMember ? { members: ['person'] } : undefined}
            >
              第二阶段
            </Milestone>
          </Chapter>
        </Timeline>
      )
    },
  }
}
it('keeps the About navigation and switches Story stages with single and double photos', async () => {
  vi.spyOn(aboutStore, 'load').mockResolvedValueOnce(storyModule())
  show('/aboutus/story')
  expect(await screen.findByRole('heading', { name: '一起创造的故事' })).toBeTruthy()
  expect(screen.getByRole('navigation', { name: 'About 栏目' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: '项目' })).toBeNull()
  expect((screen.getByRole('button', { name: '上一阶段' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(screen.getByRole('button', { name: '2016' }).getAttribute('aria-current')).toBe('step')
  expect(
    within(screen.getByRole('group', { name: '2016 年照片' })).getAllByRole('img'),
  ).toHaveLength(1)
  expect(
    within(screen.getByRole('group', { name: '2018 年照片' })).getAllByRole('img'),
  ).toHaveLength(2)
  const viewport = screen.getByRole('region', { name: '历程展示' })
  const scroll = vi.fn()
  Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scroll })
  Object.defineProperty(screen.getByRole('region', { name: '2018 年历程' }), 'offsetLeft', {
    configurable: true,
    value: 900,
  })
  fireEvent.click(screen.getByRole('button', { name: '下一阶段' }))
  expect(scroll).toHaveBeenCalledWith({ left: 900, behavior: 'smooth' })
  expect(screen.getByRole('button', { name: '2018' }).getAttribute('aria-current')).toBe('step')
  expect((screen.getByRole('button', { name: '下一阶段' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  fireEvent.keyDown(viewport, { key: 'ArrowLeft' })
  expect(screen.getByRole('button', { name: '2016' }).getAttribute('aria-current')).toBe('step')
  Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: 900 })
  fireEvent.pointerDown(viewport)
  fireEvent.scroll(viewport)
  expect(screen.getByRole('button', { name: '2018' }).getAttribute('aria-current')).toBe('step')
})
it('selects the chapter containing a directly linked legacy milestone', async () => {
  vi.spyOn(aboutStore, 'load').mockResolvedValueOnce(storyModule())
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  show('/aboutus/story#milestone-creating')
  await screen.findByRole('button', { name: '2018' })
  expect(screen.getByRole('button', { name: '2018' }).getAttribute('aria-current')).toBe('step')
  expect(document.getElementById('milestone-creating')).toBeTruthy()
  expect(document.activeElement).toBe(document.getElementById('milestone-creating'))
})
it('restores the selected Story chapter after leaving and going back', async () => {
  const original = aboutStore.load
  vi.spyOn(aboutStore, 'load').mockImplementation((id) =>
    id === 'story.mdx' ? Promise.resolve(storyModule()) : original(id),
  )
  function HistoryControls() {
    const navigate = useNavigate()
    return <button onClick={() => navigate(-1)}>浏览器后退</button>
  }
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[{ pathname: '/aboutus/story', key: 'story-return' }]}>
        <AboutUs />
        <HistoryControls />
      </MemoryRouter>
    </ThemeProvider>,
  )
  await screen.findByRole('button', { name: '2018' })
  fireEvent.click(screen.getByRole('button', { name: '2018' }))
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'About 栏目' })).getByRole('link', {
      name: '社区',
    }),
  )
  await screen.findByRole('tab', { name: 'CAEP' })
  fireEvent.click(screen.getByRole('button', { name: '浏览器后退' }))
  await screen.findByRole('button', { name: '2018' })
  expect(screen.getByRole('button', { name: '2018' }).getAttribute('aria-current')).toBe('step')
})
it('keeps the selected Story chapter when a related member modal rerenders its body', async () => {
  const original = aboutStore.load
  vi.spyOn(aboutStore, 'load').mockImplementation((id) =>
    id === 'story.mdx' ? Promise.resolve(storyModule(true)) : original(id),
  )
  show('/aboutus/communities')
  await screen.findByRole('tab', { name: 'CAEP' })
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'About 栏目' })).getByRole('link', {
      name: '历程',
    }),
  )
  await screen.findByRole('button', { name: '2018' })
  fireEvent.click(screen.getByRole('button', { name: '2018' }))
  fireEvent.click(screen.getByRole('button', { name: /贡献者甲/ }))
  await screen.findByRole('dialog', { name: '贡献者甲' })
  expect(document.querySelector('button[aria-current="step"]')?.textContent).toBe('2018')
})
it('shows an introduction and all five section links from the home', async () => {
  show('/aboutus')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('共同创造')
  await screen.findByText('正文 index.mdx')
  expect(
    screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/aboutus/media'),
  ).toBe(true)
})
it('keeps an early hero scroll when the home body finishes loading', async () => {
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(window.innerHeight * 3)
  let finish!: (module: ContentModule) => void
  const pending = new Promise<ContentModule>((resolve) => {
    finish = resolve
  })
  vi.spyOn(aboutStore, 'load').mockReturnValueOnce(pending)
  show('/aboutus')
  expect(
    within(screen.getByRole('article', { name: '我们的理念' })).getByRole('status'),
  ).toBeTruthy()
  const stories = document.getElementById('about-content')!
  Object.defineProperty(stories, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(window.scrollTo).mockClear()
  fireEvent.click(screen.getByRole('link', { name: '向下滚动，了解 Exre' }))
  await act(async () => {
    finish({ default: () => <p>Delayed home body</p> })
  })
  expect(screen.getByText('Delayed home body')).toBeTruthy()
  expect(window.scrollTo).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(stories)
})
it('shows one hero, six ordered modules and five section targets without the old home navigation', async () => {
  show('/aboutus')
  await screen.findByText('正文 index.mdx')
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole('region', { name: 'Exre 品牌' })).toBeNull()
  expect(screen.queryByRole('navigation', { name: 'About 栏目' })).toBeNull()
  expect(screen.queryByRole('navigation', { name: 'About 面包屑' })).toBeNull()
  const grid = document.getElementById('about-content')!
  expect([...grid.children].map((child) => child.getAttribute('aria-label'))).toEqual([
    '社区',
    '我们的理念',
    '团队',
    '音乐和影像',
    '历程',
    '捐赠',
  ])
  expect(
    within(grid)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href')),
  ).toEqual([
    '/aboutus/communities',
    '/aboutus/team',
    '/aboutus/media',
    '/aboutus/story',
    '/aboutus/donations',
  ])
  expect(
    within(screen.getByRole('article', { name: '我们的理念' })).getByText('正文 index.mdx'),
  ).toBeTruthy()
})
it('opens the donation section from its home card and keeps the section navigation active', async () => {
  show('/aboutus')
  fireEvent.click(within(screen.getByRole('article', { name: '捐赠' })).getByRole('link'))
  expect(
    await screen.findByRole('heading', { level: 1, name: /让热爱，.*继续发生。/ }),
  ).toBeTruthy()
  expect(
    within(screen.getByRole('navigation', { name: 'About 栏目' }))
      .getByRole('link', { name: '捐赠' })
      .getAttribute('aria-current'),
  ).toBe('page')
  expect(await screen.findByText('正文 donations.mdx')).toBeTruthy()
  expect(screen.getByRole('heading', { name: '渠道信息正在整理' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: '每一份心意，我们都记得。' })).toBeTruthy()
})
it('focuses the home heading when navigating from a section', async () => {
  // jsdom has no document layout; supply the scroll extent used by the real restoration hook.
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(window.innerHeight * 3)
  show('/aboutus/communities')
  await screen.findByRole('tab', { name: 'CAEP' })
  fireEvent.click(screen.getByRole('link', { name: '关于 Exre' }))
  await screen.findByText('正文 index.mdx')
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
})
it('keeps the legacy home hash anchored to the stories grid', async () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  })
  try {
    show('/aboutus#about-content')
    await screen.findByText('正文 index.mdx')
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
    expect(document.getElementById('about-content')?.getAttribute('aria-label')).toBe(
      '进一步认识 Exre',
    )
  } finally {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  }
})
it('places section breadcrumbs beside the section links outside the main content', () => {
  show('/aboutus/communities')
  const breadcrumb = screen.getByRole('navigation', { name: 'About 面包屑' })
  const sections = screen.getByRole('navigation', { name: 'About 栏目' })
  expect(breadcrumb.parentElement).toBe(sections.parentElement)
  expect(
    within(screen.getByRole('main')).queryByRole('navigation', { name: 'About 面包屑' }),
  ).toBeNull()
  expect(screen.getAllByRole('link', { name: '关于 Exre' })).toHaveLength(1)
  expect(breadcrumb.querySelector('[aria-current="page"]')?.textContent).toBe('社区')
})
it.each([
  ['/aboutus/communities/example-community', '社区故事占位', '社区', '/aboutus/communities'],
])(
  'keeps the parent link and current section when breadcrumbs are merged for %s',
  async (path, title, parent, parentPath) => {
    show(path)
    const breadcrumb = screen.getByRole('navigation', { name: 'About 面包屑' })
    const sectionNavigation = screen.getByRole('navigation', { name: 'About 栏目' })
    expect(breadcrumb.parentElement).toBe(sectionNavigation.parentElement)
    expect(breadcrumb.querySelector('[aria-current="page"]')?.textContent).toBe(title)
    expect(
      within(sectionNavigation).getByRole('link', { name: parent }).getAttribute('aria-current'),
    ).toBe('location')
    const parentLink = within(breadcrumb).getByRole('link', { name: parent })
    expect(parentLink.getAttribute('href')).toBe(parentPath)
    fireEvent.click(parentLink)
    expect(await screen.findByRole('heading', { level: 1, name: parent })).toBeTruthy()
    expect(
      screen
        .getByRole('navigation', { name: 'About 面包屑' })
        .querySelector('[aria-current="page"]')?.textContent,
    ).toBe(parent)
  },
)
it('separates the native playlist from video-only links and retains a missing-source state', async () => {
  show('/aboutus/media')
  await screen.findByText('正文 media.mdx')
  expect(screen.getByTitle('Apple Music — 我们的歌单').getAttribute('src')).toContain(
    '/playlist/example/pl.u-test',
  )
  expect(screen.getByTitle('Apple Music — 我们的歌单').getAttribute('height')).toBe('640')
  expect(screen.queryByText('音乐甲')).toBeNull()
  expect(screen.queryByRole('button', { name: '全部' })).toBeNull()
  expect(screen.getByText('视频乙')).toBeTruthy()
  expect(screen.getByText('来源待补充')).toBeTruthy()
  const playlist = screen.getByRole('region', { name: '我们的歌单' })
  const videos = screen.getByRole('region', { name: '影像记录' })
  expect(playlist.compareDocumentPosition(videos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
it('uses the configured showcase on team and retains its body and recruitment section', async () => {
  show('/aboutus/team')
  await screen.findByText('正文 team.mdx')
  expect(screen.getByRole('button', { name: '选择团队测试成员' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: '团队测试成员' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '关注领域' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: '加入开发团队' }).hasAttribute('disabled')).toBe(true)
})
it('opens the legacy member body from a community related-content entry in a named modal', async () => {
  show('/aboutus/communities/example-community')
  fireEvent.click(screen.getByRole('button', { name: /贡献者甲/ }))
  expect(await screen.findByRole('dialog', { name: '贡献者甲' })).toBeTruthy()
  expect(await screen.findByText('成员甲的正文')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '关闭成员简介' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
it.each([
  '/aboutus/projects',
  '/aboutus/projects/',
  '/aboutus/projects/example-project',
  '/aboutus/communities/no-such-community',
])('renders the existing not-found view for removed or unknown routes: %s', (path) => {
  show(path)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/404|找不到|不存在/)
})
it('offers a document reload when the browser retains a failed module import', () => {
  render(
    <MemoryRouter>
      <AboutBody state={{ status: 'error' }} components={{}} retry={vi.fn()} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '重新加载当前页面' })).toBeTruthy()
})
