import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'vite'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const publicEntry = '@workspace/common/node/identity-config'
const feedbackEntry = '@workspace/common/feedback-content'

function importWithConditions(specifier, conditions = []) {
  return spawnSync(
    process.execPath,
    [
      ...conditions.map((condition) => `--conditions=${condition}`),
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(specifier)})`,
    ],
    { cwd: packageRoot, encoding: 'utf8' },
  )
}

test('Node exposes the identity configuration through its public subpath', async () => {
  const imported = await import(publicEntry)
  assert.equal(typeof imported.parseIdentityClients, 'function')
  assert.equal(typeof imported.parseIdentityConfiguration, 'function')
  assert.deepEqual(imported.parseIdentityClients(undefined, 'local'), {})
  for (const specifier of [
    '@workspace/common',
    '@workspace/common/src/node/identity-config/index.mjs',
  ]) {
    const result = importWithConditions(specifier)
    assert.notEqual(result.status, 0, `${specifier} unexpectedly imported`)
    assert.match(result.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/)
  }
})

test('browser condition rejects the Node identity configuration subpath', () => {
  const result = importWithConditions(publicEntry, ['browser'])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/)
})

test('Vite browser build rejects the Node identity configuration subpath', async () => {
  const temporary = await mkdtemp(join(packageRoot, '.vite-boundary-'))
  try {
    const source = join(temporary, 'src')
    await mkdir(source)
    const safe = join(source, 'safe.js')
    await writeFile(safe, 'export const browserBundleWorks = true\n')
    const control = join(source, 'control.js')
    await writeFile(
      control,
      "import { browserBundleWorks } from './safe.js'\nconsole.log(browserBundleWorks)\n",
    )
    const settings = (input) => ({
      configFile: false,
      root: temporary,
      logLevel: 'silent',
      build: { outDir: join(temporary, 'dist'), rollupOptions: { input } },
    })
    await build(settings(control))
    const entry = join(source, 'entry.js')
    await writeFile(
      entry,
      `import { parseIdentityConfiguration } from '${publicEntry}'\nconsole.log(parseIdentityConfiguration)\n`,
    )
    await assert.rejects(build(settings(entry)), (error) => {
      assert.match(
        String(error),
        /"\.\/node\/identity-config" is not exported under the conditions \[[^\]]*"browser"/,
      )
      assert.match(String(error), /packages[\\/]common/)
      return true
    })
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('Node consumes feedback rules directly through the public Common entry', async () => {
  const { analyzeRequest, normalizeMime } = await import(feedbackEntry)
  assert.deepEqual(analyzeRequest('正文'), { valid: true, markdown: '正文', reason: null })
  assert.equal(normalizeMime('TEXT/PLAIN'), 'text/plain')
})

test('Common rejects its root and private implementation paths', async () => {
  for (const specifier of [
    '@workspace/common',
    '@workspace/common/src/feedback-content/index.mjs',
  ]) {
    await assert.rejects(import(specifier), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
  }
})

test('a real Vite browser bundle executes the shared feedback rules in a DOM environment', async () => {
  const result = await build({
    configFile: false,
    root: packageRoot,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: fileURLToPath(new URL('fixtures/browser.mjs', import.meta.url)),
        formats: ['iife'],
        name: 'CommonFeedback',
      },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output)
  const chunk = outputs.find((output) => output.type === 'chunk' && output.isEntry)
  assert.ok(chunk, 'browser entry was not emitted')
  // The serializer's browser dependency decodes character references through
  // document.createElement, so execute the browser artifact with a real DOM API.
  const dom = new JSDOM('', { runScripts: 'outside-only' })
  try {
    dom.window.TextEncoder = TextEncoder
    dom.window.eval(chunk.code)
    const browser = dom.window.CommonFeedback
    const result = browser.analyzeRequest('第一行\n第二行')
    assert.equal(result.valid, true)
    assert.equal(result.markdown, '第一行\\\n第二行')
    assert.equal(result.reason, null)
    assert.equal(browser.analyzeRequest(' \n').reason, 'empty')
    assert.equal(browser.normalizeMime('bad\r\nheader'), 'application/octet-stream')
  } finally {
    dom.window.close()
  }
})
