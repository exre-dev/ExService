// Isolated failures for browser geometry, keyboard and clipboard checks; no runtime API.
import { useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '@exre/exui'
import '@exre/exui/style.css'
import '@web/src/styles/website-theme.css'
import { AsyncBoundary } from '@components/src/AsyncBoundary'
import { PageAsyncBoundary } from '@web/src/routes/PageAsyncBoundary'

const params = new URLSearchParams(location.search)
const mode = params.get('mode') ?? 'load'
const layout = params.get('layout') ?? 'page'
const failure = new Error('Browser fixture failure <script>text only</script>')
failure.stack = `${failure.name}: ${failure.message}\n${'    at loadContent (fixture.tsx:12:3)\n'.repeat(80)}    at finalFrame`

function Content({ broken }: { broken: boolean }) {
  if (broken) throw failure
  return (
    <main>
      <h1>内容已恢复</h1>
    </main>
  )
}
function Fixture() {
  const attempts = useRef(0)
  const broken = useRef(true)
  const loader = async () => {
    await new Promise((resolve) => setTimeout(resolve, 40))
    if (++attempts.current === 1) throw failure
    return '内容已恢复'
  }
  const props =
    mode === 'pending'
      ? { loading: true }
      : mode === 'render'
        ? {
            onRetry: () => {
              broken.current = false
            },
            children: <Content broken={broken.current} />,
          }
        : {
            loader,
            children: (data: string) => (
              <main>
                <h1>{data}</h1>
              </main>
            ),
          }
  // Render errors need a descendant that reads the ref again on the fresh retry mount.
  function RenderContent() {
    return <Content broken={broken.current} />
  }
  const effectiveProps = mode === 'render' ? { ...props, children: <RenderContent /> } : props
  return (
    <>
      {layout !== 'standalone' && (
        <header
          data-fixture-header
          style={{ height: 64, display: 'flex', alignItems: 'center', paddingInline: 24 }}
        >
          Exre Service · AsyncBoundary
        </header>
      )}
      {layout === 'section' ? (
        <div style={{ maxWidth: 900, margin: '40px auto' }}>
          <AsyncBoundary {...effectiveProps} homeUrl="/" />
        </div>
      ) : (
        <PageAsyncBoundary
          {...effectiveProps}
          pageLayout={layout === 'standalone' ? 'standalone' : 'site'}
          homeUrl="/"
        />
      )}
    </>
  )
}
document.documentElement.style.colorScheme = matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light'
document.body.style.margin = '0'
document.documentElement.classList.add('website-theme-profile')
document.documentElement.style.setProperty('--site-header-height', '64px')
createRoot(document.getElementById('root')!, { onCaughtError: () => {} }).render(
  <ThemeProvider defaultTheme="system">
    <MemoryRouter>
      <Fixture />
    </MemoryRouter>
  </ThemeProvider>,
)
