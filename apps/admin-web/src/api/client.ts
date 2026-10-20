import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'

interface ClientIntegration {
  readToken: () => string | null
  expireSession: (token: string | null) => void
  navigate: (path: string) => void
  pathname: () => string
  success: (message: string) => void
  error: (message: string) => void
  adapter?: AxiosAdapter
}
function messageFrom(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  if ('msg' in body && typeof body.msg === 'string') return body.msg
  if ('message' in body && typeof body.message === 'string') return body.message
  return undefined
}
export function createAdminClient(integration: ClientIntegration) {
  const transport = axios.create({ baseURL: '/api', timeout: 15000, adapter: integration.adapter })
  async function request<Data = unknown>(config: AxiosRequestConfig<unknown>): Promise<Data> {
    const token = integration.readToken()
    try {
      const response = await transport.request<unknown>({
        ...config,
        headers: { ...config.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const body: unknown = response.data
      if (body && typeof body === 'object' && 'data' in body) {
        const msg = messageFrom(body)
        if (msg && msg !== 'ok') integration.success(msg)
        // Call sites name the PHP contract's payload; Axios never claims to return it.
        return body.data as Data
      }
      return body as Data
    } catch (cause) {
      const response = axios.isAxiosError<unknown>(cause) ? cause.response : undefined
      const msg = messageFrom(response?.data)
      if (response?.status === 503 && response.headers['x-setup-required'] === '1') {
        integration.navigate('/install')
      } else if (
        (response?.status === 401 || /登录|token/i.test(msg || '')) &&
        integration.pathname() !== '/login' &&
        integration.readToken() === token
      ) {
        integration.expireSession(token)
        integration.navigate('/login')
      } else {
        integration.error(response && response.status < 500 && msg ? msg : '请求失败，请稍后重试')
      }
      throw cause
    }
  }
  return {
    get: <Data = unknown>(url: string, config?: AxiosRequestConfig<unknown>) =>
      request<Data>({ ...config, method: 'GET', url }),
    post: <Data = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig<unknown>) =>
      request<Data>({ ...config, method: 'POST', url, data }),
    put: <Data = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig<unknown>) =>
      request<Data>({ ...config, method: 'PUT', url, data }),
    delete: <Data = unknown>(url: string, config?: AxiosRequestConfig<unknown>) =>
      request<Data>({ ...config, method: 'DELETE', url }),
  }
}
