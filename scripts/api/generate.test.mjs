import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { generateContract, publishArtifacts } from './generate.mjs'

const doc = `openapi: 3.0.3
info:
  title: PHP Fixture
  version: '1'
servers:
  - url: /
paths:
  /api/fixture:
    get:
      operationId: readFixture
      summary: Read fixture
      security:
        - sessionAuth: []
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema:
                type: object
components:
  schemas: {}
  securitySchemes:
    sessionAuth:
      type: http
      scheme: bearer
`
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'exwebsite-php-contract-'))
  for (const name of ['internal', 'public', 'generated'])
    mkdirSync(join(root, 'apps/php-server/api', name), { recursive: true })
  mkdirSync(join(root, 'packages/sdk/src/generated'), { recursive: true })
  for (const name of ['internal', 'public'])
    writeFileSync(join(root, `apps/php-server/api/${name}/openapi.yaml`), doc)
  writeFileSync(join(root, 'apps/php-server/api/generated/openapi.internal.yaml'), doc)
  return root
}
function artifacts(root) {
  return [
    join(root, 'packages/sdk/src/generated/schema.d.ts'),
    join(root, 'packages/sdk/src/generated/operation-policy.ts'),
  ]
}

test('publishes changed artifacts atomically and preserves equal bytes and mtimes', async () => {
  const root = fixture()
  try {
    await generateContract({ workspace: root })
    const [types, policy] = artifacts(root)
    assert.match(readFileSync(types, 'utf8'), /\/api\/fixture/)
    assert.ok(readFileSync(policy, 'utf8').includes('GET /api/fixture'))
    assert.match(readFileSync(policy, 'utf8'), /"requiresSession": true/)
    const before = [statSync(types).mtimeMs, statSync(policy).mtimeMs]
    await generateContract({ workspace: root })
    await generateContract({ workspace: root, mode: 'check' })
    assert.deepEqual([statSync(types).mtimeMs, statSync(policy).mtimeMs], before)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('check reports stale SDK artifacts without replacing either one', async () => {
  const root = fixture()
  try {
    const [types, policy] = artifacts(root)
    writeFileSync(types, 'old types')
    writeFileSync(policy, 'old policy')
    await assert.rejects(generateContract({ workspace: root, mode: 'check' }), /missing or stale/)
    assert.equal(readFileSync(types, 'utf8'), 'old types')
    assert.equal(readFileSync(policy, 'utf8'), 'old policy')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('missing or invalid complete PHP YAML cannot publish stale outputs', async () => {
  const root = fixture()
  try {
    const [types, policy] = artifacts(root)
    writeFileSync(types, 'old types')
    writeFileSync(policy, 'old policy')
    const source = join(root, 'apps/php-server/api/generated/openapi.internal.yaml')
    rmSync(source)
    await assert.rejects(generateContract({ workspace: root }), /ENOENT/)
    writeFileSync(source, doc.replace('sessionAuth: []', 'missingScheme: []'))
    await assert.rejects(generateContract({ workspace: root }), /security scheme/i)
    assert.equal(readFileSync(types, 'utf8'), 'old types')
    assert.equal(readFileSync(policy, 'utf8'), 'old policy')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('later invalid security alternative leaves both official SDK artifacts untouched', async () => {
  const root = fixture()
  try {
    const [types, policy] = artifacts(root)
    writeFileSync(types, 'old types')
    writeFileSync(policy, 'old policy')
    const source = join(root, 'apps/php-server/api/generated/openapi.internal.yaml')
    for (const alternatives of [
      '        - {}\n        - missingScheme: []',
      '        - {}\n        - sessionAuth: bad',
    ]) {
      writeFileSync(source, doc.replace('        - sessionAuth: []', alternatives))
      await assert.rejects(generateContract({ workspace: root }), /security/i)
      assert.equal(readFileSync(types, 'utf8'), 'old types')
      assert.equal(readFileSync(policy, 'utf8'), 'old policy')
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('types and policy stay on one snapshot when PHP replaces its YAML after capture', async () => {
  const root = fixture()
  try {
    const source = join(root, 'apps/php-server/api/generated/openapi.internal.yaml')
    const next = doc.replaceAll('/api/fixture', '/api/replaced')
    await generateContract({ workspace: root, afterSnapshot: () => writeFileSync(source, next) })
    const [types, policy] = artifacts(root)
    assert.equal(readFileSync(source, 'utf8'), next)
    assert.match(readFileSync(types, 'utf8'), /\/api\/fixture/)
    assert.doesNotMatch(readFileSync(types, 'utf8'), /\/api\/replaced/)
    assert.match(readFileSync(policy, 'utf8'), /GET \/api\/fixture/)
    assert.doesNotMatch(readFileSync(policy, 'utf8'), /GET \/api\/replaced/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('publication restores the first artifact when the second rename fails', async () => {
  const root = fixture()
  try {
    const [types, policy] = artifacts(root)
    writeFileSync(types, 'old types')
    writeFileSync(policy, 'old policy')
    let writes = 0
    const { rename } = await import('node:fs/promises')
    await assert.rejects(
      publishArtifacts(
        [
          { path: types, content: 'new types' },
          { path: policy, content: 'new policy' },
        ],
        {
          rename: async (...args) => {
            if (++writes === 2) throw Error('publish failed')
            return rename(...args)
          },
        },
      ),
      /publish failed/,
    )
    assert.equal(readFileSync(types, 'utf8'), 'old types')
    assert.equal(readFileSync(policy, 'utf8'), 'old policy')
    assert.equal(existsSync(`${policy}.tmp`), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
