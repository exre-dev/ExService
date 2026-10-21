import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { createRuntime } from '@sdk/src/runtime'
import { StorageSdkError, toStorageSdkError } from '@sdk/src/errors'
import { ExAxiosError } from '@sdk/src/http/errors'

const servers: ReturnType<typeof createServer>[] = []
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        }),
    ),
  )
})
async function service(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw Error('Missing address')
  return `http://127.0.0.1:${address.port}`
}
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

it('prepares through the PHP envelope, uploads only the sliced bytes as native FormData and returns data.url', async () => {
  const seen: Array<{
    path: string
    auth: string | undefined
    body: string
    type: string | undefined
  }> = []
  const origin = await service((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      seen.push({
        path: req.url ?? '',
        auth: req.headers.authorization,
        body: Buffer.concat(chunks).toString('latin1'),
        type: req.headers['content-type'],
      })
      json(
        res,
        200,
        req.url?.endsWith('/prepare')
          ? { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } }
          : { msg: 'ok', data: { url: 'https://files.example/item' } },
      )
    })
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(`${origin}/backend`)
  sdk.setAccessToken('upload-token')
  const backing = new Uint8Array([88, 1, 2, 3, 89])
  expect(await sdk.storage.upload('uploads/item.bin', backing.subarray(1, 4))).toBe(
    'https://files.example/item',
  )
  expect(seen.map((item) => item.path)).toEqual([
    '/backend/api/storage/uploads/prepare',
    '/backend/api/storage/uploads',
  ])
  expect(seen.map((item) => item.auth)).toEqual(['Bearer upload-token', 'Bearer upload-token'])
  expect(JSON.parse(seen[0]!.body)).toEqual({
    key: 'uploads/item.bin',
    size: 3,
    contentType: 'application/octet-stream',
  })
  expect(seen[1]!.type).toMatch(/^multipart\/form-data; boundary=/)
  expect(seen[1]!.body).toContain('name="medium"\r\n\r\nfile')
  expect(seen[1]!.body).toContain('name="data"; filename="item.bin"')
  expect(seen[1]!.body).toContain(String.fromCharCode(1, 2, 3))
  expect(seen[1]!.body).not.toContain(String.fromCharCode(88, 1, 2, 3, 89))
})

