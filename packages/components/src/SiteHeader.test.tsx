// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { SiteHeader } from '@components/src/SiteHeader'
import type { AuthAreaProps } from '@components/src/AuthArea'

function LocationPath() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function renderHeader(state: AuthAreaProps['state'], glassAtTop = false) {
  const onLogin = vi.fn()
  const onProfile = vi.fn()
  const onSettings = vi.fn()
  render(
    <MemoryRouter initialEntries={['/']}>
      <SiteHeader
        glassAtTop={glassAtTop}
        auth={{
          state,
          onLogin,
          onRegister: vi.fn(),
          onRetry: vi.fn(),
          onLogout: vi.fn(),
          onProfile,
          onSettings,
        }}
      />
      <LocationPath />
    </MemoryRouter>,
  )
  return { onLogin, onProfile, onSettings }
}

const originalSupportScroll = Element.prototype.scrollIntoView
afterEach(() => {
  cleanup()
  if (originalSupportScroll) Element.prototype.scrollIntoView = originalSupportScroll
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

const supportIdentity: AuthAreaProps['state'] = {
  status: 'authenticated',
  nickname: 'Tester',
  initial: 'T',
  avatarUrl: null,
}
function supportHeader(state: AuthAreaProps['state']) {
  return (
    <MemoryRouter initialEntries={['/support/errors/example']}>
      <SiteHeader
        auth={{
          state,
          onLogin: vi.fn(),
          onRegister: vi.fn(),
          onRetry: vi.fn(),
          onLogout: vi.fn(),
          onProfile: vi.fn(),
          onSettings: vi.fn(),
        }}
      />
      <LocationPath />
    </MemoryRouter>
  )
}
it.each([
  { status: 'anonymous' },
  { status: 'loading' },
  { status: 'unavailable', message: 'Unavailable' },
] as AuthAreaProps['state'][])(
  'hides Support until the session is confirmed: $status',
  async (state) => {
    render(supportHeader(state))
    expect(screen.queryByRole('link', { name: 'Support' })).toBeNull()
    Element.prototype.scrollIntoView = vi.fn()
    screen.getByRole('combobox', { name: '打开导航菜单' }).focus()
    await userEvent.keyboard('[Space]')
    expect(screen.queryByRole('option', { name: 'Support' })).toBeNull()
  },
)
it('uses Support for desktop and mobile descendant routes and removes it after logout', async () => {
  const view = render(supportHeader(supportIdentity))
  expect(screen.getByRole('link', { name: 'Support' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('combobox', { name: '打开导航菜单' }).textContent).toContain('Support')
  Element.prototype.scrollIntoView = vi.fn()
  screen.getByRole('combobox', { name: '打开导航菜单' }).focus()
  await userEvent.keyboard('[Space]')
  expect(screen.getByRole('option', { name: 'Support' })).toBeTruthy()
  view.rerender(supportHeader({ status: 'anonymous' }))
  expect(screen.queryByRole('option', { name: 'Support' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Support' })).toBeNull()
})
it('does not classify similarly prefixed paths as Support descendants', () => {
  render(
    <MemoryRouter initialEntries={['/support-other']}>
      <SiteHeader
        auth={{
          state: supportIdentity,
          onLogin: vi.fn(),
          onRegister: vi.fn(),
          onRetry: vi.fn(),
          onLogout: vi.fn(),
          onProfile: vi.fn(),
          onSettings: vi.fn(),
        }}
      />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'Support' }).getAttribute('aria-current')).toBeNull()
})

it('keeps About active on a detail page and uses the canonical mobile target', () => {
  render(
    <MemoryRouter initialEntries={['/aboutus/communities/example-community']}>
      <SiteHeader
        auth={{
          state: { status: 'anonymous' },
          onLogin: vi.fn(),
          onRegister: vi.fn(),
          onRetry: vi.fn(),
          onLogout: vi.fn(),
          onProfile: vi.fn(),
          onSettings: vi.fn(),
        }}
      />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'About Us' }).getAttribute('href')).toBe('/aboutus')
  expect(screen.getByRole('link', { name: 'About Us' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('combobox', { name: '打开导航菜单' }).textContent).toContain('About Us')
})

it('uses glass after scrolling and clears it when returning to the top', () => {
  vi.stubGlobal('scrollY', 0)
  try {
    renderHeader({ status: 'anonymous' })
    const header = screen.getByRole('banner')
    expect(header.classList.contains('ex-glass')).toBe(false)
    vi.stubGlobal('scrollY', 120)
    fireEvent.scroll(window)
    expect(header.classList.contains('ex-glass')).toBe(true)
    vi.stubGlobal('scrollY', 0)
    fireEvent.scroll(window)
    expect(header.classList.contains('ex-glass')).toBe(false)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('uses glass immediately when mounted on an already scrolled page', () => {
  vi.stubGlobal('scrollY', 120)
  try {
    renderHeader({ status: 'anonymous' })
    expect(screen.getByRole('banner').classList.contains('ex-glass')).toBe(true)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('keeps glass at the top when the page requests it', () => {
  vi.stubGlobal('scrollY', 0)
  try {
    renderHeader({ status: 'anonymous' }, true)
    const header = screen.getByRole('banner')
    expect(header.classList.contains('ex-glass')).toBe(true)
    vi.stubGlobal('scrollY', 120)
    fireEvent.scroll(window)
    vi.stubGlobal('scrollY', 0)
    fireEvent.scroll(window)
    expect(header.classList.contains('ex-glass')).toBe(true)
  } finally {
    vi.unstubAllGlobals()
  }
})

describe('SiteHeader Communities menu', () => {
  it('opens both community routes from the desktop dropdown', async () => {
    renderHeader({ status: 'anonymous' })

    await userEvent.hover(screen.getByRole('button', { name: 'Communities' }))
    expect((await screen.findByRole('link', { name: 'Rifling 911' })).getAttribute('href')).toBe(
      '/communities/rifling-911',
    )
    expect(screen.getByRole('link', { name: 'CAEP' }).getAttribute('href')).toBe(
      '/communities/caep',
    )

    await userEvent.click(screen.getByRole('link', { name: 'Rifling 911' }))
    expect(screen.getByTestId('path').textContent).toBe('/communities/rifling-911')
  })
})

describe('SiteHeader primary navigation', () => {
  it('opens Products and omits the retired Join menu', async () => {
    renderHeader({ status: 'anonymous' })

    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Gallery' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Products' }).getAttribute('href')).toBe('/products')

    await userEvent.click(screen.getByRole('link', { name: 'Products' }))
    expect(screen.getByTestId('path').textContent).toBe('/products')
  })
})

it('opens Document inside the Website router on desktop', async () => {
  renderHeader({ status: 'anonymous' })
  const link = screen.getByRole('link', { name: 'Document' })
  expect(link.tagName).toBe('A')
  expect(link.getAttribute('href')).toBe('/docs/')
  await userEvent.click(link)
  expect(screen.getByTestId('path').textContent).toBe('/docs/')
})

describe('SiteHeader mobile navigation', () => {
  it('opens a Select with the existing navigation targets and navigates within the router', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    try {
      renderHeader({ status: 'anonymous' })
      const trigger = screen.getByRole('combobox', { name: '打开导航菜单' })
      trigger.focus()
      await userEvent.keyboard('[Space]')
      expect(screen.getByRole('option', { name: 'Rifling 911' })).toBeTruthy()
      expect(screen.getByRole('option', { name: 'CAEP' })).toBeTruthy()
      expect(screen.getByRole('option', { name: 'Products' })).toBeTruthy()
      expect(screen.getByRole('option', { name: 'Document' })).toBeTruthy()
      expect(screen.queryByRole('option', { name: 'Join' })).toBeNull()
      expect(screen.queryByRole('option', { name: '登录' })).toBeNull()
      await userEvent.click(screen.getByRole('option', { name: 'CAEP' }))
      expect(screen.getByTestId('path').textContent).toBe('/communities/caep')
    } finally {
      if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })

  it('opens Document inside the Website router on mobile', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    try {
      renderHeader({ status: 'anonymous' })
      const trigger = screen.getByRole('combobox', { name: '打开导航菜单' })
      trigger.focus()
      await userEvent.keyboard('[Space]')
      await userEvent.click(screen.getByRole('option', { name: 'Document' }))
      expect(screen.getByTestId('path').textContent).toBe('/docs/')
    } finally {
      if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })

  it('opens account actions from the separate right-hand Select', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    try {
      const { onLogin } = renderHeader({ status: 'anonymous' })
      const trigger = screen.getByRole('combobox', { name: '用户菜单' })
      trigger.focus()
      await userEvent.keyboard('[Space]')
      expect(screen.queryByRole('option', { name: 'Products' })).toBeNull()
      await userEvent.click(screen.getByRole('option', { name: '登录' }))
      expect(onLogin).toHaveBeenCalledOnce()
    } finally {
      if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })

  it('shows the avatar and personal actions in the mobile account Select', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    try {
      const { onProfile, onSettings } = renderHeader({
        status: 'authenticated',
        nickname: 'Alice',
        initial: 'A',
        avatarUrl: '/avatar.png',
      })
      const trigger = screen.getByRole('combobox', { name: '用户菜单' })
      expect(trigger.querySelector('[data-slot="avatar"]')).toBeTruthy()
      trigger.focus()
      await userEvent.keyboard('[Space]')
      expect(screen.getByRole('option', { name: '个人资料' })).toBeTruthy()
      expect(screen.getByRole('option', { name: '设置' })).toBeTruthy()
      expect(screen.getByRole('option', { name: '退出登录' })).toBeTruthy()
      await userEvent.click(screen.getByRole('option', { name: '个人资料' }))
      expect(onProfile).toHaveBeenCalledOnce()
      expect(onSettings).not.toHaveBeenCalled()
    } finally {
      if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })
})
