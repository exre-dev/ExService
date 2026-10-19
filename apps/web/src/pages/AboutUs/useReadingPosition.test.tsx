// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BrowserRouter, Link, MemoryRouter, useLocation, useNavigate } from 'react-router'
import { useReadingPosition } from './useReadingPosition'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('restores a changed native fragment when browser history retains the same router key', () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  })
  vi.stubGlobal('scrollTo', vi.fn())
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(4000)
  const previous = window.location.href
  history.replaceState({ key: 'same-native-key', idx: 0 }, '', '/aboutus/team')
  function Team() {
    const ref = useReadingPosition(true, 'Team', 'Description', 'h1', { focusHashTarget: true })
    return (
      <main ref={ref}>
        <h1 tabIndex={-1}>Team</h1>
        <section id="join" tabIndex={-1}>
          Join
        </section>
      </main>
    )
  }
  render(
    <BrowserRouter>
      <Team />
    </BrowserRouter>,
  )
  act(() => {
    history.replaceState({ key: 'same-native-key', idx: 0 }, '', '/aboutus/team#join')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(document.activeElement).toBe(document.getElementById('join'))
  expect(scroll).toHaveBeenCalledTimes(1)
  act(() => {
    history.replaceState({ key: 'same-native-key', idx: 0 }, '', '/aboutus/team')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  act(() => {
    history.replaceState({ key: 'same-native-key', idx: 0 }, '', '/aboutus/team#join')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(scroll).toHaveBeenCalledTimes(2)
  history.replaceState(null, '', previous)
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})
it('waits for team body readiness and focuses the hash target without resetting on an options object rerender', () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  })
  vi.stubGlobal('scrollTo', vi.fn())
  function Team({ ready }: { ready: boolean }) {
    const ref = useReadingPosition(ready, 'Team', 'Description', 'h1', { focusHashTarget: true })
    return (
      <main ref={ref}>
        <h1 tabIndex={-1}>Team</h1>
        <section id="join" tabIndex={-1}>
          Join
        </section>
      </main>
    )
  }
  const view = render(
    <MemoryRouter initialEntries={['/aboutus/team#join']}>
      <Team ready={false} />
    </MemoryRouter>,
  )
  expect(scroll).not.toHaveBeenCalled()
  view.rerender(
    <MemoryRouter initialEntries={['/aboutus/team#join']}>
      <Team ready />
    </MemoryRouter>,
  )
  expect(document.activeElement).toBe(document.getElementById('join'))
  expect(scroll).toHaveBeenCalledTimes(1)
  view.rerender(
    <MemoryRouter initialEntries={['/aboutus/team#join']}>
      <Team ready />
    </MemoryRouter>,
  )
  expect(scroll).toHaveBeenCalledTimes(1)
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})
it('retains the last recorded scroll position when the destination clamps the document before cleanup', () => {
  let scrollY = 0
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(4000)
  const scroll = vi.fn(({ top }: ScrollToOptions) => {
    scrollY = top ?? 0
  })
  vi.stubGlobal('scrollTo', scroll)
  function ReadingPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const ref = useReadingPosition(true, 'Page', 'Description')
    return (
      <main ref={ref}>
        <h1 tabIndex={-1}>{location.pathname}</h1>
        <Link
          to="/short"
          onClick={() => {
            scrollY = 140
          }}
        >
          Short destination
        </Link>
        <button onClick={() => navigate(-1)}>Back</button>
      </main>
    )
  }
  render(
    <MemoryRouter initialEntries={[{ pathname: '/home', key: 'clamped-home' }]}>
      <ReadingPage />
    </MemoryRouter>,
  )
  act(() => {
    scrollY = 1239
    window.dispatchEvent(new Event('scroll'))
  })
  fireEvent.click(screen.getByRole('link', { name: 'Short destination' }))
  expect(screen.getByRole('heading').textContent).toBe('/short')
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('heading').textContent).toBe('/home')
  expect(scroll).toHaveBeenLastCalledWith({ top: 1239, behavior: 'instant' })
})

it('restores Home after an unfinished Team navigation clamps the document', () => {
  let scrollY = 0
  let pageHeight = 4000
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(() => pageHeight)
  const scroll = vi.fn(({ top }: ScrollToOptions) => {
    scrollY = top ?? 0
  })
  vi.stubGlobal('scrollTo', scroll)
  function ReadingPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const ref = useReadingPosition(location.pathname === '/home', 'Page', 'Description')
    return (
      <>
        <main ref={ref}>
          <h1 tabIndex={-1}>{location.pathname}</h1>
          <Link to="/team">Team</Link>
        </main>
        <button onClick={() => navigate(-1)}>Back</button>
      </>
    )
  }
  render(
    <MemoryRouter initialEntries={[{ pathname: '/home', key: 'interrupted-home' }]}>
      <ReadingPage />
    </MemoryRouter>,
  )
  act(() => {
    scrollY = 1484
    window.dispatchEvent(new Event('scroll'))
  })
  fireEvent.click(screen.getByRole('link', { name: 'Team' }))
  expect(screen.getByRole('heading').textContent).toBe('/team')
  expect(scroll).toHaveBeenCalledTimes(1)
  pageHeight = 1344
  act(() => {
    scrollY = 704
    window.dispatchEvent(new Event('scroll'))
  })
  pageHeight = 4000
  const back = screen.getByRole('button', { name: 'Back' })
  back.focus()
  fireEvent.click(back)
  expect(screen.getByRole('heading').textContent).toBe('/home')
  expect(scroll).toHaveBeenLastCalledWith({ top: 1484, behavior: 'instant' })
  expect(document.activeElement).toBe(back)
})
