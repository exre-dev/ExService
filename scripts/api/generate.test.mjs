import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('publishes artifacts without writes when content is unchanged', async () => {
  const { publishArtifacts } = await import('./generate.mjs')
  const root = mkdtempSync(join(tmpdir(), 'exwebsite-contract-test-'))
  try {
    const path = join(root, 'contract.json')
    writeFileSync(path, 'original')
    const before = statSync(path).mtimeMs
    await publishArtifacts([{ path, content: 'original' }])
    assert.equal(statSync(path).mtimeMs, before)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('restores both artifacts when publishing the second artifact fails', async () => {
  const { publishArtifacts } = await import('./generate.mjs')
  const root = mkdtempSync(join(tmpdir(), 'exwebsite-contract-test-'))
  try {
    const first = join(root, 'contract.json')
    const second = join(root, 'schema.d.ts')
    writeFileSync(first, 'original json')
    writeFileSync(second, 'original types')
    let writes = 0
    const { rename } = await import('node:fs/promises')
    await assert.rejects(
      publishArtifacts(
        [
          { path: first, content: 'new json' },
          { path: second, content: 'new types' },
        ],
        {
          rename: async (...args) => {
            if (++writes === 2) throw new Error('publish failed')
            return rename(...args)
          },
        },
      ),
      /publish failed/,
    )
    assert.equal(readFileSync(first, 'utf8'), 'original json')
    assert.equal(readFileSync(second, 'utf8'), 'original types')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function workspaceFixture() {
  const root = mkdtempSync(join(tmpdir(), 'exwebsite-contract-test-'))
  mkdirSync(join(root, 'api/generated'), { recursive: true })
  mkdirSync(join(root, 'packages/sdk/src/generated'), { recursive: true })
  writeFileSync(
    join(root, 'api/openapi.yaml'),
    JSON.stringify({
      openapi: '3.1.1',
      info: { title: 'Fixture', version: '1' },
      servers: [{ url: '/api' }],
      tags: [{ name: 'fixture', description: 'Fixture' }],
      paths: {
        '/fixture': {
          get: {
            operationId: 'readFixture',
            summary: 'Read fixture',
            tags: ['fixture'],
            security: [],
            responses: { 200: { description: 'ok' } },
          },
        },
      },
      components: { schemas: {} },
    }),
  )
  return root
}

test('checks stale artifacts without replacing either official artifact', async () => {
  const { generateContract } = await import('./generate.mjs')
  const root = workspaceFixture()
  try {
    writeFileSync(join(root, 'api/generated/openapi.json'), 'stale json')
    writeFileSync(join(root, 'packages/sdk/src/generated/schema.d.ts'), 'stale types')
    await assert.rejects(generateContract({ workspace: root, mode: 'check' }), /missing or stale/)
    assert.equal(readFileSync(join(root, 'api/generated/openapi.json'), 'utf8'), 'stale json')
    assert.equal(
      readFileSync(join(root, 'packages/sdk/src/generated/schema.d.ts'), 'utf8'),
      'stale types',
    )
    assert.deepEqual(readdirSync(join(root, '.local')), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('never publishes when lint fails', async () => {
  const { generateContract } = await import('./generate.mjs')
  const root = workspaceFixture()
  try {
    writeFileSync(join(root, 'api/openapi.yaml'), 'openapi: invalid')
    writeFileSync(join(root, 'api/generated/openapi.json'), 'original json')
    writeFileSync(join(root, 'packages/sdk/src/generated/schema.d.ts'), 'original types')
    await assert.rejects(generateContract({ workspace: root }), /command failed/)
    assert.equal(readFileSync(join(root, 'api/generated/openapi.json'), 'utf8'), 'original json')
    assert.equal(
      readFileSync(join(root, 'packages/sdk/src/generated/schema.d.ts'), 'utf8'),
      'original types',
    )
    assert.equal(existsSync(join(root, '.local')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('bundle generates only JSON, then generate and check preserve unchanged mtimes', async () => {
  const { generateContract } = await import('./generate.mjs')
  const root = workspaceFixture()
  try {
    await generateContract({ workspace: root, mode: 'bundle' })
    const jsonPath = join(root, 'api/generated/openapi.json')
    const typesPath = join(root, 'packages/sdk/src/generated/schema.d.ts')
    assert.equal(existsSync(typesPath), false)
    assert.equal(
      JSON.parse(readFileSync(jsonPath, 'utf8')).paths['/fixture'].get.operationId,
      'readFixture',
    )
    await generateContract({ workspace: root })
    const before = [statSync(jsonPath).mtimeMs, statSync(typesPath).mtimeMs]
    await generateContract({ workspace: root })
    await generateContract({ workspace: root, mode: 'check' })
    assert.deepEqual([statSync(jsonPath).mtimeMs, statSync(typesPath).mtimeMs], before)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