it('keeps COS unavailable and never falls back to file after PHP returns 503', async () => {
  const seen: string[] = []
  const origin = await service((req, res) => {
    seen.push(req.url ?? '')
    json(res, 503, { msg: 'COS 尚不可用' })
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  sdk.setAccessToken('token')
  await expect(
    sdk.storage.upload('uploads/item.bin', new Uint8Array([1]), { medium: 'cos' }),
  ).rejects.toMatchObject({ code: 'UNAVAILABLE', status: 503 })
  expect(seen).toEqual(['/api/storage/uploads/prepare'])
})

it('enforces client size and session gates between stages', async () => {
  let uploaded = 0
  const origin = await service((req, res) => {
    if (req.url?.endsWith('/prepare'))
      json(res, 200, { msg: 'ok', data: { medium: 'file', maxBytes: 1 } })
    else {
      uploaded++
      json(res, 200, { msg: 'ok', data: { url: '/file' } })
    }
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  sdk.setAccessToken('token')
  await expect(
    sdk.storage.upload('uploads/item.bin', new Uint8Array([1, 2])),
  ).rejects.toMatchObject({ code: 'TOO_LARGE' })
  expect(uploaded).toBe(0)
  sdk.setAccessToken(null)
  await expect(sdk.storage.upload('uploads/item.bin', new Uint8Array([1]))).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  })
})

it('stops after prepare when the root or token changes and never uploads under a new context', async () => {
  for (const change of ['token', 'root'] as const) {
    let arrived!: () => void,
      release!: () => void,
      uploads = 0
    const reached = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const origin = await service((req, res) => {
      if (req.url?.endsWith('/prepare')) {
        arrived()
        void gate.then(() =>
          json(res, 200, { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } }),
        )
      } else {
        uploads++
        json(res, 200, { msg: 'ok', data: { url: '/uploaded' } })
      }
    })
    const sdk = createRuntime({ environment: 'node' })
    sdk.setBaseUrl(origin)
    sdk.setAccessToken('first')
    const pending = sdk.storage.upload('uploads/item.bin', new Uint8Array([1]))
    await reached
    if (change === 'token') sdk.setAccessToken('second')
    else {
      sdk.setBaseUrl(`${origin}/other`)
      sdk.setAccessToken('second')
    }
    release()
    await expect(pending).rejects.toMatchObject({ code: 'CONFIG_CHANGED' })
    expect(uploads).toBe(0)
  }
})

it.each(['token', 'root'] as const)(
  'rejects a file success after %s changes while the multipart response is pending',
  async (change) => {
    let fileArrived!: () => void, release!: () => void
    const reached = new Promise<void>((resolve) => {
      fileArrived = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const seen: Array<{ path: string; auth: string | undefined }> = []
    const origin = await service((req, res) => {
      req.resume()
      req.on('end', () => {
        seen.push({ path: req.url ?? '', auth: req.headers.authorization })
        if (req.url?.endsWith('/prepare'))
          json(res, 200, { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } })
        else {
          fileArrived()
          void gate.then(() => json(res, 200, { msg: 'ok', data: { url: '/old-account-file' } }))
        }
      })
    })
    const sdk = createRuntime({ environment: 'node' })
    sdk.setBaseUrl(`${origin}/backend`)
    sdk.setAccessToken('old-token')
    const pending = sdk.storage.upload('uploads/item.bin', new Uint8Array([1]))
    await reached
    if (change === 'token') sdk.setAccessToken('new-token')
    else {
      sdk.setBaseUrl(`${origin}/other`)
      sdk.setAccessToken('new-token')
    }
    release()
    await expect(pending).rejects.toMatchObject({ code: 'CONFIG_CHANGED' })
    expect(seen).toEqual([
      { path: '/backend/api/storage/uploads/prepare', auth: 'Bearer old-token' },
      { path: '/backend/api/storage/uploads', auth: 'Bearer old-token' },
    ])
  },
)

it('rejects a file result when the default Browser storage token is directly replaced', async () => {
  let fileArrived!: () => void, release!: () => void
  const reached = new Promise<void>((resolve) => {
    fileArrived = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const seen: string[] = []
  const origin = await service((req, res) => {
    req.resume()
    req.on('end', () => {
      seen.push(req.headers.authorization ?? '')
      if (req.url?.endsWith('/prepare'))
        json(res, 200, { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } })
      else {
        fileArrived()
        void gate.then(() => json(res, 200, { msg: 'ok', data: { url: '/old-account-file' } }))
      }
    })
  })
  let stored: string | null = 'old-token'
  const sdk = createRuntime({
    environment: 'browser',
    origin,
    readToken: () => ({ kind: 'known', value: stored }),
  })
  const pending = sdk.storage.upload('uploads/item.bin', new Uint8Array([1]))
  await reached
  stored = 'new-token'
  release()
  await expect(pending).rejects.toMatchObject({ code: 'CONFIG_CHANGED' })
  expect(stored).toBe('new-token')
  expect(seen).toEqual(['Bearer old-token', 'Bearer old-token'])
})

it('snapshots a sliced byte view before asynchronous prepare and keeps equal token setters valid', async () => {
  let arrived!: () => void,
    release!: () => void,
    uploaded = ''
  const reached = new Promise<void>((resolve) => {
    arrived = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const origin = await service((req, res) => {
    if (req.url?.endsWith('/prepare')) {
      arrived()
      void gate.then(() =>
        json(res, 200, { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } }),
      )
    } else {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        uploaded = Buffer.concat(chunks).toString('latin1')
        json(res, 200, { msg: 'ok', data: { url: '/uploaded' } })
      })
    }
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  sdk.setAccessToken('same')
  const backing = new Uint8Array([88, 1, 2, 3, 89])
  const pending = sdk.storage.upload('uploads/item.bin', backing.subarray(1, 4))
  await reached
  backing.fill(99)
  sdk.setAccessToken('same')
  sdk.setBaseUrl(`${origin}/`)
  release()
  expect(await pending).toBe('/uploaded')
  expect(uploaded).toContain(String.fromCharCode(1, 2, 3))
  expect(uploaded).not.toContain('ccc')
})

it('pins each concurrent upload to its own token revision', async () => {
  let arrived = 0,
    release!: () => void,
    uploads = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrival = () => {}
  const reached = new Promise<void>((resolve) => {
    arrival = () => {
      if (++arrived === 2) resolve()
    }
  })
  const origin = await service((req, res) => {
    if (req.url?.endsWith('/prepare')) {
      arrival()
      void gate.then(() =>
        json(res, 200, { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } }),
      )
    } else {
      uploads++
      json(res, 200, { msg: 'ok', data: { url: '/uploaded' } })
    }
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  sdk.setAccessToken('first')
  const first = sdk.storage.upload('uploads/a.bin', new Uint8Array([1]))
  const second = sdk.storage.upload('uploads/b.bin', new Uint8Array([2]))
  await reached
  sdk.setAccessToken('second')
  release()
  await expect(first).rejects.toMatchObject({ code: 'CONFIG_CHANGED' })
  await expect(second).rejects.toMatchObject({ code: 'CONFIG_CHANGED' })
  expect(uploads).toBe(0)
})

it('maps a real prepare deadline to StorageSdkError TIMEOUT', async () => {
  const origin = await service((_req, _res) => {})
  const sdk = createRuntime({ environment: 'node' }, { timeoutMs: 20 })
  sdk.setBaseUrl(origin)
  sdk.setAccessToken('token')
  await expect(sdk.storage.upload('uploads/item.bin', new Uint8Array([1]))).rejects.toMatchObject({
    code: 'TIMEOUT',
  })
})

it.each([
  ['prepare', 'network', 'node'],
  ['file', 'network', 'node'],
  ['prepare', 'timeout', 'node'],
  ['file', 'timeout', 'node'],
  ['prepare', 'abort', 'node'],
  ['file', 'abort', 'node'],
  ['prepare', 'timeout', 'browser'],
  ['file', 'timeout', 'browser'],
] as const)(
  'maps real %s %s through the %s request adapter',
  async (stage, failure, environment) => {
    let arrived!: () => void
    const reached = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const seen: string[] = []
    const origin = await service((req, res) => {
      req.resume()
      req.on('end', () => {
        const current = req.url?.endsWith('/prepare') ? 'prepare' : 'file'
        seen.push(current)
        if (current !== stage) {
          json(res, 200, { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } })
          return
        }
        arrived()
        if (failure === 'network') req.socket.destroy()
        // Timeout and abort leave the response pending until the adapter cancels it.
      })
    })
    const controller = new AbortController()
    const runtime =
      environment === 'browser'
        ? {
            environment: 'browser' as const,
            origin,
            readToken: () => ({ kind: 'known' as const, value: 'private-token' }),
          }
        : { environment: 'node' as const }
    const sdk = createRuntime(runtime, {
      timeoutMs: failure === 'timeout' ? 40 : 2000,
      signal: controller.signal,
    })
    if (environment === 'node') {
      sdk.setBaseUrl(origin)
      sdk.setAccessToken('private-token')
    }
    const pending = sdk.storage.upload('uploads/item.bin', new Uint8Array([1]))
    await reached
    if (failure === 'abort') controller.abort()
    const expectedCode = failure === 'network' ? 'NETWORK' : 'TIMEOUT'
    await expect(pending).rejects.toMatchObject({ code: expectedCode })
    await expect(pending).rejects.not.toThrow('private-token')
    expect(seen).toEqual(stage === 'prepare' ? ['prepare'] : ['prepare', 'file'])
  },
)

it.each(['prepare', 'file'] as const)(
  'preserves the real protected 401 from %s after shared session expiry',
  async (stage) => {
    const seen: string[] = []
    const origin = await service((req, res) => {
      req.resume()
      req.on('end', () => {
        const current = req.url?.endsWith('/prepare') ? 'prepare' : 'file'
        seen.push(current)
        json(
          res,
          current === stage ? 401 : 200,
          current === stage
            ? { msg: 'PHP 会话已失效' }
            : { msg: 'ok', data: { medium: 'file', maxBytes: 20_971_520 } },
        )
      })
    })
    let stored: string | null = 'private-token',
      cleared = 0,
      expired = 0
    const sdk = createRuntime({
      environment: 'browser',
      origin,
      readToken: () => ({ kind: 'known', value: stored }),
      clearToken: (expected) => {
        if (stored !== expected) return false
        stored = null
        cleared++
        return true
      },
    })
    sdk.setSessionExpiredHandler(() => {
      expired++
    })
    await expect(sdk.storage.upload('uploads/item.bin', new Uint8Array([1]))).rejects.toMatchObject(
      { code: 'UNAUTHORIZED', status: 401 },
    )
    expect(stored).toBeNull()
    expect(cleared).toBe(1)
    expect(expired).toBe(1)
    expect(seen).toEqual(stage === 'prepare' ? ['prepare'] : ['prepare', 'file'])
  },
)

it('maps real status and transport failures without copying PHP or cloud secrets into errors', () => {
  for (const [status, code] of [
    [400, 'INVALID_INPUT'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [409, 'CONFLICT'],
    [413, 'TOO_LARGE'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [429, 'BUSY'],
    [503, 'UNAVAILABLE'],
  ] as const) {
    const error = toStorageSdkError({
      cause: new ExAxiosError('http', 'HTTP_ERROR', 'secret-value', { status }),
    })
    expect(error).toMatchObject({ code, status })
    expect(error.message).not.toContain('secret-value')
  }
  expect(
    toStorageSdkError({ cause: new ExAxiosError('network', 'NETWORK_ERROR', 'private-url') }),
  ).toMatchObject({ code: 'NETWORK' })
  expect(
    toStorageSdkError({ cause: new ExAxiosError('timeout', 'TIMEOUT', 'private-url') }),
  ).toMatchObject({ code: 'TIMEOUT' })
  expect(new StorageSdkError('UNAVAILABLE').message).not.toContain('private-url')
})
