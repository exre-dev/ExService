import { request as httpRequest, type ClientRequest } from 'node:http'
import { Readable } from 'node:stream'
import { afterEach, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { multipartBody, type TestPart } from '@tests/helpers/multipart'
import {
  createAppWithStorage,
  fileStorageFixture,
  type StorageTestFixture,
} from '@tests/helpers/storage'
import type { FileAdapter, StoredFileRead } from '@server/src/modules/storage/adapters/file'
import type { StorageServices } from '@server/src/modules/storage/factory'

const fixtures: TestAuth[] = [],
  apps: FastifyInstance[] = [],
  storages: StorageTestFixture[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
  for (const storage of storages.splice(0)) storage.cleanup()
})

interface SetupOptions {
  upload?: Record<string, number>
  download?: Record<string, number>
  /** 替换本地读取介质，用于构造「卡住的下载」。 */
  fileAdapter?: FileAdapter
}

async function setup(options: SetupOptions = {}) {
  const f = await createTestAuth()
  fixtures.push(f)
  const storage = fileStorageFixture()
  storages.push(storage)
  const services: StorageServices =
    options.fileAdapter === undefined
      ? storage.storage
      : { ...storage.storage, fileAdapter: options.fileAdapter }
  const app = createAppWithStorage(f, services)
  apps.push(app)

  let restoreUpload: (() => void) | undefined, restoreDownload: (() => void) | undefined
  app.addHook('onRoute', (route) => {
    const config = (route.config ?? {}) as {
      storageUpload?: Record<string, number>
      storageDownload?: Record<string, number>
    }
    if (config.storageUpload !== undefined && options.upload !== undefined) {
      const deadlineMs = config.storageUpload.deadlineMs!
      Object.assign(config.storageUpload, options.upload)
      restoreUpload = () => {
        config.storageUpload!.deadlineMs = deadlineMs
      }
    }
    if (config.storageDownload !== undefined && options.download !== undefined) {
      const deadlineMs = config.storageDownload.deadlineMs!
      Object.assign(config.storageDownload, options.download)
      restoreDownload = () => {
        config.storageDownload!.deadlineMs = deadlineMs
      }
    }
  })
  let observed = 0
  const observers: Array<() => void> = []
  app.addHook('preValidation', async (request) => {
    if (request.url === '/api/storage/uploads') {
      observed++
      observers.splice(0).forEach((resolve) => resolve())
    }
  })

  await f.seedUser({
    email: 'sockets@example.com',
    nickname: 'Sockets',
    password: 'valid password',
  })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'sockets@example.com', password: 'valid password' },
  })
  expect(login.statusCode).toBe(200)

  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  if (address === null || typeof address === 'string') throw new Error('No socket address')
  return {
    port: address.port,
    token: (login.json() as { token: string }).token,
    entered: (count: number) =>
      observed >= count
        ? Promise.resolve()
        : new Promise<void>((resolve) => observers.push(resolve)),
    restoreUpload: () => {
      if (restoreUpload === undefined) throw new Error('Storage upload route was not registered')
      restoreUpload()
    },
    restoreDownload: () => {
      if (restoreDownload === undefined)
        throw new Error('Storage download route was not registered')
      restoreDownload()
    },
  }
}

function client(port: number, path: string, method = 'GET', headers: Record<string, string> = {}) {
  let req: ClientRequest
  const result = new Promise<{
    status: number
    headers: Record<string, string | string[] | undefined>
    body: Buffer
  }>((resolve, reject) => {
    req = httpRequest({ host: '127.0.0.1', port, path, method, headers, agent: false }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () =>
        resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }),
      )
      res.on('error', reject)
    })
    req.on('error', reject)
  })
  // Deliberate disconnect tests must not create an unhandled rejected Promise.
  void result.catch(() => {})
  return { req: req!, result }
}

function textPart(name: string, value: string): TestPart {
  return { name, contentType: 'text/plain', bytes: Buffer.from(value, 'utf8') }
}
function dataPart(bytes: Uint8Array): TestPart {
  return {
    name: 'data',
    filename: 'upload.bin',
    contentType: 'application/octet-stream',
    bytes: Buffer.from(bytes),
  }
}

/**
 * 只写第一个 part 的头部与半个字段值并挂住：解析器停在字段内，请求一直占着配额。
 * 与 join 的既有手法一致——不写完整 part，也不写结束边界。
 */
function hold(port: number, token: string) {
  const connection = client(port, '/api/storage/uploads', 'POST', {
    'content-type': 'multipart/form-data; boundary=storage-hold-boundary',
    authorization: `Bearer ${token}`,
  })
  connection.req.write(
    '--storage-hold-boundary\r\nContent-Disposition: form-data; name="key"\r\n\r\nstall',
  )
  return connection
}

function upload(port: number, token: string, key: string, bytes: Uint8Array) {
  const body = multipartBody([textPart('key', key), dataPart(bytes)])
  const connection = client(port, '/api/storage/uploads', 'POST', {
    ...body.headers,
    authorization: `Bearer ${token}`,
  })
  connection.req.end(body.payload)
  return connection.result
}

function completeRead(bytes: Buffer): StoredFileRead {
  return { stream: Readable.from([bytes]), bytes: bytes.byteLength, release: async () => undefined }
}

/** 第一包到达后永久停住：响应头已经发出，字节却再也发不完。 */
function stalledRead(announced: number): StoredFileRead & { released: () => number } {
  let releases = 0
  const stream = new Readable({ read() {} })
  stream.push(Buffer.from('partial-bytes'))
  return {
    stream,
    bytes: announced,
    released: () => releases,
    release: async () => {
      releases++
      stream.destroy()
    },
  }
}

