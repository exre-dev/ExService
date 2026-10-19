import { afterEach, describe, expect, it } from 'vitest'
import {
  signUploadTicket,
  UPLOAD_TICKET_MAX_LENGTH,
  type UploadTicketPayload,
} from '@server/src/modules/storage/upload-ticket'
import {
  createCosDependencies,
  DOWNLOAD_URL_EXPIRES_SECONDS,
  CREDENTIAL_DURATION_SECONDS,
} from '@server/src/modules/storage/adapters/cos'
import { StorageError } from '@server/src/modules/storage/errors'
import { parseStorageConfig } from '@server/src/modules/storage/config'
import { putObjectPolicy } from '@server/src/modules/storage/adapters/cos'
import {
  TEST_BUCKET,
  TEST_HMAC_KEY,
  TEST_REGION,
  cosStorageFixture,
  createFakeCos,
  fileStorageFixture,
  type StorageTestFixture,
} from '@tests/helpers/storage'

const fixtures: StorageTestFixture[] = []
const use = <T extends StorageTestFixture>(fixture: T): T => {
  fixtures.push(fixture)
  return fixture
}
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup()
})

const NOW = 1_800_000_000
const HMAC_KEY = Buffer.from(TEST_HMAC_KEY, 'hex')

async function codeOf(operation: () => Promise<unknown>): Promise<string> {
  return operation().then(
    () => {
      throw new Error('expected the operation to fail')
    },
    (error) => {
      expect(error).toBeInstanceOf(StorageError)
      return (error as StorageError).code
    },
  )
}

function payload(overrides: Partial<UploadTicketPayload> = {}): UploadTicketPayload {
  return {
    v: 1,
    userId: 'user-a',
    bucket: TEST_BUCKET,
    region: TEST_REGION,
    key: 'avatars/a.webp',
    size: 4,
    contentType: 'image/webp',
    iat: NOW,
    exp: NOW + 1800,
    ...overrides,
  }
}

