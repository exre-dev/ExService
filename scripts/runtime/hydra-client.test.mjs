import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { ensureHydraClient, verifyHydraClient, HydraClientCheckError } from './hydra-client.mjs'
import { verifyRuntimeHydraClient } from './applications.mjs'
import { reporter } from './output.mjs'

async function fixture(run) {
  const clients = new Map()
  const secrets = new Map()
  const calls = []
  let override
  const server = createServer(async (request, response) => {
    calls.push([request.method, request.url])
    response.setHeader('Content-Type', 'application/json')
    if (override?.(request, response)) return
    if (request.url === '/oauth2/token') {
      const basic = Buffer.from(
        (request.headers.authorization ?? '').replace(/^Basic /, ''),
        'base64',
      ).toString()
      const separator = basic.indexOf(':')
      let valid = false
      try {
        const unescape = (value) => decodeURIComponent(value.replaceAll('+', ' '))
        const id = unescape(basic.slice(0, separator)),
          secret = unescape(basic.slice(separator + 1))
        valid = separator >= 0 && secrets.has(id) && secrets.get(id) === secret
      } catch {
        /* Fosite rejects malformed form escapes. */
      }
      response.statusCode = valid ? 400 : 401
      response.end(JSON.stringify({ error: valid ? 'invalid_grant' : 'invalid_client' }))
      return
    }
    if (request.method === 'GET') {
      const client = clients.get(request.url.split('/').at(-1))
      response.statusCode = client ? 200 : 404
      response.end(JSON.stringify(client ?? {}))
      return
    }
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const client = JSON.parse(Buffer.concat(chunks).toString())
    secrets.set(client.client_id, client.client_secret)
    clients.set(client.client_id, client)
    client.authorization_code_grant_access_token_lifespan = '1m0s'
    client.authorization_code_grant_id_token_lifespan = '1m0s'
    response.statusCode = 201
    response.end(JSON.stringify(client))
    delete client.client_secret
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await run({
      adminUrl: `http://127.0.0.1:${server.address().port}`,
      publicUrl: `http://127.0.0.1:${server.address().port}`,
      mode: 'local',
      client: {
        clientId: 'sample-app',
        name: 'Sample',
        redirectUri: 'http://127.0.0.1:18765/callback',
        postLogoutRedirectUri: 'http://127.0.0.1:18765/signed-out',
        scopes: ['openid', 'profile', 'email'],
        clientSecret: 'fixture-client-secret',
      },
      calls,
      getClient: (id = 'sample-app') => clients.get(id),
      setSecret: (id, secret) => secrets.set(id, secret),
      override: (handler) => {
        override = handler
      },
    })
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}

test('OAuth Basic form encoding preserves special characters and raw secret fingerprints', async () => {
  for (const clientSecret of [
    'fixture+secret',
    'fixture%20secret',
    'fixture%secret',
    'fixture secret:雪!*',
  ]) {
    await fixture(async (state) => {
      const options = { ...state, client: { ...state.client, clientSecret } }
      await ensureHydraClient(options)
      await verifyHydraClient(options)
      assert.equal(
        state.getClient().metadata.secretFingerprint,
        createHash('sha256').update(clientSecret).digest('hex'),
      )
      state.setSecret(state.client.clientId, `${clientSecret}-wrong`)
      await assert.rejects(verifyHydraClient(options), { kind: 'CREDENTIAL_PROBE_FAILED' })
      assert.equal(
        state.calls.filter(([method, path]) => method === 'POST' && path === '/admin/clients')
          .length,
        1,
      )
    })
  }
})

test('creates the exact explicit confidential client and accepts an identical retry without updating it', async () => {
  await fixture(async (state) => {
    await ensureHydraClient(state)
    await ensureHydraClient(state)
    const client = state.getClient()
    assert.equal(client.client_id, 'sample-app')
    assert.deepEqual(client.redirect_uris, ['http://127.0.0.1:18765/callback'])
    assert.deepEqual(client.grant_types, ['authorization_code'])
    assert.equal(client.scope, 'email openid profile')
    assert.equal(client.token_endpoint_auth_method, 'client_secret_basic')
    assert.equal(client.authorization_code_grant_access_token_lifespan, '1m0s')
    assert.equal(
      state.calls.filter(([method, path]) => method === 'POST' && path === '/admin/clients').length,
      1,
    )
    assert.equal(state.calls.filter(([method]) => method === 'PUT').length, 0)
  })
})

test('registers independent explicit clients without changing another client', async () => {
  await fixture(async (state) => {
    await ensureHydraClient(state)
    await ensureHydraClient({
      ...state,
      client: { ...state.client, clientId: 'second-app', clientSecret: 'separate-probe-secret' },
    })
    await ensureHydraClient({
      ...state,
      client: { ...state.client, clientId: 'second-app', clientSecret: 'separate-probe-secret' },
    })
    assert.equal(state.getClient('second-app')?.client_id, 'second-app')
    assert.deepEqual(state.getClient('second-app')?.redirect_uris, [
      'http://127.0.0.1:18765/callback',
    ])
    assert.deepEqual(state.getClient('second-app')?.post_logout_redirect_uris, [
      'http://127.0.0.1:18765/signed-out',
    ])
    assert.deepEqual(state.getClient().redirect_uris, ['http://127.0.0.1:18765/callback'])
    assert.notEqual(
      state.getClient().metadata.secretFingerprint,
      state.getClient('second-app').metadata.secretFingerprint,
    )
    assert.equal(
      state.calls.filter(([method, path]) => method === 'POST' && path === '/admin/clients').length,
      2,
    )
    const before = state.calls.length
    await assert.rejects(
      ensureHydraClient({ ...state, client: { ...state.client, clientId: 'ex-outline' } }),
      { kind: 'INVALID_CONFIG' },
    )
    assert.equal(state.calls.length, before)
  })
})

test('rejects changed callbacks, privileges, or secret rather than overwriting an existing client', async () => {
  for (const change of [
    (client) => {
      client.redirect_uris.push('http://other.test/callback')
    },
    (client) => {
      client.grant_types.push('refresh_token')
    },
    (client) => {
      client.scope += ' offline_access'
    },
    (client) => {
      client.metadata.issuer = 'http://other.test/'
    },
    (client) => {
      client.metadata.secretFingerprint = 'different'
    },
  ]) {
    await fixture(async (state) => {
      await ensureHydraClient(state)
      change(state.getClient())
      await assert.rejects(ensureHydraClient(state), { kind: 'CLIENT_CONFLICT' })
      assert.equal(
        state.calls.filter(([method, path]) => method !== 'GET' && path !== '/oauth2/token').length,
        1,
      )
    })
  }
})

test('read-only runtime verify refuses missing clients without creating or updating', async () =>
  fixture(async (state) => {
    await assert.rejects(verifyHydraClient(state), (error) => {
      assert.ok(error instanceof HydraClientCheckError)
      assert.equal(error.kind, 'CLIENT_MISSING')
      return true
    })
    assert.equal(state.calls.filter(([method]) => method !== 'GET').length, 0)
    await ensureHydraClient(state)
    const before = state.calls.filter(
      ([method, path]) => method === 'POST' && path === '/admin/clients',
    ).length
    await verifyHydraClient(state)
    assert.equal(
      state.calls.filter(([method, path]) => method === 'POST' && path === '/admin/clients').length,
      before,
    )
  }))
test('unexpected admin HTTP and invalid JSON fail safely without classifying a client as missing', async () => {
  for (const [method, path, status, body] of [
    ['GET', '/admin/clients/sample-app', 503, '{"private":"response-secret"}'],
    ['GET', '/admin/clients/sample-app', 200, '{not-json'],
    ['POST', '/admin/clients', 404, '{"private":"response-secret"}'],
  ])
    await fixture(async (state) => {
      state.override((request, response) => {
        if (request.method !== method || request.url !== path) return false
        response.statusCode = status
        response.end(body)
        return true
      })
      await assert.rejects(
        method === 'POST' ? ensureHydraClient(state) : verifyHydraClient(state),
        (error) => {
          assert.ok(error instanceof HydraClientCheckError)
          assert.equal(error.kind, 'CHECK_FAILED')
          assert.doesNotMatch(error.message, /response-secret|not-json|127\.0\.0\.1/)
          return true
        },
      )
      assert.equal(
        state.calls.some(([called]) => called === 'PUT'),
        false,
      )
      if (method === 'GET')
        assert.equal(
          state.calls.some(([called]) => called === 'POST'),
          false,
        )
    })
})
test('malformed client metadata yields a stable check failure', async () =>
  fixture(async (state) => {
    await ensureHydraClient(state)
    state.getClient().scope = 42
    await assert.rejects(verifyHydraClient(state), { kind: 'CHECK_FAILED' })
  }))
test('token JSON distinguishes a failed credential probe from an unreadable response', async () => {
  for (const [status, body, kind] of [
    [401, '{"error":"invalid_client","private":"response-secret"}', 'CREDENTIAL_PROBE_FAILED'],
    [
      503,
      '{"error":"temporarily_unavailable","private":"response-secret"}',
      'CREDENTIAL_PROBE_FAILED',
    ],
    [503, '{bad-json', 'CHECK_FAILED'],
  ])
    await fixture(async (state) => {
      await ensureHydraClient(state)
      state.override((request, response) => {
        if (request.url !== '/oauth2/token') return false
        response.statusCode = status
        response.end(body)
        return true
      })
      await assert.rejects(verifyHydraClient(state), (error) => {
        assert.equal(error.kind, kind)
        assert.doesNotMatch(error.message, /response-secret|bad-json|127\.0\.0\.1/)
        return true
      })
      assert.equal(
        state.calls.filter(([method, path]) => method === 'POST' && path === '/admin/clients')
          .length,
        1,
      )
      assert.equal(
        state.calls.some(([method]) => method === 'PUT'),
        false,
      )
    })
})
test('a concurrent explicit registration is rechecked and never overwritten', async () =>
  fixture(async (state) => {
    await ensureHydraClient(state)
    let getCount = 0
    state.override((request, response) => {
      if (
        request.method === 'GET' &&
        request.url === '/admin/clients/sample-app' &&
        getCount++ === 0
      ) {
        response.statusCode = 404
        response.end('{}')
        return true
      }
      if (request.method === 'POST' && request.url === '/admin/clients') {
        response.statusCode = 409
        response.end('{}')
        return true
      }
      return false
    })
    assert.deepEqual(await ensureHydraClient(state), { clientId: 'sample-app' })
    assert.equal(
      state.calls.some(([method]) => method === 'PUT'),
      false,
    )
  }))
test('real loopback missing-client result keeps its runtime classification when wording changes', async () =>
  fixture(async (state) => {
    const runtimeState = {
      profile: state.mode,
      internal: { hydra: state.adminUrl },
      config: { issuer: state.publicUrl },
      clients: { [state.client.clientId]: state.client },
    }
    await assert.rejects(
      verifyRuntimeHydraClient(
        runtimeState,
        async (options) => {
          try {
            return await verifyHydraClient(options)
          } catch (error) {
            Object.defineProperty(error, 'message', {
              value: 'unrelated new wording with Bearer private-token',
            })
            throw error
          }
        },
        { ready: async () => {} },
      ),
      (error) => {
        assert.equal(error.code, 'HYDRA_CLIENT_MISSING')
        assert.doesNotMatch(error.message, /private-token|unrelated/)
        return true
      },
    )
    assert.deepEqual(state.calls, [['GET', '/admin/clients/sample-app']])
  }))
test('token 5xx keeps the existing conflict diagnosis without leaking its response', async () =>
  fixture(async (state) => {
    await ensureHydraClient(state)
    state.override((request, response) => {
      if (request.url !== '/oauth2/token') return false
      response.statusCode = 503
      response.end('{"error":"temporarily_unavailable","private":"response-secret"}')
      return true
    })
    const runtimeState = {
      profile: state.mode,
      internal: { hydra: state.adminUrl },
      config: { issuer: state.publicUrl },
      clients: { [state.client.clientId]: state.client },
    }
    const terminal = [],
      persisted = []
    await assert.rejects(
      verifyRuntimeHydraClient(runtimeState, verifyHydraClient, { ready: async () => {} }),
      (error) => {
        assert.equal(error.code, 'HYDRA_CLIENT_CONFLICT')
        reporter({
          write: (line) => terminal.push(line),
          persist: (line) => persisted.push(line),
        }).failure(error)
        for (const line of [...terminal, ...persisted])
          assert.doesNotMatch(line, /response-secret|fixture-client-secret|127\.0\.0\.1/)
        return true
      },
    )
    assert.equal(
      state.calls.filter(([method, path]) => method === 'POST' && path === '/admin/clients').length,
      1,
    )
  }))
test('check kinds are closed and immutable', () => {
  const error = new HydraClientCheckError('CLIENT_MISSING')
  assert.throws(() => {
    error.kind = 'CLIENT_CONFLICT'
  }, TypeError)
  assert.equal(error.kind, 'CLIENT_MISSING')
  assert.throws(() => new HydraClientCheckError('FUTURE_KIND'), TypeError)
})
test('admin and token network rejection preserve only a safe diagnostic cause', async (t) => {
  const originalFetch = globalThis.fetch
  let failedPath
  t.mock.method(globalThis, 'fetch', (url, options) => {
    if (new URL(url).pathname === failedPath)
      return Promise.reject(
        Object.assign(new Error('Bearer private-token at private-url'), {
          cause: { code: 'ECONNREFUSED', message: 'response-secret' },
        }),
      )
    return originalFetch(url, options)
  })
  for (const path of ['/admin/clients/sample-app', '/oauth2/token'])
    await fixture(async (state) => {
      if (path === '/oauth2/token') await ensureHydraClient(state)
      failedPath = path
      await assert.rejects(verifyHydraClient(state), (error) => {
        assert.equal(error.kind, 'NETWORK_FAILURE')
        assert.equal(error.cause.cause.code, 'ECONNREFUSED')
        assert.doesNotMatch(error.message, /private-token|private-url|response-secret/)
        return true
      })
      assert.equal(
        state.calls.some(([method]) => method === 'PUT'),
        false,
      )
      failedPath = undefined
    })
})
test('admin and token timeouts are network failures without request details', async () => {
  for (const path of ['/admin/clients/sample-app', '/oauth2/token'])
    await fixture(async (state) => {
      if (path === '/oauth2/token') await ensureHydraClient(state)
      state.override((request) => request.url === path)
      await assert.rejects(verifyHydraClient(state), (error) => {
        assert.equal(error.kind, 'NETWORK_FAILURE')
        assert.doesNotMatch(error.message, /127\.0\.0\.1|fixture-client-secret/)
        return true
      })
    })
})
test('generic clients reject unsafe callbacks before contacting Hydra', async () =>
  fixture(async (state) => {
    for (const redirectUri of [
      'http://localhost:18765/callback',
      'http://127.0.0.1:18765/a/../callback',
    ]) {
      const before = state.calls.length
      await assert.rejects(
        ensureHydraClient({ ...state, client: { ...state.client, redirectUri } }),
        { kind: 'INVALID_CONFIG' },
      )
      assert.equal(state.calls.length, before)
    }
  }))
test('deployment clients pin their explicit HTTPS callbacks and issuer', async (t) =>
  fixture(async (state) => {
    const originalFetch = globalThis.fetch
    t.mock.method(globalThis, 'fetch', (url, options) => {
      const address = new URL(url)
      return originalFetch(
        address.origin === 'https://issuer.example'
          ? new URL(address.pathname, state.publicUrl)
          : url,
        options,
      )
    })
    const options = {
      ...state,
      mode: 'deployment',
      publicUrl: 'https://issuer.example/',
      client: {
        ...state.client,
        redirectUri: 'https://app.example/callback?exact=yes',
        postLogoutRedirectUri: 'https://app.example/signed-out',
      },
    }
    await ensureHydraClient(options)
    await verifyHydraClient(options)
    assert.deepEqual(state.getClient().redirect_uris, [options.client.redirectUri])
    assert.deepEqual(state.getClient().post_logout_redirect_uris, [
      options.client.postLogoutRedirectUri,
    ])
    assert.equal(state.getClient().metadata.issuer, options.publicUrl)
  }))
