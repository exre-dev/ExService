// Run: node tests/browser/async-boundary.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const evidence = resolve(repository, 'output/playwright/async-boundary')
await mkdir(evidence, { recursive: true })
const fixturePath = resolve(repository, 'tests/browser/async-boundary-fixture.tsx').replaceAll(
  '\\',
  '/',
)
const server = await createServer({
  root: resolve(repository, 'apps/web'),
  configFile: resolve(repository, 'apps/web/vite.config.ts'),
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  plugins: [
    {
      name: 'isolated-async-boundary-fixture',
      configureServer(vite) {
        vite.middlewares.use('/__async_boundary.html', async (_request, response, next) => {
          try {
            const html = await vite.transformIndexHtml(
              '/__async_boundary.html',
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
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    try {
      const page = await context.newPage()
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        for (const layout of ['page', 'section', 'standalone']) {
          await page.goto(`${origin}/__async_boundary.html?layout=${layout}`)
          const heading = page.getByRole('heading', { name: '内容暂时无法加载' })
          await heading.waitFor()
          if (layout !== 'section') {
            const center = await heading.evaluate((node) => {
              const rect = node.closest('section').getBoundingClientRect()
              const header =
                document.querySelector('[data-fixture-header]')?.getBoundingClientRect().height ?? 0
              return {
                actual: rect.y + rect.height / 2,
                expected: header + (innerHeight - header) / 2,
              }
            })
            assert(
              Math.abs(center.actual - center.expected) < 2,
              `Page centers below header: ${JSON.stringify(center)}`,
            )
          }
          const disclosure = page.getByRole('link', { name: '查看错误' })
          await disclosure.focus()
          await page.keyboard.press('Enter')
          assert.equal(await page.getByRole('dialog').count(), 0)
          const panel = page.getByRole('region', { name: '错误详情', exact: true })
          const body = page.getByRole('region', { name: '可滚动的错误详情' })
          const geometry = await panel.evaluate((node) => {
            const body = node.querySelector('[tabindex]')
            return {
              height: node.getBoundingClientRect().height,
              width: node.getBoundingClientRect().width,
              bodyWidth: body.getBoundingClientRect().width,
              alignItems: getComputedStyle(node).alignItems,
              scrollHeight: body.scrollHeight,
              clientHeight: body.clientHeight,
              headerY: node.querySelector('header').getBoundingClientRect().y,
              horizontal: body.scrollWidth > body.clientWidth + 1,
            }
          })
          assert(geometry.height <= 240.5 && geometry.scrollHeight > geometry.clientHeight)
          assert(
            geometry.bodyWidth >= geometry.width - 3,
            `Detail body should fill panel: ${JSON.stringify(geometry)}`,
          )
          assert.equal(geometry.horizontal, false)
          await body.focus()
          await page.keyboard.press('End')
          await page.waitForFunction(() => {
            const n = document.querySelector('[aria-label="可滚动的错误详情"]')
            return n.scrollTop + n.clientHeight >= n.scrollHeight - 2
          })
          assert.equal(
            await panel.locator('header').evaluate((node) => node.getBoundingClientRect().y),
            geometry.headerY,
          )
          const copy = page.getByRole('button', { name: '复制完整错误信息' })
          await copy.click()
          await page.getByText('已复制', { exact: true }).waitFor()
          const copied = await page.evaluate(() => navigator.clipboard.readText())
          assert(copied.includes('finalFrame') && copied.includes('<script>text only</script>'))
          assert.equal(
            await copy.evaluate((node) => node === document.activeElement),
            true,
            'Copy retains keyboard focus',
          )
          const home = page.getByRole('link', { name: '返回首页' })
          assert.equal(
            await home.evaluate((node) => node.previousElementSibling?.textContent),
            '重试',
          )
          assert.equal(await home.getAttribute('data-variant'), 'outline')
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
            false,
          )
          await page.screenshot({
            path: resolve(evidence, `${colorScheme}-${width}-${layout}.png`),
          })
          await page.getByRole('link', { name: '收起错误' }).click()
          assert.equal(await panel.count(), 0)
          await page.getByRole('button', { name: '重试', exact: true }).click()
          await page.getByRole('heading', { name: '内容已恢复' }).waitFor()
          results.push({ colorScheme, width, layout, geometry, copiedLength: copied.length })
        }
      }
      await page.goto(`${origin}/__async_boundary.html?mode=render`)
      await page.getByRole('heading', { name: '这部分内容暂时无法显示' }).waitFor()
      await page.getByRole('link', { name: '查看错误' }).click()
      assert(
        (await page.getByRole('region', { name: '可滚动的错误详情' }).textContent()).includes(
          'React 组件堆栈',
        ),
      )
      await page.getByRole('button', { name: '重试', exact: true }).click()
      await page.getByRole('heading', { name: '内容已恢复' }).waitFor()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`${origin}/__async_boundary.html?mode=pending`)
      await page.getByRole('status', { name: '正在加载…' }).waitFor()
      assert.equal(
        await page
          .locator('[role="status"] svg')
          .evaluate((node) => getComputedStyle(node).animationName),
        'none',
      )
    } finally {
      await context.close()
    }
  }

  // Exercise the real App, not only the fixture: blocked native route import -> retry/reload.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const page = await context.newPage()
    const chunk = '**/src/pages/AboutUs/AboutUs.tsx*'
    await page.route(chunk, (route) => route.abort())
    await page.goto(`${origin}/aboutus`)
    await page.getByRole('heading', { name: '内容暂时无法加载' }).waitFor()
    await page.getByRole('link', { name: '查看错误' }).click()
    assert(
      (await page.getByRole('region', { name: '可滚动的错误详情' }).textContent()).includes(
        'AboutUs',
      ),
    )
    await page.screenshot({ path: resolve(evidence, 'website-about-import-failure.png') })
    await page.unroute(chunk)
    await page.getByRole('button', { name: '重试', exact: true }).click()
    try {
      await page.getByRole('heading', { name: /因为相遇/ }).waitFor({ timeout: 15000 })
    } catch (error) {
      await page.screenshot({ path: resolve(evidence, 'website-recovery-unexpected.png') })
      console.log(await page.locator('main').innerText())
      throw error
    }
    assert.equal(new URL(page.url()).pathname, '/aboutus')
    await page.screenshot({ path: resolve(evidence, 'website-about-recovered.png') })
    let supportImports = 0
    page.on('request', (request) => {
      if (request.url().includes('/src/pages/Support/SupportRoutes.tsx')) supportImports++
    })
    await page.goto(`${origin}/support`)
    await page.getByText('登录后可访问支持中心', { exact: true }).waitFor()
    assert.equal(supportImports, 0, 'Anonymous Support never imports its route module')
    results.push({
      actualApp: 'About native import failure/reload recovery and anonymous Support gating',
    })
  } finally {
    await context.close()
  }
  await writeFile(
    resolve(evidence, 'results.json'),
    JSON.stringify({ status: 'PASS', results }, null, 2),
  )
  console.log(
    JSON.stringify({
      status: 'PASS',
      scenarios: results.length,
      evidence: 'output/playwright/async-boundary',
    }),
  )
} finally {
  await browser?.close()
  await server.close()
}
