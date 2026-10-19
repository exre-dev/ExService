// Run: node tests/browser/exui-v1-history-probe.mjs
// Read-only comparison of the About history path on current source and HEAD/ExUI 0.8.
// Exit 0 means evidence was recorded; individual variant status may still be FAIL.
import { execFileSync } from 'node:child_process'
import { access, mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const output = resolve(repository, 'output/playwright/exui-v1-history-probe')
await mkdir(output, { recursive: true })
const installed = (await readdir(resolve(repository, 'node_modules/.pnpm'))).filter((name) =>
  name.startsWith('@exre+exui@0.8.0_'),
)
if (installed.length !== 1)
  throw new Error(`Expected one cached ExUI 0.8.0 package, found ${installed.length}`)
const oldPackage = resolve(
  repository,
  'node_modules/.pnpm',
  installed[0],
  'node_modules/@exre/exui',
)
await access(resolve(oldPackage, 'dist/exui.js'))
await access(resolve(oldPackage, 'dist/index.css'))
const trackedChanges = execFileSync(
  'git',
  [
    'diff',
    'HEAD',
    '--name-only',
    '--diff-filter=M',
    '--',
    'apps/web/src',
    'packages/components/src',
  ],
  { cwd: repository, encoding: 'utf8' },
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
const headSources = new Map(
  trackedChanges.map((path) => [
    resolve(repository, path).replaceAll('\\', '/'),
    execFileSync('git', ['show', `HEAD:${path}`], { cwd: repository, encoding: 'utf8' }),
  ]),
)
const results = []
const variants = process.argv.includes('--repeat-fast')
  ? [1, 2, 3].flatMap((index) => [`current-fast-${index}`, `head-exui-0.8-fast-${index}`])
  : [
      'current-fast',
      'current-team-ready',
      'head-exui-0.8-fast',
      'head-exui-0.8-team-ready',
      'current-team-settled',
      'head-exui-0.8-team-settled',
    ]
for (const variant of variants) {
  if (process.argv.includes('--settled-only') && !variant.endsWith('team-settled')) continue
  const baseline = variant.startsWith('head-')
  const awaitTeamReady = variant.endsWith('team-ready')
  const awaitTeamSettled = variant.endsWith('team-settled')
  const server = await createServer({
    root: resolve(repository, 'apps/web'),
    configFile: resolve(repository, 'apps/web/vite.config.ts'),
    cacheDir: resolve(output, '.vite-cache', variant),
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    plugins: baseline
      ? [
          {
            name: 'head-and-exui-0.8-probe',
            enforce: 'pre',
            resolveId(id) {
              if (id === '@exre/exui') return `${oldPackage}/dist/exui.js`
              if (id === '@exre/exui/style.css') return `${oldPackage}/dist/index.css`
            },
            load(id) {
              return headSources.get(id.replaceAll('\\', '/').split('?')[0]) ?? null
            },
          },
        ]
      : [],
  })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({ headless: true })
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage(),
      errors = [],
      scrollEvents = [],
      exuiRequests = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => {
      if (request.url().includes('exui')) exuiRequests.push(request.url())
    })
    page.on('console', (message) => {
      if (message.type() === 'error')
        scrollEvents.push({ consoleError: message.text().slice(0, 180) })
    })
    await page.addInitScript(() => {
      window.__historyProbe = []
      const record = (type) =>
        window.__historyProbe.push({
          type,
          y: scrollY,
          path: location.pathname,
          rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
          at: performance.now(),
        })
      document.addEventListener(
        'click',
        (event) => {
          if (event.target.closest('a[href="/aboutus/team"]')) record('team-click')
        },
        true,
      )
      window.addEventListener('popstate', () => record('popstate'))
      window.addEventListener('scroll', () => record('scroll'), { passive: true })
    })
    await page.route('**/*', (route) =>
      new URL(route.request().url()).pathname.startsWith('/api/')
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{"error":"offline"}',
          })
        : route.continue(),
    )
    try {
      await page.goto(`${origin}/aboutus`)
      await page.getByText('持续整理中的介绍', { exact: true }).waitFor({ timeout: 15000 })
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        for (const theme of ['light', 'dark'])
          await page.evaluate((theme) => {
            document.documentElement.classList.remove('light', 'dark')
            document.documentElement.classList.add(theme)
          }, theme)
      }
      await page.setViewportSize({ width: 1440, height: 900 })
      const longCopyOverflow = await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px'
        const heading = document.querySelector('main h1')
        heading.dataset.original = heading.textContent
        heading.textContent =
          '因为相遇，所以创造。让每一个正在发生的想法，都拥有更多可以分享的可能。'.repeat(3)
        return document.documentElement.scrollWidth - innerWidth
      })
      await page.evaluate(() => {
        document.documentElement.style.fontSize = ''
        const heading = document.querySelector('main h1')
        heading.textContent = heading.dataset.original
      })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      const team = page.locator('#about-content a[href="/aboutus/team"]')
      await team.scrollIntoViewIfNeeded()
      const savedY = await page.evaluate(() => scrollY)
      await team.click()
      await page.getByRole('navigation', { name: 'About 栏目' }).waitFor()
      if (awaitTeamReady) await page.locator('#team-heading').waitFor({ state: 'visible' })
      if (awaitTeamSettled)
        await page.waitForFunction(() => location.pathname === '/aboutus/team' && scrollY === 0)
      await page.goBack()
      await page.getByText('持续整理中的介绍', { exact: true }).waitFor()
      const restored = await page
        .waitForFunction((expected) => Math.abs(scrollY - expected) <= 2, savedY, { timeout: 5000 })
        .then(
          () => true,
          () => false,
        )
      const state = await page.evaluate(() => ({
        scrollY,
        scrollMax: document.documentElement.scrollHeight - innerHeight,
        events: window.__historyProbe,
        rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
        restoration: history.scrollRestoration,
      }))
      if (
        baseline &&
        (!exuiRequests.some((url) => url.includes('exui@0.8.0') && url.endsWith('/dist/exui.js')) ||
          !exuiRequests.some(
            (url) => url.includes('exui@0.8.0') && url.endsWith('/dist/index.css'),
          ) ||
          exuiRequests.some((url) => url.includes('exui@1.0.0')))
      ) {
        throw new Error(`ExUI 0.8 JS/CSS alias was not active: ${JSON.stringify(exuiRequests)}`)
      }
      await page.screenshot({ path: resolve(output, `${variant}.png`) })
      results.push({
        variant,
        status: restored ? 'PASS' : 'FAIL',
        savedY,
        longCopyOverflow,
        state,
        pageErrors: errors,
        consoleErrors: scrollEvents,
        exuiRequests,
      })
    } catch (error) {
      results.push({
        variant,
        status: 'ERROR',
        error: String(error?.stack ?? error),
        pageErrors: errors,
        consoleErrors: scrollEvents,
        exuiRequests,
        body: await page
          .locator('body')
          .innerText()
          .catch(() => ''),
      })
    } finally {
      await context.close()
    }
  } finally {
    await browser?.close()
    await server.close()
  }
}
await writeFile(
  resolve(
    output,
    process.argv.includes('--repeat-fast') ? 'repeat-fast-results.json' : 'results.json',
  ),
  JSON.stringify(
    {
      variants: results,
      headOverlayPaths: [...headSources.keys()].map((path) =>
        path.slice(repository.replaceAll('\\', '/').length + 1),
      ),
    },
    null,
    2,
  ),
)
console.log(
  JSON.stringify({
    variants: results.map(({ variant, status, savedY, state, error }) => ({
      variant,
      status,
      savedY,
      scrollY: state?.scrollY,
      error,
    })),
    output: 'output/playwright/exui-v1-history-probe',
  }),
)
