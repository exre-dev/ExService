import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { StorageError } from '@server/src/modules/storage/errors'
import { createStorageModule } from '@server/src/modules/storage/factory'
import { parseStorageConfig } from '@server/src/modules/storage/config'
import { fileStorageFixture, type StorageTestFixture } from '@tests/helpers/storage'

const fixtures: StorageTestFixture[] = []
const use = <T extends StorageTestFixture>(fixture: T): T => {
  fixtures.push(fixture)
  return fixture
}
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup()
})

function fixtureWithRoot(): { fixture: StorageTestFixture; uploads: string; tmp: string } {
  const fixture = use(fileStorageFixture())
  return {
    fixture,
    uploads: join(fixture.dataRoot, 'uploads'),
    tmp: join(fixture.dataRoot, 'upload-tmp'),
  }
}

async function readBack(fixture: StorageTestFixture, key: string): Promise<Buffer> {
  const read = await fixture.storage.fileAdapter.openRead(key)
  try {
    const chunks: Buffer[] = []
    for await (const chunk of read.stream) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  } finally {
    await read.release()
  }
}

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

describe('FileAdapter writes', () => {
  it('creates nested directories and stores exact bytes', async () => {
    const { fixture } = fixtureWithRoot()
    await fixture.storage.service.upload('a/b/c.bin', new Uint8Array([1, 2, 3]))
    expect(await readBack(fixture, 'a/b/c.bin')).toEqual(Buffer.from([1, 2, 3]))
  })

  it('stores concurrent files under the same initially missing directories', async () => {
    const { fixture, tmp } = fixtureWithRoot()
    const keys = Array.from({ length: 16 }, (_, index) => `shared/nested/${index}.bin`)
    const results = await Promise.allSettled(
      keys.map((key, index) => fixture.storage.service.upload(key, new Uint8Array([index, 255]))),
    )

    expect(results.map((result) => result.status)).toEqual(Array(16).fill('fulfilled'))
    for (const [index, key] of keys.entries()) {
      expect(await readBack(fixture, key)).toEqual(Buffer.from([index, 255]))
    }
    expect(readdirSync(tmp)).toEqual([])
  })

  it('overwrites the same key without keeping versions', async () => {
    const { fixture, uploads } = fixtureWithRoot()
    await fixture.storage.service.upload('same.bin', new Uint8Array([1]))
    await fixture.storage.service.upload('same.bin', new Uint8Array([2, 2]))
    expect(await readBack(fixture, 'same.bin')).toEqual(Buffer.from([2, 2]))
    expect(readdirSync(uploads)).toEqual(['same.bin'])
  })

  it('returns a conflict when a file blocks the directory path, and keeps that file', async () => {
    const { fixture, uploads } = fixtureWithRoot()
    await fixture.storage.service.upload('blocker', new Uint8Array([7]))
    expect(
      await codeOf(() => fixture.storage.service.upload('blocker/child.bin', new Uint8Array([1]))),
    ).toBe('STORAGE_CONFLICT')
    // 不删除已有文件，也不静默替换。
    expect(await readBack(fixture, 'blocker')).toEqual(Buffer.from([7]))
    expect(existsSync(join(uploads, 'blocker', 'child.bin'))).toBe(false)
  })

  it('returns a conflict when the target path is already a directory', async () => {
    const { fixture, uploads } = fixtureWithRoot()
    mkdirSync(join(uploads, 'taken'), { recursive: true })
    expect(await codeOf(() => fixture.storage.service.upload('taken', new Uint8Array([1])))).toBe(
      'STORAGE_CONFLICT',
    )
    expect(lstatSync(join(uploads, 'taken')).isDirectory()).toBe(true)
  })

  it('cleans up its temporary file and never leaves it inside the publicly readable root', async () => {
    const { fixture, uploads, tmp } = fixtureWithRoot()
    await fixture.storage.service.upload('clean.bin', new Uint8Array([5]))
    expect(readdirSync(uploads)).toEqual(['clean.bin'])
    // 临时区不在公开读取根目录内，且写入完成后为空。
    expect(resolve(tmp).startsWith(resolve(uploads))).toBe(false)
    expect(readdirSync(tmp)).toEqual([])
  })

  it(
    'keeps the old content readable when the replacement fails',
    { skip: process.platform !== 'win32' },
    async () => {
      // Windows：被占用的目标文件会让 rename 失败。
      const { fixture, uploads } = fixtureWithRoot()
      await fixture.storage.service.upload('locked.bin', new Uint8Array([1]))
      const held = openSync(join(uploads, 'locked.bin'), 'r')
      try {
        expect(
          await codeOf(() => fixture.storage.service.upload('locked.bin', new Uint8Array([2]))),
        ).toBe('INTERNAL_ERROR')
      } finally {
        closeSync(held)
      }
      // 替换失败后已有内容仍然可读，且没有先删除旧文件。
      expect(await readBack(fixture, 'locked.bin')).toEqual(Buffer.from([1]))
    },
  )
})

