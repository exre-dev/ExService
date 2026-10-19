// Run: node tests/browser/exui-v1-existing-regressions.mjs
// Executes the existing browser acceptance functions against local Vite and Chromium.
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'
import { assertNavbarGeometry, assertNavbarModalGeometry } from './navbar-geometry.mjs'
import { runBrowserSuite } from './browser-suite.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const output = resolve(repository, 'output/playwright/exui-v1-existing-regressions')
const results = []
const outcome = await runBrowserSuite({
  repository,
  output,
  results,
  run: async ({ browser, origin }) => {
    for (const [name, run] of [
      [
        'navbar geometry',
        async (page) =>
          assertNavbarGeometry({ goto: (url) => page.goto(url), playwright: page }, origin),
      ],
      [
        'navbar modal geometry',
        async (page) =>
          assertNavbarModalGeometry({ goto: (url) => page.goto(url), playwright: page }, origin),
      ],
      ...['about-home-refined', 'about-home-failures', 'about-donations'].map((name) => [
        name,
        async (page) => {
          const source = await readFile(resolve(repository, `tests/browser/${name}.mjs`), 'utf8')
          return runInThisContext(source, { filename: `${name}.mjs` })(page)
        },
      ]),
    ]) {
      if (process.argv.includes('--about-home-refined-only') && name !== 'about-home-refined')
        continue
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage(),
        errors = []
      page.on('pageerror', (error) => errors.push(error.message))
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
        await page.goto(origin)
        const detail = await run(page)
        await page.screenshot({ path: resolve(output, `${name.replaceAll(' ', '-')}.png`) })
        if (errors.length) throw new Error(`Page errors: ${JSON.stringify(errors)}`)
        results.push({ name, status: 'PASS', detail })
      } catch (error) {
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          url: location.href,
          scrollY,
          scrollMax: document.documentElement.scrollHeight - innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
          overflowing: Array.from(document.querySelectorAll('body *'))
            .map((element) => ({
              tag: element.tagName,
              className:
                typeof element.className === 'string' ? element.className.slice(0, 100) : '',
              text: element.textContent?.slice(0, 50),
              right: element.getBoundingClientRect().right,
            }))
            .filter((row) => row.right > innerWidth + 1)
            .slice(0, 12),
        }))
        await page.screenshot({
          path: resolve(output, `${name.replaceAll(' ', '-')}-failure.png`),
          fullPage: true,
        })
        if (name === 'about-home-refined' && geometry.rootPx === 32) {
          geometry.originalCopy = await page.evaluate(() => {
            const heading = document.querySelector('main h1')
            if (heading?.dataset.original) heading.textContent = heading.dataset.original
            return {
              width: innerWidth,
              scrollWidth: document.documentElement.scrollWidth,
              rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
              heading: heading?.textContent?.slice(0, 100),
              register: document.querySelector('button')?.getBoundingClientRect().toJSON(),
            }
          })
          await page.screenshot({
            path: resolve(output, `${name}-original-copy-root32.png`),
            fullPage: true,
          })
        }
        results.push({ name, status: 'FAIL', error: String(error?.stack ?? error), geometry })
        console.error(`${name}: ${error?.stack ?? error}`)
      } finally {
        await context.close()
      }
    }
  },
  report: ({ status, browser, results, failures }) => ({ status, browser, results, failures }),
  summary: ({ status, results, failures }) => ({
    status,
    results: results.map(({ name, status }) => ({ name, status })),
    failures,
    output: 'output/playwright/exui-v1-existing-regressions',
  }),
})
if (outcome.status === 'FAIL') process.exitCode = 1