it('cancels stalled uploads with 408 and releases their slots', async () => {
  const { port, token, entered, restoreUpload } = await setup({ upload: { deadlineMs: 150 } })
  const first = hold(port, token),
    second = hold(port, token)
  await entered(2)
  for (const response of await Promise.all([first.result, second.result])) {
    expect(response.status).toBe(408)
    expect(JSON.parse(response.body.toString()).error.code).toBe('STORAGE_TIMEOUT')
    expect(response.headers['cache-control']).toBe('no-store')
  }
  // 两个配额已回收：恢复合同截止时间后仍能真正上传。
  restoreUpload()
  const accepted = await upload(port, token, 'released.bin', new Uint8Array([1, 2, 3]))
  expect(accepted.status, accepted.body.toString()).toBe(200)
}, 60000)

it('rejects the third live upload with 503, Retry-After and no stored bytes', async () => {
  const { port, token, entered } = await setup()
  const first = hold(port, token),
    second = hold(port, token)
  await entered(2)
  // 配额在 Bearer 校验之后才占用，因此等两个挂起的请求都走到解析阶段再发第三个。
  await new Promise((resolve) => setTimeout(resolve, 300))
  // 完整请求体：配额耗尽时立即被拒，不会停在等 body 上。
  const body = multipartBody([textPart('key', 'busy-c.bin'), dataPart(new Uint8Array([1]))])
  const third = client(port, '/api/storage/uploads', 'POST', {
    ...body.headers,
    authorization: `Bearer ${token}`,
  })
  third.req.end(body.payload)
  const busy = await third.result
  expect(busy.status).toBe(503)
  expect(JSON.parse(busy.body.toString()).error.code).toBe('STORAGE_BUSY')
  expect(busy.headers['retry-after']).toBe('5')
  first.req.destroy()
  second.req.destroy()
  await Promise.all([first.result.catch(() => undefined), second.result.catch(() => undefined)])
}, 60000)

it('terminates a stalled download after its headers were sent and releases the read', async () => {
  let calls = 0
  const stalled = stalledRead(100)
  const adapter = {
    async openRead(): Promise<StoredFileRead> {
      if (++calls === 1) return stalled
      return completeRead(Buffer.from('later'))
    },
  } as unknown as FileAdapter
  const { port, restoreDownload } = await setup({
    download: { deadlineMs: 200 },
    fileAdapter: adapter,
  })

  const connection = client(port, '/api/storage/files?key=stalled.bin')
  connection.req.end()
  const failure = await connection.result.then(
    () => undefined,
    (error) => error as NodeJS.ErrnoException,
  )
  // 响应头已发出后只能终止连接：不能把 JSON 追加到半截字节后面。
  expect(failure?.code).toBe('ECONNRESET')
  // 连接终止必须同时释放读取句柄。
  for (let waited = 0; waited < 100 && stalled.released() === 0; waited++)
    await new Promise((resolve) => setTimeout(resolve, 10))
  expect(stalled.released()).toBe(1)

  restoreDownload()
  const retried = client(port, '/api/storage/files?key=stalled.bin')
  retried.req.end()
  expect((await retried.result).status).toBe(200)
}, 60000)

it('answers a download that never opens with the 408 envelope', async () => {
  let calls = 0
  const hanging = new Promise<StoredFileRead>(() => {})
  const adapter = {
    async openRead(): Promise<StoredFileRead> {
      if (++calls === 1) return hanging
      return completeRead(Buffer.from('later'))
    },
  } as unknown as FileAdapter
  const { port, restoreDownload } = await setup({
    download: { deadlineMs: 200 },
    fileAdapter: adapter,
  })

  const first = client(port, '/api/storage/files?key=hanging.bin')
  first.req.end()
  const timedOut = await first.result
  expect(timedOut.status).toBe(408)
  expect(JSON.parse(timedOut.body.toString()).error.code).toBe('STORAGE_TIMEOUT')
  // 挂住的第一次读取永远不会返回；切断它的连接，避免影响后续读取与应用关闭。
  first.req.destroy()

  restoreDownload()
  const second = client(port, '/api/storage/files?key=hanging.bin')
  second.req.end()
  const retried = await second.result
  expect(retried.status).toBe(200)
  expect(retried.body.toString()).toBe('later')
}, 60000)

it('releases a real read that opens after the download timed out', async () => {
  const storage = fileStorageFixture()
  storages.push(storage)
  await storage.storage.service.upload('late.bin', new Uint8Array([1, 2, 3]))
  let resume!: () => void
  const pending = new Promise<void>((resolve) => {
    resume = resolve
  })
  let lateRead: StoredFileRead | undefined
  let releases = 0
  const adapter = {
    async openRead(key: string): Promise<StoredFileRead> {
      await pending
      lateRead = await storage.storage.fileAdapter.openRead(key)
      const read = lateRead
      return {
        ...read,
        release: async () => {
          await read.release()
          releases++
        },
      }
    },
  } as unknown as FileAdapter
  const { port } = await setup({ download: { deadlineMs: 200 }, fileAdapter: adapter })

  try {
    const connection = client(port, '/api/storage/files?key=late.bin')
    connection.req.end()
    const response = await connection.result
    expect(response.status).toBe(408)
    expect(JSON.parse(response.body.toString()).error.code).toBe('STORAGE_TIMEOUT')
    expect(lateRead).toBeUndefined()

    // 先确认超时响应已结束，再让真实文件句柄打开并返回。
    resume()
    await expect.poll(() => lateRead).toBeDefined()
    await expect.poll(() => releases).toBe(1)
    expect(lateRead!.stream.destroyed).toBe(true)
    expect(releases).toBe(1)
  } finally {
    resume()
    if (lateRead !== undefined && releases === 0) await lateRead.release()
  }
}, 60000)
