import { afterEach, describe, expect, it } from 'vitest'
import { StorageError } from '@server/src/modules/storage/errors'
import { FALLBACK_CONTENT_TYPE } from '@server/src/modules/storage/service'
import {
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

async function readBack(fixture: StorageTestFixture, key: string): Promise<Uint8Array> {
  const read = await fixture.storage.fileAdapter.openRead(key)
  try {
    const chunks: Buffer[] = []
    for await (const chunk of read.stream) chunks.push(chunk as Buffer)
    return new Uint8Array(Buffer.concat(chunks))
  } finally {
    await read.release()
  }
}

function errorCodeOf(operation: () => Promise<unknown>): Promise<string> {
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

describe('StorageService medium selection', () => {
  it('uses the configured default medium and returns only a URL', async () => {
    const fixture = use(
      fileStorageFixture({ STORAGE_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8080/api/' }),
    )
    const url = await fixture.storage.service.upload(
      'avatars/user-1.webp',
      new Uint8Array([1, 2, 3]),
    )
    // 末尾斜杠被规范化，不产生双斜杠。
    expect(url).toBe('http://127.0.0.1:8080/api/storage/files?key=avatars%2Fuser-1.webp')
  })

  it('honours an explicit medium and leaves the other adapter untouched', async () => {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos, { STORAGE_DEFAULT_ADAPTER: 'file' }))
    const url = await fixture.storage.service.upload('a/b.bin', new Uint8Array([9]), {
      medium: 'cos',
    })
    expect(cos.calls.putObject).toHaveLength(1)
    expect(url).toContain('response-content-disposition=attachment')
  })

  it('fails explicitly when the requested adapter is not enabled, without falling back', async () => {
    const fixture = use(fileStorageFixture())
    expect(
      await errorCodeOf(() =>
        fixture.storage.service.upload('a.bin', new Uint8Array([1]), { medium: 'cos' }),
      ),
    ).toBe('STORAGE_UNAVAILABLE')
  })

  it('rejects an unknown medium', async () => {
    const fixture = use(fileStorageFixture())
    expect(
      await errorCodeOf(() =>
        fixture.storage.service.upload('a.bin', new Uint8Array([1]), { medium: 's3' as 'cos' }),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it('does not require a database or a session for internal calls', async () => {
    const fixture = use(fileStorageFixture())
    // 没有 app、没有 Bearer、没有 db：内部调用路径不经过认证层。
    await expect(
      fixture.storage.service.upload('internal/deep/nested.bin', new Uint8Array([7])),
    ).resolves.toBeTypeOf('string')
  })
})

describe('StorageService binary inputs', () => {
  it('accepts Blob, File, Uint8Array and Buffer with identical bytes', async () => {
    const fixture = use(fileStorageFixture())
    const payload = new Uint8Array([10, 20, 30, 40])
    await fixture.storage.service.upload('blob', new Blob([payload]))
    await fixture.storage.service.upload('file', new File([payload], 'ignored.exe'))
    await fixture.storage.service.upload('u8', payload)
    await fixture.storage.service.upload('buf', Buffer.from(payload))
    for (const key of ['blob', 'file', 'u8', 'buf']) {
      expect(Array.from(await readBack(fixture, key))).toEqual([10, 20, 30, 40])
    }
  })

  it('uploads only the visible view range, never the underlying ArrayBuffer', async () => {
    const fixture = use(fileStorageFixture())
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6]).buffer
    const view = new Uint8Array(buffer, 2, 3)
    await fixture.storage.service.upload('view', view)
    expect(Array.from(await readBack(fixture, 'view'))).toEqual([3, 4, 5])
  })

  it('snapshots the bytes, so later mutation of the source array does not change stored content', async () => {
    const fixture = use(fileStorageFixture())
    const source = new Uint8Array([1, 2, 3])
    await fixture.storage.service.upload('snapshot', source)
    source[0] = 99
    expect(Array.from(await readBack(fixture, 'snapshot'))).toEqual([1, 2, 3])
  })

  it('allows an empty upload', async () => {
    const fixture = use(fileStorageFixture())
    await fixture.storage.service.upload('empty', new Uint8Array(0))
    expect(Array.from(await readBack(fixture, 'empty'))).toEqual([])
  })

  it('rejects a non-binary input instead of coercing it', async () => {
    const fixture = use(fileStorageFixture())
    expect(
      await errorCodeOf(() => fixture.storage.service.upload('x', 'text' as unknown as Uint8Array)),
    ).toBe('STORAGE_INVALID_INPUT')
  })
})

describe('StorageService size ceiling', () => {
  it('accepts exactly maxBytes and rejects one byte more', async () => {
    const fixture = use(fileStorageFixture({ STORAGE_MAX_BYTES: '16' }))
    await expect(fixture.storage.service.upload('exact', new Uint8Array(16))).resolves.toBeTypeOf(
      'string',
    )
    expect(
      await errorCodeOf(() => fixture.storage.service.upload('over', new Uint8Array(17))),
    ).toBe('STORAGE_TOO_LARGE')
  })

  it('rejects an oversized Blob before buffering it', async () => {
    const fixture = use(fileStorageFixture({ STORAGE_MAX_BYTES: '8' }))
    expect(
      await errorCodeOf(() =>
        fixture.storage.service.upload('over', new Blob([new Uint8Array(9)])),
      ),
    ).toBe('STORAGE_TOO_LARGE')
  })
})

describe('StorageService content type', () => {
  it('prefers the explicit option, then a valid Blob type, then the fallback', async () => {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos))
    await fixture.storage.service.upload('explicit.bin', new Uint8Array([1]), {
      contentType: 'image/webp',
    })
    await fixture.storage.service.upload(
      'blob.bin',
      new Blob([new Uint8Array([1])], { type: 'text/plain' }),
    )
    await fixture.storage.service.upload('fallback.bin', new Uint8Array([1]))
    await fixture.storage.service.upload(
      'invalid-blob.bin',
      new Blob([new Uint8Array([1])], { type: 'not a mime/type; charset=utf-8' }),
    )

    expect(cos.calls.putObject.map((call) => call.contentType)).toEqual([
      'image/webp',
      'text/plain',
      FALLBACK_CONTENT_TYPE,
      FALLBACK_CONTENT_TYPE,
    ])
  })

  it('rejects an invalid explicit content type', async () => {
    const fixture = use(fileStorageFixture())
    expect(
      await errorCodeOf(() =>
        fixture.storage.service.upload('x', new Uint8Array([1]), { contentType: 'text' }),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
    expect(
      await errorCodeOf(() =>
        fixture.storage.service.upload('x', new Uint8Array([1]), { contentType: 'a/b\r\nX: 1' }),
      ),
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it('sends attachment disposition and no-store on every COS write', async () => {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos))
    await fixture.storage.service.upload('x.bin', new Uint8Array([1]))
    expect(cos.calls.putObject[0]).toMatchObject({
      contentDisposition: 'attachment',
      cacheControl: 'no-store',
    })
  })
})

describe('storage key validation', () => {
  const rejected = [
    '',
    'Upper',
    'a/b/../c',
    'a\\b',
    '/leading',
    'trailing/',
    'a//b',
    'a/.',
    'con',
    'con.txt',
    'nul',
    'COM1',
    'lpt9.log',
    'a/prn/b',
    '%2e%2e/x',
    'x'.repeat(241),
  ]

  it.each(rejected)('rejects %j', async (key) => {
    const fixture = use(fileStorageFixture())
    expect(await errorCodeOf(() => fixture.storage.service.upload(key, new Uint8Array([1])))).toBe(
      'STORAGE_INVALID_INPUT',
    )
  })

  it.each(['a', 'a.b', 'avatars/user-123.webp', 'a/b/c/d.bin', 'x'.repeat(240), 'a-b_c.d'])(
    'accepts %j',
    async (key) => {
      const fixture = use(fileStorageFixture())
      await expect(fixture.storage.service.upload(key, new Uint8Array([1]))).resolves.toBeTypeOf(
        'string',
      )
    },
  )

  it('rejects a key longer than 240 characters', async () => {
    const fixture = use(fileStorageFixture())
    expect(
      await errorCodeOf(() => fixture.storage.service.upload('a'.repeat(241), new Uint8Array([1]))),
    ).toBe('STORAGE_INVALID_INPUT')
  })
})

describe('COS adapter wiring', () => {
  it('exposes the configured bucket and region only through the adapter', async () => {
    const cos = createFakeCos()
    const fixture = use(cosStorageFixture(cos))
    expect(fixture.storage.cosAdapter?.bucket).toBeTruthy()
    expect(fixture.storage.cosAdapter?.region).toBe(TEST_REGION)
  })
})
