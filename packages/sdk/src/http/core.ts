import axios, { AxiosError, AxiosHeaders, type AxiosRequestConfig } from 'axios'
import {
  configError,
  safePath,
  type SdkConfig,
  type ConfigSnapshot,
  type RuntimeEnvironment,
} from '../config.js'
import type { HttpRequest } from '../request-types.js'
import { StorageSdkError } from '../errors.js'
import { ExAxiosError, type ExAxiosErrorKind } from './errors.js'
export { ExAxiosError } from './errors.js'

const allowedKeys = new Set([
  'url',
  'method',
  'params',
  'pathParams',
  'data',
  'headers',
  'timeout',
  'signal',
  'responseType',
  'alert',
])
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const errorText: Record<ExAxiosErrorKind, string> = {
  config: '请求配置无效',
  network: '网络连接失败，请稍后重试',
  timeout: '请求超时，请稍后重试',
  cancelled: '请求已取消',
  http: '请求失败，请稍后重试',
}
function finalUrl(baseUrl: string | undefined, config: HttpRequest): string {
  if (
    !baseUrl ||
    typeof config.url !== 'string' ||
    !config.url.startsWith('/') ||
    config.url.startsWith('//') ||
    !safePath(config.url)
  )
    throw configError()
  const placeholders = [...config.url.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]!)
  if (
    config.pathParams !== undefined &&
    (!config.pathParams ||
      typeof config.pathParams !== 'object' ||
      Array.isArray(config.pathParams))
  )
    throw configError()
  if (Object.keys(config.pathParams ?? {}).some((key) => !placeholders.includes(key)))
    throw configError()
  let pathname: string
  try {
    pathname = config.url.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
      const value = config.pathParams?.[key]
      if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        (typeof value === 'number' && !Number.isFinite(value))
      )
        throw configError()
      const text = String(value)
      if (!text || /[\\/]/.test(text) || !safePath(text) || /%(?:2e|25)/i.test(text))
        throw configError()
      return encodeURIComponent(text)
    })
  } catch {
    throw configError()
  }
  if (/[{}]/.test(pathname)) throw configError()
  const url = new URL(baseUrl + pathname)
  if (!inScope(url.href, baseUrl)) throw configError()
  if (config.params !== undefined) {
    for (const [key, value] of Object.entries(config.params)) {
      if (value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) {
        if (
          !['string', 'number', 'boolean'].includes(typeof item) ||
          (typeof item === 'number' && !Number.isFinite(item))
        )
          throw configError()
        url.searchParams.append(key, String(item))
      }
    }
  }
  return url.href
}
function inScope(url: string, scope: string | undefined): boolean {
  if (!scope) return false
  const target = new URL(url),
    root = new URL(scope)
  const path = root.pathname.replace(/\/$/, '')
  return (
    target.origin === root.origin &&
    (path === '' || target.pathname === path || target.pathname.startsWith(`${path}/`))
  )
}
function envelope(
  input: unknown,
): { code: string; message: string; requestId: string } | undefined {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1
  )
    return undefined
  const value = (input as { error?: unknown }).error
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'code,message,requestId'
  )
    return undefined
  const error = value as Record<string, unknown>
  return typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.requestId === 'string'
    ? (error as { code: string; message: string; requestId: string })
    : undefined
}
function retryAfter(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  if (/^\d+$/.test(value)) {
    const seconds = Number(value)
    return Number.isSafeInteger(seconds) ? seconds : undefined
  }
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}
function decodedJson(value: unknown): unknown {
  try {
    return typeof value === 'string'
      ? JSON.parse(value)
      : JSON.parse(
          new TextDecoder().decode(
            value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer),
          ),
        )
  } catch {
    return undefined
  }
}

