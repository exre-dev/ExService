// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AboutHomeHero } from './AboutHomeHero'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const hero = { headline: 'Exre', summary: 'Explore our stories' }

it('keeps the scroll link in the first-view header but outside the artwork surface', () => {
  const { container } = render(<AboutHomeHero hero={hero} />)
  const cue = screen.getByRole('link', { name: '向下滚动，了解 Exre' })
  const header = container.querySelector('header')!
  expect(cue.parentElement).toBe(header)
  expect(header.firstElementChild).not.toBe(cue)
  expect(cue.querySelector('svg')?.parentElement?.tagName).toBe('SPAN')
  expect(cue.getAttribute('href')).toBe('#about-content')
})

it('runs the cue only while its hit area is visible below the site header and the tab is foregrounded', () => {
  let notify!: IntersectionObserverCallback
  let options: IntersectionObserverInit | undefined
  const disconnect = vi.fn()
  const observe = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback, config?: IntersectionObserverInit) {
        notify = callback
        options = config
      }
      observe = observe
      disconnect = disconnect
    },
  )
  let hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const removeListener = vi.spyOn(document, 'removeEventListener')
  const { unmount } = render(
    <>
      <header
        data-site-header
        ref={(node) => {
          if (node) node.getBoundingClientRect = () => new DOMRect(0, 0, 390, 64)
        }}
      />
      <AboutHomeHero hero={hero} />
    </>,
  )
  const cue = screen.getByRole('link', { name: '向下滚动，了解 Exre' })
  const visible = (ratio: number, height: number) =>
    act(() =>
      notify(
        [
          {
            isIntersecting: true,
            intersectionRatio: ratio,
            intersectionRect: { height },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    )
  expect(cue.getAttribute('data-motion')).toBe('paused')
  expect(observe).toHaveBeenCalledExactlyOnceWith(cue)
  expect(options).toEqual({ rootMargin: '-64px 0px 0px 0px', threshold: 0.001 })
  visible(1, 30)
  expect(cue.getAttribute('data-motion')).toBe('active')
  hidden = true
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(cue.getAttribute('data-motion')).toBe('paused')
  hidden = false
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(cue.getAttribute('data-motion')).toBe('active')
  visible(0.0005, 1)
  expect(cue.getAttribute('data-motion')).toBe('paused')
  visible(1, 0)
  expect(cue.getAttribute('data-motion')).toBe('paused')
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})

it('leaves a usable, static link when visibility observation is unavailable', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  render(<AboutHomeHero hero={hero} />)
  const cue = screen.getByRole('link', { name: '向下滚动，了解 Exre' })
  expect(cue.getAttribute('href')).toBe('#about-content')
  expect(cue.getAttribute('data-motion')).toBe('paused')
})
