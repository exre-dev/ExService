import { afterEach, expect, it } from 'vitest'
import { OidcService } from '@server/src/modules/identity/oidc'
import { parseIdentityConfig } from '@server/src/modules/identity/config'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

it('binds approved Hydra login and consent to one current Website browser session', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const userId = await fixture.seedUser({
    email: 'oidc@example.com',
    nickname: 'OIDC',
    password: 'valid password',
  })
  const login = await fixture.authServices.login({
    email: 'oidc@example.com',
    password: 'valid password',
  })
  const session = await fixture.authServices.authenticateToken(login.token)
  const client = {
    client_id: 'another-app',
    client_name: 'Test App',
    redirect_uris: ['http://127.0.0.1:9000/callback'],
  }
  const admin = {
    getLogin: async () => ({
      challenge: 'login-one',
      client,
      requested_scope: ['openid', 'profile', 'email'],
      request_url:
        'http://identity.exwebsite.test:8090/oauth2/auth?redirect_uri=http%3A%2F%2F127.0.0.1%3A9000%2Fcallback',
      session_id: 'sid-one',
      skip: false,
      subject: '',
    }),
    acceptLogin: async () => ({
      redirect_to: 'http://identity.exwebsite.test:8090/oauth2/auth?login_verifier=one',
    }),
    getConsent: async () => ({
      challenge: 'consent-one',
      client,
      requested_scope: ['openid', 'profile', 'email'],
      login_challenge: 'login-one',
      login_session_id: 'sid-one',
      subject: userId,
      request_url:
        'http://identity.exwebsite.test:8090/oauth2/auth?redirect_uri=http%3A%2F%2F127.0.0.1%3A9000%2Fcallback',
    }),
    acceptConsent: async () => ({
      redirect_to: 'http://identity.exwebsite.test:8090/oauth2/auth?consent_verifier=one',
    }),
    getLogout: async () => ({ sid: 'sid-one', subject: userId, client }),
    acceptLogout: async () => ({
      redirect_to: 'http://identity.exwebsite.test:8090/oauth2/sessions/logout?logout_verifier=one',
    }),
  }
  const service = new OidcService({
    db: fixture.db,
    authServices: fixture.authServices,
    admin,
    flowKey: Buffer.alloc(32, 7),
    issuer: 'http://identity.exwebsite.test:8090/',
    clients: {
      'another-app': {
        name: 'Test App',
        redirectUri: 'http://127.0.0.1:9000/callback',
        scopes: ['openid', 'profile', 'email'],
      },
    },
    now: fixture.now,
  })
  expect(await service.inspect('login', 'login-one')).toEqual({
    clientName: 'Test App',
    scopes: ['openid', 'profile', 'email'],
  })
  const accepted = await service.acceptLogin('login-one', session)
  expect(accepted.redirectUrl).toContain('login_verifier=one')
  expect(await service.acceptLogin('login-one', session)).toEqual(accepted)
  const consent = await service.acceptConsent('consent-one', session)
  expect(consent.redirectUrl).toContain('consent_verifier=one')
  expect(
    await fixture.authServices.checkLinkedSession('another-app', 'sid-one', userId),
  ).toMatchObject({ active: true, sessionId: session.id })
  const logout = await service.acceptLogout('logout-one', session)
  expect(logout.redirectUrl).toContain('logout_verifier=one')
  expect(await fixture.authServices.checkLinkedSession('another-app', 'sid-one', userId)).toEqual({
    active: false,
    reason: 'revoked',
  })
  await expect(service.acceptLogout('logout-one', session)).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })
})

