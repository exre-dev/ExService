// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '@exre/exui'
import type { AboutPage } from '../../content/about/types'
import type { ContentState } from '../../content/useContent'
import { AboutHome } from './AboutHome'

vi.mock('../../content/about/registry', () => ({
  aboutRegistry: {
    pages: ['communities', 'team', 'media', 'story', 'donations'].map((section) => ({
      kind: section === 'donations' ? 'donations' : 'section',
      section,
      title: section,
      description: `${section} summary`,
      url: `/aboutus/${section}`,
    })),
  },
  aboutImage: (image: unknown) => image,
}))
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const page: Extract<AboutPage, { kind: 'home' }> = {
  id: 'index.mdx',
  url: '/aboutus',
  title: '关于 Exre',
  description: 'Intro',
  section: 'home',
  kind: 'home',
  hero: { headline: 'Headline\\nSecond line', summary: 'Summary' },
  introHeading: 'Belief',
}
const ready: ContentState = {
  status: 'ready',
  module: {
    default: () => (
      <>
        <p>First author paragraph</p>
        <p>Second author paragraph</p>
        <aside>Author callout</aside>
      </>
    ),
  },
}
function content(home = page, state: ContentState = ready, retry = vi.fn()) {
  return (
    <ThemeProvider>
      <MemoryRouter>
        <AboutHome page={home} state={state} components={{}} retry={retry} />
      </MemoryRouter>
    </ThemeProvider>
  )
}
it('renders metadata fallbacks, complete author content and four ordinary placeholders', () => {
  render(content())
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Headline\nSecond line')
  expect(screen.getByRole('heading', { name: 'communities' })).toBeTruthy()
  expect(screen.getByText('communities summary')).toBeTruthy()
  expect(screen.getAllByText(/ · 素材待补充/)).toHaveLength(4)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('First author paragraph')).toBeTruthy()
  expect(screen.getByText('Second author paragraph')).toBeTruthy()
  expect(screen.getByText('Author callout')).toBeTruthy()
})
it('uses supplied hero lead and entry text without creating extra link targets', () => {
  render(
    content({
      ...page,
      hero: { ...page.hero, lead: 'Hero lead' },
      entryHeadlines: { communities: 'Custom headline' },
      entryDescriptions: { communities: 'Custom summary' },
    }),
  )
  expect(screen.getByText('Hero lead')).toBeTruthy()
  const community = screen.getByRole('article', { name: 'communities' })
  expect(within(community).getByRole('heading', { name: 'Custom headline' })).toBeTruthy()
  expect(within(community).getByText('Custom summary')).toBeTruthy()
  expect(within(community).getAllByRole('link')).toHaveLength(1)
})
it('keeps loading and error recovery in the belief module while entries remain usable', () => {
  const retry = vi.fn()
  const view = render(content(page, { status: 'loading' }, retry))
  const belief = screen.getByRole('article', { name: '我们的理念' })
  expect(within(belief).getByRole('status')).toBeTruthy()
  expect(
    within(screen.getByRole('region', { name: '进一步认识 Exre' })).getAllByRole('link'),
  ).toHaveLength(5)
  view.rerender(content(page, { status: 'error' }, retry))
  const error = within(belief).getByRole('alert')
  fireEvent.click(within(error).getByRole('button', { name: '重试' }))
  expect(retry).toHaveBeenCalledOnce()
  expect(within(error).getByRole('button', { name: '重新加载当前页面' })).toBeTruthy()
})
it.each([
  [false, 'smooth'],
  [true, 'instant'],
] as const)(
  'scrolls the cue to the stories and transfers focus (reduced motion=%s)',
  (reduced, behavior) => {
    vi.stubGlobal('matchMedia', () => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    render(content())
    const stories = screen.getByRole('region', { name: '进一步认识 Exre' })
    const scroll = vi.fn()
    Object.defineProperty(stories, 'scrollIntoView', { value: scroll, configurable: true })
    const cue = screen.getByRole('link', { name: '向下滚动，了解 Exre' })
    expect(cue.getAttribute('href')).toBe('#about-content')
    fireEvent.click(cue)
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'start', behavior })
    expect(document.activeElement).toBe(stories)
  },
)
it('uses actual image metadata and returns to a placeholder after an image failure', () => {
  const image = {
    src: '/media.png',
    alt: 'Media scene',
    width: 1200,
    height: 800,
    position: { x: 20, y: 80 },
  }
  const view = render(content({ ...page, cardImages: { media: image } }))
  const rendered = screen.getByRole('img', { name: 'Media scene' }) as HTMLImageElement
  expect(rendered.getAttribute('width')).toBe('1200')
  expect(rendered.style.objectPosition).toBe('20% 80%')
  expect(rendered.closest('a')).toBeNull()
  fireEvent.error(rendered)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getAllByText(/ · 素材待补充/)).toHaveLength(4)
  view.rerender(content({ ...page, cardImages: { media: { ...image, src: '/replacement.png' } } }))
  expect(screen.getByRole('img', { name: 'Media scene' }).getAttribute('src')).toBe(
    '/replacement.png',
  )
})