describe('upload ticket', () => {
  it('round-trips a valid ticket', () => {
    const ticket = signUploadTicket(payload(), HMAC_KEY)
    expect(ticket.split('.')).toHaveLength(2)
    expect(ticket.length).toBeLessThanOrEqual(UPLOAD_TICKET_MAX_LENGTH)
  })

  it('rejects tampering with the signed fields', async () => {
    const fixture = use(cosStorageFixture(createFakeCos()))
    const ticket = signUploadTicket(payload({ size: 4 }), HMAC_KEY)
    // 改一个字节：签名不再匹配。
    const tampered = `${ticket.slice(0, 5)}${ticket[5] === 'A' ? 'B' : 'A'}${ticket.slice(6)}`
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete(
          'user-a',
          { key: 'avatars/a.webp', uploadTicket: tampered },
          NOW,
        ),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it('rejects a ticket signed with a different key', async () => {
    const fixture = use(cosStorageFixture(createFakeCos()))
    const other = Buffer.from('ff'.repeat(32), 'hex')
    const ticket = signUploadTicket(payload(), other)
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete(
          'user-a',
          { key: 'avatars/a.webp', uploadTicket: ticket },
          NOW,
        ),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it.each([
    ['expired', { iat: NOW - 3600, exp: NOW - 1 }],
    ['not yet valid', { iat: NOW + 60, exp: NOW + 600 }],
    ['ttl above 1800 seconds', { iat: NOW, exp: NOW + 1801 }],
    ['exp at or before iat', { iat: NOW, exp: NOW }],
    ['wrong version', { v: 2 }],
    ['declared size above the current ceiling', { size: 99_999 }],
    ['negative size', { size: -1 }],
    ['non-integer size', { size: 1.5 }],
    ['empty key', { key: '' }],
    ['different bucket', { bucket: 'other-1250000001' }],
    ['different region', { region: 'ap-shanghai' }],
  ])('rejects a %s ticket', async (_label, overrides) => {
    const fixture = use(cosStorageFixture(createFakeCos()))
    const ticket = signUploadTicket(payload(overrides as Partial<UploadTicketPayload>), HMAC_KEY)
    const key = (overrides as { key?: string }).key ?? 'avatars/a.webp'
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete('user-a', { key, uploadTicket: ticket }, NOW),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it("rejects another user's ticket with 403 rather than 400", async () => {
    const fixture = use(cosStorageFixture(createFakeCos()))
    const ticket = signUploadTicket(payload({ userId: 'user-b' }), HMAC_KEY)
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete(
          'user-a',
          { key: 'avatars/a.webp', uploadTicket: ticket },
          NOW,
        ),
      ),
    ).toBe('STORAGE_TICKET_FORBIDDEN')
  })

  it.each([
    ['empty', ''],
    ['no separator', 'abc'],
    ['three segments', 'a.b.c'],
    ['empty payload', '.sig'],
    ['empty signature', 'payload.'],
    ['non base64url', 'a b.c*d'],
    ['over the length ceiling', 'a'.repeat(4097)],
    [
      'valid shape but not json',
      `${Buffer.from('not json', 'utf8').toString('base64url')}.${'a'.repeat(43)}`,
    ],
  ])('rejects a %s ticket', async (_label, ticket) => {
    const fixture = use(cosStorageFixture(createFakeCos()))
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete(
          'user-a',
          { key: 'avatars/a.webp', uploadTicket: ticket },
          NOW,
        ),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it('never puts long-term or STS secrets in the payload', () => {
    const ticket = signUploadTicket(payload(), HMAC_KEY)
    const decoded = Buffer.from(ticket.split('.')[0]!, 'base64url').toString('utf8')
    expect(decoded).not.toContain('secret')
    expect(decoded).not.toContain('tmp-key')
    expect(Object.keys(JSON.parse(decoded) as object).sort()).toEqual([
      'bucket',
      'contentType',
      'exp',
      'iat',
      'key',
      'region',
      'size',
      'userId',
      'v',
    ])
  })
})

describe('prepare', () => {
  it('returns only the byte ceiling for the file medium and issues no credentials', async () => {
    const fixture = use(fileStorageFixture({ STORAGE_MAX_BYTES: '512' }))
    const plan = await fixture.storage.direct.prepare('user-a', {
      key: 'a.bin',
      size: 10,
      contentType: 'text/plain',
    })
    expect(plan).toEqual({ medium: 'file', maxBytes: 512 })
    expect(plan).not.toHaveProperty('credentials')
    expect(plan).not.toHaveProperty('uploadTicket')
  })

  it('issues scoped credentials and a ticket for the cos medium', async () => {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos))
    const plan = await fixture.storage.direct.prepare(
      'user-a',
      { key: 'avatars/a.webp', size: 4, contentType: 'image/webp' },
      NOW,
    )
    expect(plan.medium).toBe('cos')
    expect(plan).toMatchObject({
      bucket: TEST_BUCKET,
      region: TEST_REGION,
      key: 'avatars/a.webp',
      maxBytes: 1024,
    })
    expect(plan.credentials.securityToken).toBe('tmp-token')
    // exp 不晚于 STS expiredTime，也不超过 iat + 1800。
    const decoded = JSON.parse(
      Buffer.from(plan.uploadTicket.split('.')[0]!, 'base64url').toString('utf8'),
    ) as { iat: number; exp: number }
    expect(decoded.iat).toBe(NOW)
    expect(decoded.exp).toBeLessThanOrEqual(plan.credentials.expiredTime)
    expect(decoded.exp).toBeLessThanOrEqual(NOW + CREDENTIAL_DURATION_SECONDS)
  })

  it('returns 503 when cos is requested but not configured, without falling back', async () => {
    const fixture = use(fileStorageFixture())
    expect(
      await codeOf(() =>
        fixture.storage.direct.prepare('user-a', {
          key: 'a.bin',
          size: 1,
          contentType: 'text/plain',
          medium: 'cos',
        }),
      ),
    ).toBe('STORAGE_UNAVAILABLE')
  })

  it.each([
    ['oversize declaration', { key: 'a.bin', size: 999_999, contentType: 'text/plain' }],
    ['illegal key', { key: 'CON', size: 1, contentType: 'text/plain' }],
    ['illegal media type', { key: 'a.bin', size: 1, contentType: 'text' }],
    ['negative size', { key: 'a.bin', size: -1, contentType: 'text/plain' }],
  ])('rejects %s before contacting the cloud', async (_label, input) => {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos))
    expect(await codeOf(() => fixture.storage.direct.prepare('user-a', input, NOW))).toBe(
      input.size === 999_999 ? 'STORAGE_TOO_LARGE' : 'STORAGE_INVALID_INPUT',
    )
    expect(cos.calls.issueCredentials).toHaveLength(0)
  })

  it('issues no partial credentials when STS fails', async () => {
    const cos = createFakeCos()
    cos.fail.issueCredentials = new Error('sts unavailable')
    const fixture = use(cosStorageFixture(cos))
    expect(
      await codeOf(() =>
        fixture.storage.direct.prepare(
          'user-a',
          { key: 'a.bin', size: 1, contentType: 'text/plain' },
          NOW,
        ),
      ),
    ).toBe('STORAGE_UPSTREAM_FAILED')
  })
})

describe('complete', () => {
  async function uploadedCosFixture(bytes: Uint8Array) {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos))
    await fixture.storage.service.upload('avatars/a.webp', bytes, { medium: 'cos' })
    return { cos, fixture }
  }

  it('confirms an existing object with the declared size and returns the URL', async () => {
    const { fixture } = await uploadedCosFixture(new Uint8Array([1, 2, 3, 4]))
    const plan = await fixture.storage.direct.prepare(
      'user-a',
      { key: 'avatars/a.webp', size: 4, contentType: 'image/webp' },
      NOW,
    )
    const result = await fixture.storage.direct.complete(
      'user-a',
      { key: 'avatars/a.webp', uploadTicket: plan.uploadTicket },
      NOW,
    )
    expect(result.url).toContain('response-content-disposition=attachment')
  })

  it('returns 404 when the object does not exist', async () => {
    const fixture = use(cosStorageFixture(createFakeCos()))
    const plan = await fixture.storage.direct.prepare(
      'user-a',
      { key: 'missing.bin', size: 4, contentType: 'image/webp' },
      NOW,
    )
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete(
          'user-a',
          { key: 'missing.bin', uploadTicket: plan.uploadTicket },
          NOW,
        ),
      ),
    ).toBe('STORAGE_NOT_FOUND')
  })

  it('returns 409 when the actual size differs from the declared size', async () => {
    const { fixture } = await uploadedCosFixture(new Uint8Array([1, 2, 3]))
    const plan = await fixture.storage.direct.prepare(
      'user-a',
      { key: 'avatars/a.webp', size: 4, contentType: 'image/webp' },
      NOW,
    )
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete(
          'user-a',
          { key: 'avatars/a.webp', uploadTicket: plan.uploadTicket },
          NOW,
        ),
      ),
    ).toBe('STORAGE_CONFLICT')
  })

  it('rejects a key that does not match the ticket', async () => {
    const { fixture } = await uploadedCosFixture(new Uint8Array([1, 2, 3, 4]))
    const plan = await fixture.storage.direct.prepare(
      'user-a',
      { key: 'avatars/a.webp', size: 4, contentType: 'image/webp' },
      NOW,
    )
    expect(
      await codeOf(() =>
        fixture.storage.direct.complete(
          'user-a',
          { key: 'avatars/b.webp', uploadTicket: plan.uploadTicket },
          NOW,
        ),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it('allows replaying a valid ticket inside its window', async () => {
    const { fixture } = await uploadedCosFixture(new Uint8Array([1, 2, 3, 4]))
    const plan = await fixture.storage.direct.prepare(
      'user-a',
      { key: 'avatars/a.webp', size: 4, contentType: 'image/webp' },
      NOW,
    )
    const first = await fixture.storage.direct.complete(
      'user-a',
      { key: 'avatars/a.webp', uploadTicket: plan.uploadTicket },
      NOW,
    )
    const second = await fixture.storage.direct.complete(
      'user-a',
      { key: 'avatars/a.webp', uploadTicket: plan.uploadTicket },
      NOW + 10,
    )
    expect(second.url).toBe(first.url)
  })

  it('propagates a cloud failure as 502 and never echoes the raw error', async () => {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos))
    const plan = await fixture.storage.direct.prepare(
      'user-a',
      { key: 'a.bin', size: 4, contentType: 'image/webp' },
      NOW,
    )
    cos.fail.headObject = Object.assign(
      new Error('connection string leaked: postgres://user:pw@host/db'),
      { statusCode: 500 },
    )
    const error = await fixture.storage.direct
      .complete('user-a', { key: 'a.bin', uploadTicket: plan.uploadTicket }, NOW)
      .then(
        () => {
          throw new Error('expected failure')
        },
        (e: unknown) => e as StorageError,
      )
    expect(error.code).toBe('STORAGE_UPSTREAM_FAILED')
    expect(error.publicMessage).not.toContain('postgres://')
    expect(error.publicMessage).not.toContain('leaked')
  })
})

