import { instance, storage, setBaseUrl, setAccessToken } from '@workspace/sdk'
import type { components, RequestConfig } from '@workspace/sdk'

const health = instance({ url: '/api/health' })
const me: Promise<components['schemas']['AccountMeResponse']> = instance({ url: '/api/auth/me' })
const detail = instance({
  url: '/api/notifications/{notificationId}',
  pathParams: { notificationId: 'id' },
})
const login: Promise<components['schemas']['AccountLoginResponse']> = instance({
  url: '/api/auth/login',
  method: 'POST',
  data: { email: 'fixture@example.test', password: 'fixture-password' },
})
const downloaded: Promise<Blob> = instance({
  url: '/api/storage/files',
  params: { key: 'demo/file.bin' },
  responseType: 'blob',
})
const mode = 'text' as 'text' | 'arraybuffer'
const unionResponse: Promise<string | ArrayBuffer> = instance({
  url: '/api/health',
  responseType: mode,
})
const config: RequestConfig = { url: '/api/health' }
instance(config)
instance({ url: '/api/storage/uploads', method: 'POST', data: new FormData() })
storage.upload('uploads/a.bin', new Uint8Array([1]))
setBaseUrl('http://localhost/backend')
setAccessToken(null)

// @ts-expect-error No rootless legacy path.
instance({ url: '/health' })
// @ts-expect-error Unknown operation.
instance({ url: '/api/missing' })
// @ts-expect-error Old application operation is absent.
instance({ url: '/join/applications', method: 'POST', data: new FormData() })
// @ts-expect-error Contract method must match.
instance({ url: '/api/auth/login', method: 'GET' })
// @ts-expect-error Omitted method selects GET.
instance({ url: '/api/auth/login', data: {} })
// @ts-expect-error Login requires JSON data.
instance({ url: '/api/auth/login', method: 'POST' })
instance({
  url: '/api/auth/login',
  method: 'POST',
  // @ts-expect-error Login JSON rejects excess fields.
  data: { email: 'fixture@example.test', password: 'fixture-password', invented: true },
})
// @ts-expect-error Detail requires pathParams.
instance({ url: '/api/notifications/{notificationId}' })
instance({
  url: '/api/notifications/{notificationId}',
  // @ts-expect-error Unknown path parameter.
  pathParams: { notificationId: 'x', unknown: 'x' },
})
// @ts-expect-error Query key required.
instance({ url: '/api/storage/files' })
// @ts-expect-error Empty query is insufficient.
instance({ url: '/api/storage/files', params: {} })
// @ts-expect-error JSON operation rejects FormData.
instance({ url: '/api/auth/login', method: 'POST', data: new FormData() })
// @ts-expect-error Multipart requires FormData.
instance({ url: '/api/storage/uploads', method: 'POST', data: { file: 'invalid' } })
// @ts-expect-error GET has no request body.
instance({ url: '/api/health', data: {} })
// @ts-expect-error No query on health.
instance({ url: '/api/health', params: {} })
// @ts-expect-error Runtime overrides are private.
instance({ url: '/api/health', adapter: 'fetch' })
// @ts-expect-error Caller cannot select response DTO.
instance<{ invented: true }>({ url: '/api/health' })
// @ts-expect-error Blob is not the JSON DTO.
const wrongDownload: Promise<{ status: string }> = instance({
  url: '/api/storage/files',
  params: { key: 'x' },
  responseType: 'blob',
})
// @ts-expect-error No method family.
instance.GET('/api/health')
// @ts-expect-error No legacy factory.
import { createApiClient } from '@workspace/sdk'
void [health, me, detail, login, downloaded, unionResponse, wrongDownload]
