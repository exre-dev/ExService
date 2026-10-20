import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'vite'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const feedbackEntry = '@workspace/common/feedback-content'

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
