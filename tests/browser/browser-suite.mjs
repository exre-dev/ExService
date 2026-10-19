import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

function fixturePlugin({ name, route, path }) {
  return {
    name,
    configureServer(vite) {
      vite.middlewares.use(route, async (_request, response, next) => {
        try {
          const html = await vite.transformIndexHtml(
            route,
            `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/@fs/${path}"></script></body></html>`,
          )
          response.setHeader('Content-Type', 'text/html')
          response.end(html)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

function serverOptions(repository, fixture) {
  return {
    root: resolve(repository, 'apps/web'),
    configFile: resolve(repository, 'apps/web/vite.config.ts'),
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    ...(fixture ? { plugins: [fixturePlugin(fixture)] } : {}),
  }
}

function failure(stage, error) {
  return { stage, error: String(error?.stack ?? error) }
}

/** Owns the server, browser, final report, and one verdict for browser acceptance scripts. */
export async function runBrowserSuite(
  { repository, output, fixture, results = [], run, report, summary },
  dependencies = {},
) {
  const create = dependencies.createServer ?? createServer
  const launch = dependencies.launchBrowser ?? (() => chromium.launch({ headless: true }))
  const writeReport = dependencies.writeReport ?? writeFile
  const logSummary = dependencies.logSummary ?? ((value) => console.log(JSON.stringify(value)))
  const failures = []
  const reportPath = resolve(output, 'results.json')
  let server,
    browser,
    stage = 'evidence setup'
  try {
    await mkdir(output, { recursive: true })
    // A failed run must not leave a previous PASS report in the evidence directory.
    await rm(reportPath, { force: true })
    stage = 'server creation'
    server = await create(serverOptions(repository, fixture))
    stage = 'server listen'
    await server.listen()
    stage = 'browser launch'
    browser = await launch()
    stage = 'scenarios'
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`
    await run({ browser, origin, results })
  } catch (error) {
    failures.push(failure(stage, error))
  } finally {
    // Each owned resource is attempted even when the other close throws.
    if (browser)
      try {
        await browser.close()
      } catch (error) {
        failures.push(failure('browser close', error))
      }
    if (server)
      try {
        await server.close()
      } catch (error) {
        failures.push(failure('server close', error))
      }
  }
  if (results.length === 0) failures.push({ stage: 'selection', error: 'No scenarios ran' })
  const outcome = {
    browser: 'Chromium',
    results,
    failures,
    status:
      failures.length === 0 && results.every((result) => result.status !== 'FAIL')
        ? 'PASS'
        : 'FAIL',
  }
  try {
    await writeReport(reportPath, JSON.stringify(report?.(outcome) ?? outcome, null, 2))
  } catch (error) {
    failures.push(failure('result report', error))
    outcome.status = 'FAIL'
    try {
      await rm(reportPath, { force: true })
    } catch (cleanupError) {
      failures.push(failure('report invalidation', cleanupError))
    }
  }
  logSummary(summary?.(outcome) ?? outcome)
  return outcome
}
