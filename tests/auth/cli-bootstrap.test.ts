import { afterEach, expect, it, vi } from 'vitest'
import { createAppAuthService } from '@server/src/cli/support'
import { isolatedPostgres } from '@tests/helpers/postgres'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('bootstraps SSO against an isolated migrated PostgreSQL schema without a join HMAC key', async () => {
  const fixture = await isolatedPostgres()
  vi.stubEnv('AUTH_CODE_HMAC_KEY', undefined)
  try {
    const cli = await createAppAuthService({
      connectionString: fixture.connectionString,
      searchPath: fixture.schema,
    })
    try {
      const request = await cli.authServices.createSsoRequest()
      expect(await cli.authServices.inspectSsoRequest(request.ssoRequestId)).toMatchObject({
        ssoRequestId: request.ssoRequestId,
        status: 'pending',
        expiresAt: request.expiresAt,
      })
      expect(await cli.authServices.inspectSsoRequestForCli(request.ssoRequestId)).toEqual({
        status: 'pending',
        expiresAt: request.expiresAt,
        userId: null,
      })
      expect(await cli.authServices.inspectSsoRequestForCli('a'.repeat(43))).toEqual({
        status: 'not-found',
      })
    } finally {
      await cli.close()
    }
  } finally {
    await fixture.close()
  }
})

it('rejects an unmigrated authentication schema without creating tables', async () => {
  const fixture = await isolatedPostgres({ migrate: false })
  try {
    await expect(
      createAppAuthService({
        connectionString: fixture.connectionString,
        searchPath: fixture.schema,
      }),
    ).rejects.toThrow('pnpm db:migrate')
    const { rows } = await fixture.db.query<{ tablename: string }>(
      'SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1',
      [fixture.schema],
    )
    expect(rows).toEqual([])
  } finally {
    await fixture.close()
  }
})