describe('STS policy scope', () => {
  const config = parseStorageConfig(
    {
      STORAGE_DEFAULT_ADAPTER: 'cos',
      STORAGE_UPLOAD_HMAC_KEY: TEST_HMAC_KEY,
      TENCENT_COS_SECRET_ID: 'id',
      TENCENT_COS_SECRET_KEY: 'key',
      TENCENT_COS_REGION: TEST_REGION,
      TENCENT_COS_BUCKET: TEST_BUCKET,
    },
    '/tmp',
  )

  it('grants PutObject on exactly one key and nothing else', () => {
    const policy = putObjectPolicy(config.cos!, 'avatars/a.webp')
    expect(policy.version).toBe('2.0')
    const statements = policy.statement as Array<Record<string, unknown>>
    expect(statements).toHaveLength(1)
    expect(statements[0]!.action).toEqual(['name/cos:PutObject'])
    expect(statements[0]!.effect).toBe('allow')
    expect(statements[0]!.resource).toEqual([
      `qcs::cos:${TEST_REGION}:uid/1250000000:${TEST_BUCKET}/avatars/a.webp`,
    ])
    // 资源必须精确：resource 里不能出现通配符。
    expect(JSON.stringify(statements[0]!.resource)).not.toContain('*')
    // principal 的 `*` 是 CAM 要求的固定写法，不代表放宽资源范围。
    expect(statements[0]!.principal).toEqual({ qcs: ['*'] })
  })

  it('produces a different resource for a different key, never a wildcard prefix', () => {
    const a = JSON.stringify(putObjectPolicy(config.cos!, 'a/one.webp'))
    const b = JSON.stringify(putObjectPolicy(config.cos!, 'a/two.webp'))
    expect(a).not.toBe(b)
    expect(a).toContain('a/one.webp')
    expect(a).not.toContain('two.webp')
  })
})