it.each(['local', 'deployment'])(
  'uses the configured %s issuer and accepts only its approved callback and clients',
  async (mode) => {
    const fixture = await createTestAuth()
    fixtures.push(fixture)
    const userId = await fixture.seedUser({
      email: 'configured@example.test',
      nickname: 'Configured',
      password: 'valid password',
    })
    const login = await fixture.authServices.login({
      email: 'configured@example.test',
      password: 'valid password',
    })
    const session = await fixture.authServices.authenticateToken(login.token)
    const callback =
      mode === 'local' ? 'http://127.0.0.1:9000/callback' : 'https://app.example/callback'
    const config = parseIdentityConfig({
      IDENTITY_ENABLED: 'true',
      IDENTITY_MODE: mode,
      SERVER_PUBLIC_WEB_BASE_URL:
        mode === 'local' ? 'http://127.0.0.1:8080' : 'https://site.example',
      HYDRA_PUBLIC_URL: mode === 'local' ? 'http://127.0.0.1:4444/' : 'https://issuer.example/',
      HYDRA_ADMIN_URL: 'http://127.0.0.1:4445/',
      IDENTITY_BOOTSTRAP_KEY: 'c'.repeat(64),
      IDENTITY_FLOW_KEY: 'd'.repeat(64),
      IDENTITY_CLIENTS_JSON: JSON.stringify([
        {
          clientId: 'test-app',
          name: 'Test App',
          redirectUri: callback,
          postLogoutRedirectUri: callback + '/out',
          scopes: ['openid', 'profile', 'email'],
          clientSecret: 'existing secret',
        },
      ]),
    })
    if (!config.enabled) throw new Error('expected enabled')
    const client = { client_id: 'test-app', redirect_uris: [callback] }
    const requestUrl = new URL('oauth2/auth', config.issuer)
    requestUrl.searchParams.set('redirect_uri', callback)
    const request = {
      challenge: 'configured-login',
      client,
      requested_scope: ['openid', 'profile', 'email'],
      request_url: requestUrl.href,
      session_id: 'configured-sid',
      skip: false,
      subject: '',
    }
    const admin = {
      getLogin: async () => request,
      acceptLogin: async () => ({
        redirect_to: new URL('oauth2/auth?login_verifier=local', config.issuer).href,
      }),
      getConsent: async () => ({
        ...request,
        challenge: 'configured-consent',
        login_challenge: 'configured-login',
        login_session_id: 'configured-sid',
        subject: userId,
      }),
      acceptConsent: async () => ({
        redirect_to: new URL('oauth2/auth?consent_verifier=local', config.issuer).href,
      }),
      getLogout: async () => ({ sid: 'configured-sid', subject: userId, client }),
      acceptLogout: async () => ({
        redirect_to: new URL('oauth2/sessions/logout?logout_verifier=local', config.issuer).href,
      }),
    }
    const service = new OidcService({
      db: fixture.db,
      authServices: fixture.authServices,
      admin,
      flowKey: Buffer.from(config.keys.flow, 'hex'),
      issuer: config.issuer,
      clients: config.approvedClients,
      now: fixture.now,
    })
    expect(await service.inspect('login', request.challenge)).toMatchObject({
      clientName: 'Test App',
    })
    await service.acceptLogin(request.challenge, session)
    await service.acceptConsent('configured-consent', session)
    expect(
      await fixture.authServices.checkLinkedSession('test-app', 'configured-sid', userId),
    ).toMatchObject({ active: true, sessionId: session.id })
    client.client_id = 'unknown-app'
    await expect(service.inspect('login', request.challenge)).rejects.toMatchObject({
      code: 'IDENTITY_CLIENT_FORBIDDEN',
    })
    client.client_id = 'test-app'
    requestUrl.searchParams.set('redirect_uri', `${callback}?other=true`)
    request.request_url = requestUrl.href
    await expect(service.inspect('login', request.challenge)).rejects.toMatchObject({
      code: 'IDENTITY_CLIENT_FORBIDDEN',
    })
    requestUrl.searchParams.set('redirect_uri', callback)
    request.request_url = requestUrl.href
    request.requested_scope = ['openid', 'offline_access']
    await expect(service.inspect('login', request.challenge)).rejects.toMatchObject({
      code: 'IDENTITY_CLIENT_FORBIDDEN',
    })
    request.requested_scope = ['openid']
    const emptyService = new OidcService({
      db: fixture.db,
      authServices: fixture.authServices,
      admin,
      flowKey: Buffer.from(config.keys.flow, 'hex'),
      issuer: config.issuer,
      clients: {},
      now: fixture.now,
    })
    await expect(emptyService.inspect('login', request.challenge)).rejects.toMatchObject({
      code: 'IDENTITY_CLIENT_FORBIDDEN',
    })
    client.client_id = 'hydra-only-app'
    await expect(service.inspect('login', request.challenge)).rejects.toMatchObject({
      code: 'IDENTITY_CLIENT_FORBIDDEN',
    })
  },
)
