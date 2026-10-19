// Run: node tests/browser/error-panel.mjs
// Real geometry and keyboard checks; fixture data does not call the runtime API.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const evidence = resolve(repository, 'output/playwright/error-panel')
await mkdir(evidence, { recursive: true })
const fixturePath = resolve(repository, 'tests/browser/error-panel-fixture.tsx').replaceAll(
  '\\',
  '/',
)
const server = await createServer({
  root: resolve(repository, 'apps/web'),
  configFile: resolve(repository, 'apps/web/vite.config.ts'),
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  plugins: [
    {
      name: 'isolated-error-panel-fixture',
      configureServer(vite) {
        vite.middlewares.use('/__error_panel.html', async (_request, response, next) => {
          try {
            const html = await vite.transformIndexHtml(
              '/__error_panel.html',
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${fixturePath}"></script></body></html>`,
            )
            response.setHeader('Content-Type', 'text/html')
            response.end(html)
          } catch (error) {
            next(error)
          }
        })
      },
    },
  ],
})
let browser
const results = []
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme,
    })
    try {
      const page = await context.newPage(),
        errors = [],
        apiRequests = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url())
      })
      await page.goto(`${origin}/__error_panel.html`)
      await page.locator('#fixture-panel').waitFor()
      const settle = async () =>
        page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all(
            document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
          )
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          )
        })
      const configure = async (patch) => {
        await page.evaluate((value) => window.configureErrorPanel(value), patch)
        await settle()
      }
      for (const width of [1440, 390])
        for (const modal of [false, true]) {
          await page.setViewportSize({ width, height: 900 })
          for (const height of [160, 240, 320])
            for (const count of [0, 1, 3, 8])
              for (const action of [false, true]) {
                await configure({ count, height, modal, action, title: true, description: true })
                const panel = page.locator('#fixture-panel')
                if (count === 0) {
                  assert.equal(await panel.count(), 0, 'Empty list leaves no panel')
                  if (!modal)
                    assert.equal(
                      (await page.locator('[data-fixture-container]').boundingBox()).height,
                      0,
                    )
                  results.push({ colorScheme, width, modal, height, count, action })
                  continue
                }
                const geometry = await panel.evaluate((element) => {
                  const list = element.querySelector('ol'),
                    footer = element.querySelector('footer'),
                    header = element.querySelector('header')
                  return {
                    height: element.getBoundingClientRect().height,
                    scrollHeight: list.scrollHeight,
                    clientHeight: list.clientHeight,
                    tabIndex: list.tabIndex,
                    listHeight: list.getBoundingClientRect().height,
                    headerY: header?.getBoundingClientRect().y,
                    footerY: footer?.getBoundingClientRect().y,
                    overflow: list.scrollWidth > list.clientWidth + 1,
                  }
                })
                assert(
                  geometry.height <= height + 1,
                  `Whole panel exceeds ${height}px: ${JSON.stringify(geometry)}`,
                )
                assert.equal(
                  await panel.locator('footer').count(),
                  Number(action),
                  'Optional footer is fully absent',
                )
                assert.equal(geometry.overflow, false, 'Long unbroken text must wrap')
                assert.equal(
                  geometry.tabIndex,
                  geometry.scrollHeight > geometry.clientHeight ? 0 : -1,
                  'Only overflow adds a tab stop',
                )
                if (count === 1)
                  assert(geometry.height < height, 'Single compact error naturally shrinks')
                const list = panel.locator('ol')
                if (geometry.scrollHeight > geometry.clientHeight) {
                  await list.focus()
                  await page.keyboard.press('End')
                  await page.waitForFunction(() => {
                    const node = document.querySelector('#fixture-panel ol')
                    return node && node.scrollTop + node.clientHeight >= node.scrollHeight - 2
                  })
                  const after = await panel.evaluate((element) => ({
                    headerY: element.querySelector('header')?.getBoundingClientRect().y,
                    footerY: element.querySelector('footer')?.getBoundingClientRect().y,
                  }))
                  assert.equal(
                    after.headerY,
                    geometry.headerY,
                    'Title stays fixed while errors scroll',
                  )
                  assert.equal(
                    after.footerY,
                    geometry.footerY,
                    'Action stays fixed while errors scroll',
                  )
                }
                results.push({ colorScheme, width, modal, height, count, action, geometry })
              }
          await configure({ count: 8, height: 240, modal, action: true })
          const panel = page.locator('#fixture-panel'),
            list = panel.locator('ol')
          const withAction = await list.evaluate((node) => node.clientHeight)
          await list.evaluate((node) => {
            node.scrollTop = 40
          })
          const before = await list.evaluate((node) => node.scrollTop)
          await page.evaluate(() => window.rerenderErrorPanel())
          await settle()
          assert.equal(
            await list.evaluate((node) => node.scrollTop),
            before,
            'Ordinary rerender preserves scroll',
          )
          await configure({ action: false })
          assert(
            (await list.evaluate((node) => node.clientHeight)) > withAction,
            'Absent action releases list height',
          )
          assert.equal(
            await list.evaluate((node) => node.scrollTop),
            before,
            'Action changes preserve scroll',
          )
          await configure({ revision: 1 })
          assert.equal(
            await list.evaluate((node) => node.scrollTop),
            0,
            'Changed errors reset list to start',
          )
          await configure({ title: false, description: false })
          assert.equal(await panel.locator('header').count(), 0, 'Missing title removes header')
          assert.equal(await panel.getAttribute('aria-label'), '错误信息')
          if (!modal) {
            const input = page.getByRole('textbox', { name: '保持输入焦点' })
            await input.focus()
            await page.keyboard.press('Tab')
            assert.equal(
              await list.evaluate((node) => node === document.activeElement),
              true,
              'Tab enters overflowing list',
            )
            await input.focus()
            await configure({ revision: 2 })
            assert.equal(
              await input.evaluate((node) => node === document.activeElement),
              true,
              'New errors never steal input focus',
            )
          }
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            'No page horizontal overflow',
          )
          await page.screenshot({
            path: resolve(evidence, `${colorScheme}-${width}-${modal ? 'modal' : 'page'}.png`),
          })
          await configure({ modal: false, revision: 0 })
        }
      assert.deepEqual(errors, [], 'No browser errors')
      assert.deepEqual(apiRequests, [], 'Isolated fixture makes no API requests')
    } finally {
      await context.close()
    }
  }
  await writeFile(
    resolve(evidence, 'results.json'),
    JSON.stringify({ status: 'PASS', results }, null, 2),
  )
  console.log(
    JSON.stringify({
      status: 'PASS',
      scenarios: results.length,
      browser: 'Chromium',
      evidence: 'isolated UI layout',
      output: 'output/playwright/error-panel',
      realRegistrationAPI: 'NOT_EXECUTED',
    }),
  )
} finally {
  await browser?.close()
  await server.close()
}