describe('one-year download signature', () => {
  it('signs offline with a one-year window and attachment disposition', () => {
    // getObjectUrl 是本地签名，不发起网络请求，因此可以用假凭据直接验证参数。
    const dependencies = createCosDependencies(configForSigning())
    const url = dependencies.signDownloadUrl({ key: 'avatars/a.webp' })
    expect(
      url.startsWith(`https://${TEST_BUCKET}.cos.${TEST_REGION}.myqcloud.com/avatars/a.webp?`),
    ).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('response-content-disposition')).toBe('attachment')
    // disposition 必须参与签名。
    expect(params.get('q-url-param-list')).toContain('response-content-disposition')
    const [start, end] = (params.get('q-sign-time') ?? '').split(';').map(Number)
    expect(end - start).toBe(DOWNLOAD_URL_EXPIRES_SECONDS)
    expect(DOWNLOAD_URL_EXPIRES_SECONDS).toBe(31_536_000)
  })

  function configForSigning() {
    return parseStorageConfig(
      {
        STORAGE_DEFAULT_ADAPTER: 'cos',
        STORAGE_UPLOAD_HMAC_KEY: TEST_HMAC_KEY,
        TENCENT_COS_SECRET_ID: 'test-secret-id',
        TENCENT_COS_SECRET_KEY: 'test-secret-key',
        TENCENT_COS_REGION: TEST_REGION,
        TENCENT_COS_BUCKET: TEST_BUCKET,
      },
      '/tmp',
    ).cos!
  }
})
