import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runBrowserSuite } from './browser-suite.mjs'

async function exercise(options = {}) {
  const output = await mkdtemp(join(tmpdir(), 'exwebsite-browser-suite-'))
  const calls = []
  const summaries = []
  const server = {
    httpServer: { address: () => ({ port: 43210 }) },
    listen: async () => {
      calls.push('listen')
      if (options.failListen) throw Error('listen failed')
    },
    close: async () => {
      calls.push('server close')
      if (options.failServerClose) throw Error('server close failed')
    },
  }
  const browser = {
    close: async () => {
      calls.push('browser close')
      if (options.failBrowserClose) throw Error('browser close failed')
    },
  }
  try {
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify({ status: 'PASS', previousRun: true }),
    )
    const outcome = await runBrowserSuite(
      {
        repository: output,
        output,
        run: async ({ results }) => {
          calls.push('run')
          if (options.failRun) throw Error('scenario failed')
          if (!options.empty) results.push({ name: 'one scenario', status: 'PASS' })
        },
      },
      {
        createServer: async () => {
          calls.push('create server')
          if (options.failCreate) throw Error('create failed')
          return server
        },
        launchBrowser: async () => {
          calls.push('launch browser')
          if (options.failLaunch) throw Error('launch failed')
          return browser
        },
        writeReport: async (path, data) => {
          calls.push('write report')
          if (options.failReport) throw Error('report failed')
          await writeFile(path, data)
          if (options.failAfterReport) throw Error('report failed after writing')
        },
        logSummary: (summary) => {
          calls.push('summary')
          summaries.push(summary)
        },
      },
    )
    const report = await readFile(join(output, 'results.json'), 'utf8').then(
      JSON.parse,
      (error) => {
        if (error.code === 'ENOENT') return null
        throw error
      },
    )
    return { outcome, report, summaries, calls }
  } finally {
    await rm(output, { recursive: true, force: true })
  }
}

test('browser launch failure closes the Vite server and reports FAIL', async () => {
  const { outcome, report, summaries, calls } = await exercise({ failLaunch: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report.status, 'FAIL')
  assert.equal(summaries[0].status, 'FAIL')
  assert.equal(report.failures[0].stage, 'browser launch')
  assert.deepEqual(calls, [
    'create server',
    'listen',
    'launch browser',
    'server close',
    'write report',
    'summary',
  ])
})

test('empty scenario selection cannot report PASS', async () => {
  const { outcome, report, summaries } = await exercise({ empty: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report.status, 'FAIL')
  assert.equal(summaries[0].status, 'FAIL')
})

test('scenario failure closes owned resources before reporting FAIL', async () => {
  const { outcome, report, calls } = await exercise({ failRun: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report.status, 'FAIL')
  assert(calls.indexOf('browser close') < calls.indexOf('write report'))
  assert(calls.indexOf('server close') < calls.indexOf('write report'))
})

test('cleanup failure reaches report and summary after the other resource closes', async () => {
  const { outcome, report, summaries, calls } = await exercise({ failBrowserClose: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report.status, 'FAIL')
  assert.equal(summaries[0].status, 'FAIL')
  assert(calls.indexOf('server close') < calls.indexOf('write report'))
})

test('report failure still leaves both resources closed and cannot report PASS', async () => {
  const { outcome, report, summaries, calls } = await exercise({ failReport: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report, null, 'previous PASS evidence is invalidated')
  assert.equal(summaries[0].status, 'FAIL')
  assert(calls.indexOf('browser close') < calls.indexOf('write report'))
  assert(calls.indexOf('server close') < calls.indexOf('write report'))
})

test('a report writer that fails after writing cannot leave PASS evidence', async () => {
  const { outcome, report, summaries } = await exercise({ failAfterReport: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report, null)
  assert.equal(summaries[0].status, 'FAIL')
})

test('completed scenarios share one PASS verdict after both resources close', async () => {
  const { outcome, report, summaries, calls } = await exercise()
  assert.equal(outcome.status, 'PASS')
  assert.deepEqual(report, outcome)
  assert.deepEqual(summaries, [outcome])
  assert(calls.indexOf('server close') < calls.indexOf('write report'))
})

test('server creation failure reports FAIL without launching Chromium', async () => {
  const { outcome, report, calls } = await exercise({ failCreate: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report.failures[0].stage, 'server creation')
  assert(!calls.includes('launch browser'))
})

test('listen failure closes the partially started server', async () => {
  const { outcome, report, calls } = await exercise({ failListen: true })
  assert.equal(outcome.status, 'FAIL')
  assert.equal(report.failures[0].stage, 'server listen')
  assert(calls.includes('server close'))
  assert(!calls.includes('launch browser'))
})

test('both cleanup failures are retained in the final FAIL report', async () => {
  const { outcome, report, calls } = await exercise({
    failBrowserClose: true,
    failServerClose: true,
  })
  assert.equal(outcome.status, 'FAIL')
  assert.deepEqual(
    report.failures.map((item) => item.stage),
    ['browser close', 'server close'],
  )
  assert(calls.includes('write report'))
})
