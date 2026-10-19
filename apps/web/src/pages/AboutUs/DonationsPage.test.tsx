// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '@exre/exui'
import { createContentStore, type ContentModule } from '../../content/store'
import { aboutStore } from '../../content/about/registry'
import { AboutUs } from './AboutUs'

vi.mock('../../content/about/registry', () => ({
  aboutRegistry: {
    pages: [
      {
        id: 'donations.mdx',
        kind: 'donations',
        section: 'donations',
        url: '/aboutus/donations',
        title: '捐赠',
        description: '支持说明',
        channels: [],
        donors: [],
      },
    ],
    members: [],
    media: [],
    milestones: [],
  },
  aboutStore: createContentStore({
    'donations.mdx': async () => ({ default: () => <p>感谢支持</p> }),
  }),
  aboutImage: (image: unknown) => image,
}))
vi.mock('../../config/team-config', () => ({ teamConfig: { teams: [] } }))
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function show(path = '/aboutus/donations') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AboutUs />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

it('does not reset an early donation-section jump when the introduction finishes loading', async () => {
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(window.innerHeight * 3)
  let finish!: (module: ContentModule) => void
  vi.spyOn(aboutStore, 'load').mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  show()
  expect(screen.getByRole('status')).toBeTruthy()
  const target = document.getElementById('donation-donors')!
  target.scrollIntoView = vi.fn()
  fireEvent.click(screen.getByRole('link', { name: '认识支持我们的人' }), { detail: 0 })
  expect(document.activeElement).toBe(target)
  vi.mocked(window.scrollTo).mockClear()
  await act(async () => {
    finish({ default: () => <p>加载后的说明</p> })
  })
  expect(screen.getByText('加载后的说明')).toBeTruthy()
  expect(window.scrollTo).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(target)
})

it('keeps the catalog and its retry action available after the introduction fails', async () => {
  vi.spyOn(aboutStore, 'load')
    .mockRejectedValueOnce(new Error('chunk unavailable'))
    .mockResolvedValueOnce({ default: () => <p>恢复后的说明</p> })
  show()
  await screen.findByRole('alert')
  expect(screen.getByRole('region', { name: '支持 Exre' })).toBeTruthy()
  expect(screen.getByRole('region', { name: '感谢每一份支持' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(await screen.findByText('恢复后的说明')).toBeTruthy()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

it('focuses the existing donation hash target even while the introduction is pending', () => {
  vi.spyOn(aboutStore, 'load').mockReturnValue(new Promise(() => {}))
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  })
  try {
    show('/aboutus/donations#donation-channels')
    expect(document.activeElement).toBe(document.getElementById('donation-channels'))
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  } finally {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  }
})
