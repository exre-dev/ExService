import { expect, it } from 'vitest'
import { assertDatabaseUrl, databasePoolConfiguration } from '@server/src/db/client'
import {
  databaseReadinessError,
  integrationCheckFailure,
} from '@server/src/modules/identity/startup-diagnostics'

const base = 'postgresql://website:private-password@127.0.0.1:5432/exre'

it('preserves TLS and timeout options while retaining the exact database authority and owned search path', () => {
  const url = new URL(base)
  url.searchParams.set('sslmode', 'verify-full')
  url.searchParams.set('sslrootcert', '/certs/root.pem')
  url.searchParams.set('connect_timeout', '7')
  url.searchParams.set('options', '-c statement_timeout=1500 -c search_path=foreign')
  const config = databasePoolConfiguration(url.href, 'isolated_test')
  const target = new URL(config.connectionString!)
  expect(target.host).toBe('127.0.0.1:5432')
  expect(target.pathname).toBe('/exre')
  expect(target.searchParams.get('sslmode')).toBe('verify-full')
  expect(target.searchParams.get('sslrootcert')).toBe('/certs/root.pem')
  expect(target.searchParams.has('options')).toBe(false)
  expect(config.options).toBe(
    '-c statement_timeout=1500 -c search_path=foreign -c search_path=isolated_test',
  )
  expect(config.connectionTimeoutMillis).toBe(7000)
})

it('rejects query overrides of database authority, duplicate options and invalid timeout or TLS values', () => {
  for (const field of [
    'host',
    'port',
    'user',
    'password',
    'database',
    'dbname',
    'ssl',
    'application_name',
  ]) {
    expect(() => assertDatabaseUrl(`${base}?${field}=private-value`)).toThrow('只允许')
  }
  for (const query of [
    'sslmode=disable&sslmode=require',
    'options=',
    'sslmode=invalid',
    'connect_timeout=0',
    'connect_timeout=-1',
    'connect_timeout=1.5',
    'connect_timeout=2147484',
  ]) {
    expect(() => assertDatabaseUrl(`${base}?${query}`)).toThrow()
  }
})

it('reports actionable database failure categories without printing any source exception message', () => {
  for (const [source, expected, hint] of [
    ['28P01', 'AUTH_FAILED', 'DATABASE_USER、DATABASE_PASSWORD'],
    ['3D000', 'NOT_FOUND', '显式创建独立 exre'],
    ['ECONNREFUSED', 'CONNECTION_REFUSED', 'DATABASE_HOST、DATABASE_PORT'],
    ['ENOTFOUND', 'DNS_FAILED', '修正主机名'],
    ['ETIMEDOUT', 'TIMEOUT', '连接超时'],
  ]) {
    const error = databaseReadinessError({
      cause: { code: source },
      message: 'SQL Bearer private-token private-password',
    })
    const output = integrationCheckFailure(error)
    expect(output).toContain(`INTEGRATION_CHECK_DATABASE_${expected}`)
    expect(output).toContain(hint)
    expect(output).toContain('下一步：')
    expect(output).not.toMatch(/private-token|private-password|SQL|docs\/runtime/)
  }
})
