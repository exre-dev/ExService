import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@workspace/components', () => ({
  SiteHeader: ({ glassAtTop }: { glassAtTop?: boolean }) => (
    <header data-glass-at-top={String(Boolean(glassAtTop))}>Site header</header>
  ),
}))

vi.mock('@web/src/pages/Home', () => ({
  Home: () => <main>Home</main>,
}))
vi.mock('@web/src/pages/AuthPage/AuthBackdrop', () => ({ AuthBackdrop: () => null }))

vi.mock('@web/src/pages/NotFound', () => ({
  NotFound: () => <main>Page not found</main>,
}))

vi.mock('@web/src/pages/JoinPage/Rifling-911', () => ({
  JoinPage: () => <main>Rifling 911 join</main>,
}))
vi.mock('@web/src/pages/JoinPage/CAEP', () => ({
  CAEPJoinPage: () => <main>CAEP join placeholder</main>,
}))

import { App } from '@web/src/App'

describe('App', () => {
  it.each(['/docs', '/docs/'])(
    'serves the public construction page at %s within the site layout',
    (path) => {
      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )
      expect(markup).toContain('Site header')
      expect(markup).toContain('文档建设中')
      expect(markup).toContain('href="/"')
      expect(markup).not.toContain('Page not found')
    },
  )
  it.each(['/docs/doc/old-document', '/docs/collection/old', '/docs/search', '/identity/status'])(
    'keeps retired path %s on the existing 404',
    (path) => {
      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )
      expect(markup).toContain('Page not found')
      expect(markup).not.toContain('文档建设中')
    },
  )
  it.each(['login', 'consent', 'logout'])('keeps the %s identity entrance registered', (phase) => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/identity/' + phase]}>
        <App />
      </MemoryRouter>,
    )
    expect(markup).toContain('身份入口无效')
    expect(markup).not.toContain('Page not found')
  })
  it.each(['/support', '/support/errors', '/support/errors/example', '/support/unknown'])(
    'checks authentication before mounting any Support route: %s',
    (path) => {
      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )
      expect(markup).toContain('正在确认登录状态')
      expect(markup).toContain('Site header')
      expect(markup).not.toContain('Page not found')
      expect(markup).not.toContain('<iframe')
    },
  )
  it('serves both community routes inside the site layout', () => {
    const rifling = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/communities/rifling-911']}>
        <App />
      </MemoryRouter>,
    )
    const caep = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/communities/caep']}>
        <App />
      </MemoryRouter>,
    )
    expect(rifling).toContain('Site header')
    expect(rifling).toContain('Rifling 911 join')
    expect(caep).toContain('Site header')
    expect(caep).toContain('CAEP join placeholder')
  })
  it('keeps the retired Join route on the existing 404', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/join/rifling-911']}>
        <App />
      </MemoryRouter>,
    )
    expect(markup).toContain('Page not found')
    expect(markup).not.toContain('Rifling 911 join')
  })
  it('does not serve CAEP at the Join route', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/join/caep']}>
        <App />
      </MemoryRouter>,
    )
    expect(markup).toContain('Site header')
    expect(markup).toContain('Page not found')
  })
  it('does not serve the join page at the former route', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/join']}>
        <App />
      </MemoryRouter>,
    )
    expect(markup).toContain('Page not found')
  })
  it.each(['/join/result', '/admin/join-applications'])(
    'keeps the retired application page %s on the existing 404',
    (path) => {
      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )
      expect(markup).toContain('Site header')
      expect(markup).toContain('Page not found')
    },
  )
  it('keeps the site header around an unmatched route', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/not-found']}>
        <App />
      </MemoryRouter>,
    )

    expect(markup).toContain('<header')
    expect(markup).toContain('data-glass-at-top="true"')
    expect(markup).toContain('Page not found')
  })

  it('keeps the ordinary top-of-page header behavior on a matched route', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(markup).toContain('data-glass-at-top="false"')
  })
})
