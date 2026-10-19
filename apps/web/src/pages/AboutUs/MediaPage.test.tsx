// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '@exre/exui'
import { StrictMode } from 'react'
import { createContentStore } from '../../content/store'
import { AboutUs } from './AboutUs'

vi.mock('../../content/about/registry', () => {
  const page = {
    id: 'media.mdx',
    url: '/aboutus/media',
    section: 'media',
    kind: 'media',
    title: '音乐和影像',
    description: '介绍',
    backgroundVideoUrl: 'https://example.com/background.mp4',
    playlist: {
      embedUrl: 'https://embed.music.apple.com/us/playlist/example/pl.u-test',
      title: '我们的歌单',
      description: '音乐介绍',
    },
    videos: { title: '影像记录', description: '影像介绍' },
  }
  return {
    aboutRegistry: {
      pages: [page],
      members: [],
      milestones: [],
      media: [
        {
          id: 'music',
          title: '视频甲',
          type: 'video',
          creator: '作者',
          usage: '说明',
          sourceUrl: 'https://example.com/watch',
        },
      ],
    },
    aboutStore: createContentStore({ 'media.mdx': async () => ({ default: () => <p>正文</p> }) }),
    aboutImage: (value: unknown) => value,
  }
})
vi.mock('@paper-design/shaders-react', () => ({ MeshGradient: () => <div /> }))
vi.mock('../../config/team-config', () => ({ teamConfig: { teams: [] } }))
let reduced = false
let visibility: DocumentVisibilityState = 'visible'
let motionChange: (() => void) | undefined
beforeEach(() => {
  reduced = false
  visibility = 'visible'
  motionChange = undefined
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('reduced-motion') && reduced
    },
    addEventListener: (_: string, listener: () => void) => {
      if (query.includes('reduced-motion')) motionChange = listener
    },
    removeEventListener: vi.fn(),
  }))
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('pause'))
  })
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
async function show() {
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(
      <StrictMode>
        <ThemeProvider>
          <MemoryRouter initialEntries={['/aboutus/media']}>
            <AboutUs />
          </MemoryRouter>
        </ThemeProvider>
      </StrictMode>,
    )
  })
  await screen.findByText('正文')
  return view
}
async function foreground(value: DocumentVisibilityState) {
  await act(async () => {
    visibility = value
    document.dispatchEvent(new Event('visibilitychange'))
  })
}
it('loops a muted inline background without playback controls while keeping music and external video links', async () => {
  const { container } = await show()
  const video = container.querySelector('video')!
  expect(video).not.toBeNull()
  expect(video.getAttribute('src')).toBe('https://example.com/background.mp4')
  expect(video.muted && video.loop && video.playsInline).toBe(true)
  expect(screen.queryByRole('button', { name: /暂停背景|播放背景|背景暂不可用/ })).toBeNull()
  expect(screen.getByTitle('Apple Music — 我们的歌单')).toBeTruthy()
  const external = screen.getByRole('link', { name: /视频甲/ })
  expect(external.getAttribute('target')).toBe('_blank')
  expect(external.getAttribute('rel')).toContain('noopener')
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
})
it('pauses in the background and resumes automatic playback when visible', async () => {
  await show()
  vi.mocked(HTMLMediaElement.prototype.pause).mockClear()
  vi.mocked(HTMLMediaElement.prototype.play).mockClear()
  await foreground('hidden')
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  await foreground('visible')
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
})
it('does not request or play a background in reduced-motion mode', async () => {
  reduced = true
  const { container } = await show()
  expect(container.querySelector('video')?.hasAttribute('src')).toBe(false)
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /背景/ })).toBeNull()
})
it('reacts to reduced-motion changes during automatic playback', async () => {
  const { container } = await show()
  vi.mocked(HTMLMediaElement.prototype.pause).mockClear()
  await act(async () => {
    reduced = true
    motionChange?.()
  })
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(container.querySelector('video')?.hasAttribute('data-static')).toBe(true)
})
it('keeps a video named music reachable without colliding with the music chapter', async () => {
  await show()
  expect(document.getElementById('media-music')?.tagName).toBe('ARTICLE')
})
it.each([false, true])(
  'scrolls to and focuses music, respecting reduced motion: %s',
  async (reduce) => {
    reduced = reduce
    await show()
    const target = screen.getByRole('region', { name: '我们的歌单' })
    const scroll = vi.fn()
    Object.defineProperty(target, 'scrollIntoView', { configurable: true, value: scroll })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })
    fireEvent(screen.getByRole('link', { name: '探索音乐和影像' }), click)
    expect(click.defaultPrevented).toBe(true)
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: reduce ? 'instant' : 'smooth' })
    expect(document.activeElement).toBe(target)
  },
)
it('uses immediate positioning for keyboard activation', async () => {
  await show()
  const target = screen.getByRole('region', { name: '我们的歌单' })
  const scroll = vi.fn()
  Object.defineProperty(target, 'scrollIntoView', { configurable: true, value: scroll })
  fireEvent.click(screen.getByRole('link', { name: '探索音乐和影像' }), { detail: 0 })
  expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  expect(document.activeElement).toBe(target)
})
it('keeps the playlist available without playback controls when autoplay is rejected', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('NotAllowedError'))
  await show()
  expect(screen.queryByRole('button', { name: /背景/ })).toBeNull()
  expect(screen.getByTitle('Apple Music — 我们的歌单').getAttribute('src')).toBe(
    'https://embed.music.apple.com/us/playlist/example/pl.u-test',
  )
  expect(document.querySelector('video')?.autoplay).toBe(false)
})
it('handles background errors and releases the video source on route unmount', async () => {
  const { container, unmount } = await show()
  const video = container.querySelector('video')!
  fireEvent.error(video)
  expect(screen.queryByRole('button', { name: /背景/ })).toBeNull()
  expect(video.hasAttribute('src')).toBe(false)
  expect(screen.getByTitle('Apple Music — 我们的歌单')).toBeTruthy()
  unmount()
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalled()
  expect(video.hasAttribute('src')).toBe(false)
})
