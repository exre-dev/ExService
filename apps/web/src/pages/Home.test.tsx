// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthArea } from '@components/src/AuthArea'
import { Home } from '@web/src/pages/Home'

vi.mock('@paper-design/shaders-react', () => ({
  LiquidMetal: ({
    width,
    height,
    image,
    colorTint,
    colorBack,
  }: {
    width: number
    height: number
    image: string
    colorTint: string
    colorBack: string
  }) => (
    <div
      style={{ width, height }}
      data-image={image}
      data-color-tint={colorTint}
      data-color-back={colorBack}
    />
  ),
}))

describe('Home', () => {
  it('renders the LiquidMetal ExIcon with an action card', () => {
    const markup = renderToStaticMarkup(<Home />)

    expect(markup).toContain('style="width:1280px;height:720px"')
    expect(markup).toContain('data-image="/ExIcon.svg"')
    expect(markup).toContain('data-color-back="#000000"')
    expect(markup).toContain('data-slot="card"')
    expect(markup).toContain('ex-glass')
    expect(markup).toContain('data-slot="action-button"')
    expect(markup).toContain('data-size="lg"')
    expect(markup).toContain('FiveM打开')
    expect(markup).toContain('玩家社区')
  })

  it('renders login and register as separate buttons', () => {
    const markup = renderToStaticMarkup(
      <AuthArea
        state={{ status: 'anonymous' }}
        onLogin={() => undefined}
        onRegister={() => undefined}
        onRetry={() => undefined}
        onLogout={() => undefined}
        onProfile={() => undefined}
        onSettings={() => undefined}
      />,
    )

    expect(markup).not.toContain('data-slot="button-group"')
    expect(markup).toContain('data-slot="action-button"')
  })
})