export function createHttpCore(runtime: RuntimeEnvironment, state: SdkConfig) {
  return async (config: HttpRequest, expected?: ConfigSnapshot): Promise<unknown> => {
    if (
      !config ||
      typeof config !== 'object' ||
      Object.keys(config).some((key) => !allowedKeys.has(key))
    )
      throw configError()
    if (config.method !== undefined && typeof config.method !== 'string') throw configError()
    if (
      config.headers !== undefined &&
      (typeof config.headers !== 'object' ||
        config.headers === null ||
        Array.isArray(config.headers))
    )
      throw configError()
    if (
      config.params !== undefined &&
      (typeof config.params !== 'object' || config.params === null || Array.isArray(config.params))
    )
      throw configError()
    const method = (config.method ?? 'GET').toUpperCase()
    if (
      !methods.has(method) ||
      (config.timeout !== undefined && (!Number.isFinite(config.timeout) || config.timeout < 0)) ||
      (config.alert !== undefined && typeof config.alert !== 'boolean')
    )
      throw configError()
    const snapshot = state.resolve()
    if (expected && !state.matches(expected, snapshot)) throw new StorageSdkError('CONFIG_CHANGED')
    const target = finalUrl(snapshot.baseUrl, config)
    const scoped = true
    const token = snapshot.token
    const headers: Record<string, string> = {}
    const headerNames = new Set<string>()
    for (const [name, value] of Object.entries(config.headers ?? {})) {
      if (
        typeof value !== 'string' ||
        !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) ||
        headerNames.has(name.toLowerCase()) ||
        /^(host|:authority)$/i.test(name) ||
        /[\r\n]/.test(name + value)
      )
        throw configError()
      headerNames.add(name.toLowerCase())
      headers[name] = value
    }
    const explicit = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === 'authorization',
    )?.[1]
    if (scoped && token && explicit === undefined) headers.Authorization = `Bearer ${token}`
    const qualified = explicit === undefined || (token !== null && explicit === 'Bearer ' + token)
    const resolvedAlert = config.alert ?? true
    const responseType = config.responseType ?? 'json'
    if (!['json', 'text', 'blob', 'arraybuffer'].includes(responseType)) throw configError()
    if (config.signal?.aborted)
      throw new ExAxiosError(
        config.signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled',
        config.signal.reason?.name === 'TimeoutError' ? 'TIMEOUT' : 'CANCELLED',
        errorText[config.signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled'],
      )

    const requestHeaders = AxiosHeaders.from(headers)
    if (
      config.data !== undefined &&
      !(config.data instanceof FormData) &&
      !requestHeaders.has('Content-Type')
    )
      requestHeaders.setContentType('application/json')
    // Axios otherwise adds a form Content-Type even to bodyless POST requests.
    if (config.data === undefined && !requestHeaders.has('Content-Type'))
      requestHeaders.setContentType(false)
    const request: AxiosRequestConfig = {
      url: target,
      method,
      headers: requestHeaders,
      data: config.data,
      timeout: config.timeout ?? 30_000,
      signal: config.signal,
      responseType: responseType === 'json' || responseType === 'text' ? 'text' : 'arraybuffer',
      transformResponse: [(data: unknown) => data],
      validateStatus: () => true,
      withCredentials: false,
      adapter: runtime.environment === 'browser' ? 'fetch' : 'http',
      ...(runtime.environment === 'browser'
        ? { fetchOptions: { redirect: 'error', credentials: 'omit' } }
        : {}),
      ...(runtime.environment === 'node' ? { maxRedirects: 0 } : {}),
    }
    let response
    try {
      response = await axios(request)
    } catch (cause) {
      const timedOut =
        config.signal?.reason?.name === 'TimeoutError' ||
        (cause instanceof AxiosError &&
          (cause.code === 'ECONNABORTED' || cause.code === 'ETIMEDOUT'))
      const cancelled =
        !timedOut &&
        (config.signal?.aborted || (cause instanceof AxiosError && cause.code === 'ERR_CANCELED'))
      const kind: ExAxiosErrorKind = timedOut ? 'timeout' : cancelled ? 'cancelled' : 'network'
      const code = timedOut ? 'TIMEOUT' : cancelled ? 'CANCELLED' : 'NETWORK_ERROR'
      const error = new ExAxiosError(kind, code, errorText[kind])
      if (resolvedAlert && kind !== 'cancelled') {
        try {
          runtime.notify?.(error.message)
        } catch {
          /* keep original failure */
        }
      }
      throw error
    }
    const status = response.status
    if (status >= 200 && status < 300) {
      if (status === 204) return undefined
      if (responseType === 'text') return response.data
      if (responseType === 'arraybuffer') {
        const bytes =
          response.data instanceof Uint8Array ? response.data : new Uint8Array(response.data)
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      }
      if (responseType === 'blob') return new Blob([response.data])
      const parsed = decodedJson(response.data)
      if (parsed !== undefined) return parsed
    }
    const contentType = String(response.headers['content-type'] ?? '')
    const raw = response.data
    const size =
      typeof raw === 'string'
        ? new TextEncoder().encode(raw).byteLength
        : (raw?.byteLength ?? Number.POSITIVE_INFINITY)
    const parsed =
      /^application\/(?:[\w.+-]*\+)?json\b/i.test(contentType) && size <= 65_536
        ? decodedJson(raw)
        : undefined
    const safe = scoped ? envelope(parsed) : undefined
    const error = new ExAxiosError(
      'http',
      safe?.code ?? 'HTTP_ERROR',
      safe?.message ?? errorText.http,
      {
        status,
        requestId:
          safe?.requestId ??
          (typeof response.headers['x-request-id'] === 'string'
            ? response.headers['x-request-id']
            : undefined),
        retryAfterSeconds: retryAfter(response.headers['retry-after']),
      },
    )
    if (status === 401 && safe?.code === 'SESSION_INVALID') {
      if (qualified) state.expire(snapshot, error, resolvedAlert)
    } else if (resolvedAlert) {
      try {
        runtime.notify?.(error.message)
      } catch {
        /* preserve request error */
      }
    }
    throw error
  }
}