describe('FileAdapter reads', () => {
  it('releases an unread file without racing descriptor closes', async () => {
    const { fixture } = fixtureWithRoot()
    await fixture.storage.service.upload('unread.bin', new Uint8Array([1, 2, 3]))
    const read = await fixture.storage.fileAdapter.openRead('unread.bin')
    const errors: unknown[] = []
    read.stream.on('error', (error) => errors.push(error))
    const closed = new Promise<void>((resolve) => {
      read.stream.once('close', resolve)
    })

    await read.release()
    await closed
    expect(read.stream.destroyed).toBe(true)
    expect(errors).toEqual([])
  })

  it('returns the exact stored bytes and size', async () => {
    const { fixture } = fixtureWithRoot()
    const payload = new Uint8Array(300).map((_, index) => index % 251)
    await fixture.storage.service.upload('read.bin', payload)
    const read = await fixture.storage.fileAdapter.openRead('read.bin')
    try {
      expect(read.bytes).toBe(300)
      const chunks: Buffer[] = []
      for await (const chunk of read.stream) chunks.push(chunk as Buffer)
      expect(Buffer.concat(chunks)).toEqual(Buffer.from(payload))
    } finally {
      await read.release()
    }
  })

  it('returns not found for a missing object', async () => {
    const { fixture } = fixtureWithRoot()
    expect(await codeOf(() => fixture.storage.fileAdapter.openRead('missing.bin'))).toBe(
      'STORAGE_NOT_FOUND',
    )
  })

  it('never returns a directory as a file', async () => {
    const { fixture, uploads } = fixtureWithRoot()
    mkdirSync(join(uploads, 'dir'), { recursive: true })
    expect(await codeOf(() => fixture.storage.fileAdapter.openRead('dir'))).toBe('STORAGE_CONFLICT')
  })

  it('rejects a directory junction that would escape the uploads root', async () => {
    const outside = mkdtempSync(resolve(tmpdir(), 'exwebsite-outside-'))
    const { fixture, uploads } = fixtureWithRoot()
    try {
      // Windows 上目录链接用 junction，POSIX 用 dir。
      symlinkSync(
        outside,
        join(uploads, 'escape'),
        process.platform === 'win32' ? 'junction' : 'dir',
      )
      expect(
        await codeOf(() => fixture.storage.service.upload('escape/evil.bin', new Uint8Array([1]))),
      ).toBe('STORAGE_CONFLICT')
      expect(await codeOf(() => fixture.storage.fileAdapter.openRead('escape/evil.bin'))).toBe(
        'STORAGE_CONFLICT',
      )
      expect(existsSync(join(outside, 'evil.bin'))).toBe(false)
    } finally {
      rmSync(join(uploads, 'escape'), { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('rejects a file symlink at the final segment', async () => {
    const outside = mkdtempSync(resolve(tmpdir(), 'exwebsite-outside-file-'))
    const { fixture, uploads } = fixtureWithRoot()
    try {
      const secret = join(outside, 'secret.bin')
      writeFileSync(secret, 'secret')
      symlinkSync(secret, join(uploads, 'alias.bin'), 'file')
      expect(await codeOf(() => fixture.storage.fileAdapter.openRead('alias.bin'))).toBe(
        'STORAGE_CONFLICT',
      )
    } finally {
      rmSync(join(uploads, 'alias.bin'), { force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })
})

describe('FileAdapter public URL', () => {
  it('is derived from the configured public base URL, never from the request host', async () => {
    const fixture = use(
      fileStorageFixture({ STORAGE_PUBLIC_API_BASE_URL: 'https://files.example.com/api' }),
    )
    expect(await fixture.storage.service.upload('a/b_c.bin', new Uint8Array([1]))).toBe(
      'https://files.example.com/api/storage/files?key=a%2Fb_c.bin',
    )
  })
})

describe('storage config', () => {
  it('derives the data directories from the injected root, not from the process cwd', () => {
    const dataRoot = mkdtempSync(resolve(tmpdir(), 'exwebsite-root-'))
    try {
      const config = parseStorageConfig({}, { dataRoot })
      expect(config.uploadsRoot).toBe(resolve(dataRoot, 'uploads'))
      expect(config.uploadTmpRoot).toBe(resolve(dataRoot, 'upload-tmp'))
      expect(config.defaultMedium).toBe('file')
      expect(config.maxBytes).toBe(20 * 1024 * 1024)
    } finally {
      rmSync(dataRoot, { recursive: true, force: true })
    }
  })

  it('fails on an incomplete COS configuration without echoing values', () => {
    const dataRoot = mkdtempSync(resolve(tmpdir(), 'exwebsite-root-'))
    try {
      expect(() =>
        parseStorageConfig({ TENCENT_COS_BUCKET: 'exre-1250000000' }, { dataRoot }),
      ).toThrow(/COS 配置不完整/)
      try {
        parseStorageConfig(
          { TENCENT_COS_BUCKET: 'exre-1250000000', TENCENT_COS_SECRET_KEY: 'super-secret-value' },
          { dataRoot },
        )
        throw new Error('expected failure')
      } catch (error) {
        // 安全要求：错误信息不得包含变量值。
        expect(String(error)).not.toContain('super-secret-value')
      }
    } finally {
      rmSync(dataRoot, { recursive: true, force: true })
    }
  })

  it('is legal to run with only the file medium configured', () => {
    const dataRoot = mkdtempSync(resolve(tmpdir(), 'exwebsite-root-'))
    try {
      const storage = createStorageModule({ config: parseStorageConfig({}, { dataRoot }) })
      expect(storage.cosAdapter).toBeUndefined()
    } finally {
      rmSync(dataRoot, { recursive: true, force: true })
    }
  })
})
