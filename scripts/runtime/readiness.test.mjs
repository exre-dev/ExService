import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { atomicJson, readJson } from './local-config.mjs'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { supervise, httpReady } from './local-dev.mjs'

async function httpFixture(handler, run) {
  const server = createHttpServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await run(`http://127.0.0.1:${server.address().port}`)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}
test('production readiness actually sends explicit Host and rejects the gateway 421 default host', async () => {
  const hosts = []
  await httpFixture(
    (request, response) => {
      hosts.push(request.headers.host)
      response.writeHead(request.headers.host === 'exwebsite.test' ? 200 : 421)
      response.end('ok')
    },
    async (origin) => {
      await httpReady(`${origin}/api/health`, { headers: { Host: 'exwebsite.test' }, timeout: 600 })
      assert.deepEqual(hosts, ['exwebsite.test'])
      await assert.rejects(
        httpReady(origin, { headers: { hOsT: 'foreign.test' }, timeout: 300 }),
        /APPLICATION_NOT_READY/,
      )
      assert.equal(
        hosts.slice(1).every((host) => host === 'foreign.test'),
        true,
      )
    },
  )
})
test('readiness expected receives a Response, retries mismatched JSON and accepts empty 204 bodies', async () => {
  let calls = 0,
    checks = 0
  await httpFixture(
    (_request, response) => {
      calls++
      response.setHeader('Content-Type', 'application/json')
      response.setHeader('X-Fixture', 'ready')
      response.end(JSON.stringify({ issuer: calls === 1 ? 'wrong' : 'expected' }))
    },
    async (origin) => {
      await httpReady(new URL('/issuer', origin), {
        headers: new Headers({ Host: 'exwebsite.test' }),
        timeout: 1500,
        expected: async (response) => {
          checks++
          assert.ok(response instanceof Response)
          assert.equal(response.url, `${origin}/issuer`)
          assert.equal(response.status, 200)
          assert.equal(response.redirected, false)
          assert.equal(response.headers.get('x-fixture'), 'ready')
          return (await response.json()).issuer === 'expected'
        },
      })
      assert.equal(checks, 2)
      await assert.rejects(
        httpReady(origin, {
          headers: [['Host', 'exwebsite.test']],
          timeout: 300,
          expected: () => {
            throw new Error('private expected failure')
          },
        }),
        /APPLICATION_NOT_READY/,
      )
    },
  )
  await httpFixture(
    (_request, response) => {
      response.writeHead(204)
      response.end()
    },
    async (origin) => {
      await httpReady(origin, {
        headers: { Host: 'exwebsite.test' },
        timeout: 500,
        expected: async (response) => response.status === 204 && (await response.text()) === '',
      })
    },
  )
})
test('readiness redirects stay manual with and without explicit Host', async () => {
  let redirected = 0
  await httpFixture(
    (request, response) => {
      if (request.url === '/destination') {
        redirected++
        response.end('ok')
        return
      }
      response.writeHead(302, { Location: '/destination' })
      response.end()
    },
    async (origin) => {
      for (const headers of [undefined, { Host: 'exwebsite.test' }]) {
        await assert.rejects(httpReady(origin, { headers, timeout: 300 }), /APPLICATION_NOT_READY/)
      }
      assert.equal(redirected, 0)
    },
  )
})
test('readiness bounds silent headers, stalled bodies and expected callbacks by the total deadline', async () => {
  for (const mode of ['headers', 'body', 'expected']) {
    await httpFixture(
      (_request, response) => {
        if (mode === 'headers') return
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.flushHeaders()
        if (mode === 'expected') response.end('{}')
        else response.write('{')
      },
      async (origin) => {
        const start = Date.now()
        await assert.rejects(
          httpReady(origin, {
            headers: { Host: 'exwebsite.test' },
            timeout: 180,
            expected:
              mode === 'expected' ? () => new Promise(() => {}) : (response) => response.json(),
          }),
          /APPLICATION_NOT_READY/,
        )
        assert.ok(Date.now() - start < 900, `${mode} exceeded bounded deadline`)
      },
    )
  }
})
test('readiness aborts in-flight HTTP when a mandatory child exits and never declares it ready', async () => {
  await httpFixture(
    (_request, response) => {
      response.writeHead(200)
      response.flushHeaders()
    },
    async (origin) => {
      const child = { exitCode: null, signalCode: null },
        start = Date.now()
      const timer = setTimeout(() => {
        child.exitCode = 7
      }, 80)
      try {
        await assert.rejects(
          httpReady(origin, {
            headers: { Host: 'exwebsite.test' },
            children: [{ child }],
            timeout: 1500,
            expected: (response) => response.text(),
          }),
          /APP_EXITED_DURING_START/,
        )
        assert.ok(Date.now() - start < 900)
      } finally {
        clearTimeout(timer)
      }
      await assert.rejects(
        httpReady(origin, { children: [{ child }], timeout: 500 }),
        /APP_EXITED_DURING_START/,
      )
    },
  )
})

test('readiness cancellation interrupts stalled headers and bodies before the readiness deadline', async () => {
  for (const headers of [undefined, { Host: 'exwebsite.test' }]) {
    await httpFixture((_request, response) => { response.writeHead(200); response.flushHeaders() }, async origin => {
      const controller = new AbortController(), reason = new Error('fixture cancelled'), start = Date.now()
      const timer = setTimeout(() => controller.abort(reason), 40)
      try {
        await assert.rejects(httpReady(origin, { signal: controller.signal, headers, timeout: 5000,
          expected: response => response.text() }), error => error === reason)
        assert.ok(Date.now() - start < 1000)
      } finally { clearTimeout(timer) }
    })
  }
})

// Public test-only key/certificate. Runtime never uses this pair.
const testTlsKey =
  '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC6ZDhvw6FyzyOM\ndV1bYUyo3ADXLykJm78hJvINVS9A2UwVMoKR2Ecz/oBEAo3FvoF6ODCJDjFgYk5J\nH5lDfmvPdmFN0xCQWhXZX4Dy0p3trVtq0/Y6YWWEoLAglAF/4QqaXhBas3dE9a7H\nSGYegIKAgYVeVZQ4EZqVRZ9uvK5QXk7t10UYBofPuX717Cg+H3fFtF0tKnYq6LvY\nrJm4YuDBJyZaqn/OWrR5+zatMCSVmRzpOP5ygt2CnkoVoP4BDBtx9NTnwgMO3EmN\nA93yEXGkewa8UgQ4eeYg2bgZm2UnNwXXuP5NwuWx2zR6yFxg6trYDrtW/5C9lxMA\n2cZycF/nAgMBAAECggEAE+/YYYwJXuBtKv76x2V277Donhu7Rf3UydUCmw57iXI0\nwyet86+wng0g5yVmyLoB23LbLi3IdkjNmuC4YhHJsl01Nz/WS7p3D9M5Vb/ViLC8\nUIbvlXsJgtA1RqbOKkGGAtEA6tK7dTLaSRKjaavRSbGQ9HAu9Hhdko3p6cxg0NO2\n1X3cAbWB3BuhsZMwtFTG6lCMpMu5qKYKxdjtHkQYDKfGrpn7t0lKIY+EPIyeQM0f\nrGf47pAMMYMJ37HkVNYMFe6Ktl7TdGaB3Lw2aOwPIYpcrT288dx6vRiMJBmRHjp4\nqKUDAfxRQAqhckVdUDcWK0JU/PGXVPyR2VfBjsO9sQKBgQDjHM3a1IglvHH26zvG\nN5nErviVzFhIYsMPKjvgxx/F6m7s1VH/5fWKP9lkwOI+umkuIuJ5Wwn2GFarm40l\ndARo1s6J8WhgGgu0Z/eTt8wz3VwYdStNxj07ttJOZQYN217UUgXE1lQ2Vw2EqXiY\npSe+IqM5WwR/BkYkogUzCWPFIwKBgQDSGXc11ncFn2LIMtPxRYAaZf/2OEVqwV2R\n9A6YsFwSjtspSuP92lXGbOgggpYaicWk8zJRJEqR5zQj5DYG511pRrGzJ6sCAfaN\nk410CYliYn4E3H/1fjx/aPWej8hZtsmzDUWIh+QDQ0oXD6goB9qLIVpC+n+yc+e5\no8sMRSPQbQKBgQCnRnngaZV1pdySryOxlRYupWj2fDGx7vwYWVUM89zVGxxkV6Iz\nxp4ZG3n1GZQJ+6aoko0YMROfLMH5V3KYWWE+DqjFNQdZcRWZ5NGW/VLsCGhiozon\n6JEFQFyZ3RKedircWyVgmzQfafLM+T2XwF0LT9vEzOL85BQZuzP1KT9Q3QKBgQCM\nzkhYqp0mBYXcikQExQFvr8B1sYzEWUduk9RcfIWYYml7KRfXf8ZQr5h6gUo8Cu2M\n+PhV7S6UzhDhpQaYZeLytVBOs10mgU5N3//DLskGSOAQPf779lhxQ1Spqc8qYRiY\niWJ6eChWD3jOL84Q1gKfkADANsXyQT+h6KYiWQwBmQKBgQCppj7MyvvsFD+lHagD\n0sNRwJihqfwqvp5VoPlQwI0s3+GEwn4ZfZM0v+PEZdUuYPjRVYZ+jpjRmIN4jNBj\n5F5jPkre9KNUAKCLP7Z5oJW+8C7ZKOT4/ObRvdlIkBhrvpyr6gGcR2+WC+7DaYV+\nBQehEH/osbQwQ2v2xKdlPa41pw==\n-----END PRIVATE KEY-----\n'
const testTlsCert =
  '-----BEGIN CERTIFICATE-----\nMIIDNDCCAhygAwIBAgIUFEoKPlu9opD85XMnP1q+4dc+pVQwDQYJKoZIhvcNAQEL\nBQAwGTEXMBUGA1UEAwwOZXh3ZWJzaXRlLnRlc3QwHhcNMjYxMDA0MjEzOTMxWhcN\nMzYxMDAxMjEzOTMxWjAZMRcwFQYDVQQDDA5leHdlYnNpdGUudGVzdDCCASIwDQYJ\nKoZIhvcNAQEBBQADggEPADCCAQoCggEBALpkOG/DoXLPI4x1XVthTKjcANcvKQmb\nvyEm8g1VL0DZTBUygpHYRzP+gEQCjcW+gXo4MIkOMWBiTkkfmUN+a892YU3TEJBa\nFdlfgPLSne2tW2rT9jphZYSgsCCUAX/hCppeEFqzd0T1rsdIZh6AgoCBhV5VlDgR\nmpVFn268rlBeTu3XRRgGh8+5fvXsKD4fd8W0XS0qdirou9ismbhi4MEnJlqqf85a\ntHn7Nq0wJJWZHOk4/nKC3YKeShWg/gEMG3H01OfCAw7cSY0D3fIRcaR7BrxSBDh5\n5iDZuBmbZSc3Bde4/k3C5bHbNHrIXGDq2tgOu1b/kL2XEwDZxnJwX+cCAwEAAaN0\nMHIwHQYDVR0OBBYEFDYndgjqUHSTNU0sLJZAk94u4WWkMB8GA1UdIwQYMBaAFDYn\ndgjqUHSTNU0sLJZAk94u4WWkMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0RBBgwFoIO\nZXh3ZWJzaXRlLnRlc3SHBH8AAAEwDQYJKoZIhvcNAQELBQADggEBAA7F7zdoVqnA\nUp+jNMCjOw8z/sa2jE7M79TGsnpLSbZVPz7aoZBL+jqj86+TmQx7ZA7zD7tL7t0H\nJ8as50vpWFoAXhMorMDzzU1utgRzuqeaYmo3zzBQZbrzdxgHwaanf3Eu6sQSjEuZ\nK+5u0riBoaZBJsaTNtbLUsrBAvlw6R5IESykyslY9PYfBq0BdTbn/lDjAEkgrmq1\ndAezd2QmKA2zod72trwm6vjF/3ybqY0TZ0DJuSqdacoAqRts8jyI/uyJY1330bs5\nbLKVHuVS0G9m4FcEAAo6zKblQuHnl6xXO3ng2xkOTKFAd8ET0mw/7qbxr5P1VQZU\nhzssROStr/4=\n-----END CERTIFICATE-----\n'
test('explicit Host HTTPS keeps certificate verification and accepts only an explicitly trusted test CA', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'readiness-tls-')),
    certPath = join(directory, 'cert.pem')
  writeFileSync(certPath, testTlsCert)
  const hosts = [],
    server = createHttpsServer({ key: testTlsKey, cert: testTlsCert }, (request, response) => {
      hosts.push(request.headers.host)
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ ready: true }))
    })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const url = `https://127.0.0.1:${server.address().port}/health`
    await assert.rejects(
      httpReady(url, { headers: { Host: 'exwebsite.test' }, timeout: 300 }),
      /APPLICATION_NOT_READY/,
    )
    assert.deepEqual(hosts, [])
    const source = `import { httpReady } from ${JSON.stringify(pathToFileURL(resolve('scripts/runtime/local-dev.mjs')).href)};await httpReady(${JSON.stringify(url)},{headers:{Host:'exwebsite.test'},timeout:1500,expected:async r=>r instanceof Response&&(await r.json()).ready});console.log('TRUSTED_TLS_READY '+process.version)`
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
      windowsHide: true,
      shell: false,
      env: { ...process.env, NODE_EXTRA_CA_CERTS: certPath },
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    const exit = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    assert.equal(exit, 0, output)
    assert.ok(output.includes('TRUSTED_TLS_READY'))
    assert.deepEqual(hosts, ['exwebsite.test'])
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    rmSync(directory, { recursive: true, force: true })
  }
})
async function waitFor(predicate) {
  for (let count = 0; count < 200; count++) {
    if (predicate()) return
    await delay(25)
  }
  throw new Error('Fixture timed out')
}
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'supervisor-')),
    events = [],
    all = []
  const lock = {
    record: {
      runId: randomUUID(),
      identity: { pid: process.pid },
      mode: 'dev',
      fingerprint: 'target',
    },
    update(extra) {
      Object.assign(this.record, extra)
    },
    release() {
      events.push('release')
    },
  }
  const spawnChild = async (specification) => {
    let finish
    const owned = {
      specification,
      child: { exitCode: null, signalCode: null },
      identity: { pid: all.length + 1 },
      exited: new Promise((resolve) => {
        finish = resolve
      }),
      finish: (result) => finish(result),
    }
    all.push(owned)
    events.push(`start:${specification.name}`)
    return owned
  }
  const stopChildren = async (children) => {
    for (const owned of children) {
      events.push(`stop:${owned.specification.name}`)
      owned.child.exitCode = 0
      owned.finish({ code: 0 })
    }
  }
  const state = () =>
    existsSync(join(directory, 'run.json'))
      ? JSON.parse(readFileSync(join(directory, 'run.json'), 'utf8')).state
      : undefined
  const request = (action, extra = {}) =>
    atomicJson(join(directory, 'control-request.json'), {
      action,
      mode: 'dev',
      fingerprint: 'target',
      runId: lock.record.runId,
      requestId: randomUUID(),
      ...extra,
    })
  const options = {
    mode: 'dev',
    fingerprint: 'target',
    directory,
    controlDirectory: directory,
    lock,
    specifications: ['server', 'web'].map((name) => ({ name })),
    spawnChild,
    stopChildren,
    readiness: async () => {},
    onLog() {},
    banner: 'FIXTURE_READY',
    pollInterval: 10,
  }
  return { directory, events, all, options, state, request, lock }
}
test('unexpected mandatory child exit cleans all siblings', async () => {
  const f = fixture(),
    running = supervise(f.options)
  try {
    await waitFor(() => f.state() === 'ready')
    f.all[1].child.exitCode = 7
    f.all[1].finish({ code: 7 })
    await assert.rejects(running, /APP_WEB_EXITED_7/)
    assert.equal(
      f.all.every((child) => child.child.exitCode === 0),
      true,
    )
    assert.equal(
      f.events.some((value) => value.includes('independent')),
      false,
    )
    assert.equal(f.state(), 'stopped')
  } finally {
    rmSync(f.directory, { recursive: true, force: true })
  }
})
test('supervisor renders readiness only after successful checks and suppresses it on failure', async () => {
  const f = fixture(),
    notices = []
  const running = supervise({
    ...f.options,
    readiness: async () => {
      notices.push('checked')
    },
    onReady: () => {
      assert.equal(f.state(), 'ready')
      notices.push('displayed')
    },
  })
  try {
    await waitFor(() => f.state() === 'ready')
    assert.deepEqual(notices, ['checked', 'displayed'])
    f.request('stop')
    await running
  } finally {
    f.request('stop')
    await running
    rmSync(f.directory, { recursive: true, force: true })
  }
  const failed = fixture()
  try {
    await assert.rejects(
      supervise({
        ...failed.options,
        readiness: async () => {
          throw new Error('not ready')
        },
        onReady: () => notices.push('incorrectly displayed'),
      }),
      /not ready/,
    )
    assert.deepEqual(notices, ['checked', 'displayed'])
  } finally {
    rmSync(failed.directory, { recursive: true, force: true })
  }
})
test('startup failure clears partially spawned children before releasing application ownership', async () => {
  const f = fixture()
  let starts = 0
  try {
    await assert.rejects(
      supervise({
        ...f.options,
        spawnChild: async (spec) => {
          starts++
          if (starts === 2) throw new Error('spawn failure')
          return f.options.spawnChild(spec)
        },
      }),
      /spawn failure/,
    )
    assert.deepEqual(f.events, ['start:server', 'stop:server', 'release'])
    assert.equal(f.state(), 'stopped')
  } finally {
    rmSync(f.directory, { recursive: true, force: true })
  }
})
test('failed child cleanup retains application ownership and the original child identities', async () => {
  const f = fixture(),
    running = supervise({
      ...f.options,
      stopChildren: async () => {
        throw new Error('cleanup failed')
      },
    })
  try {
    await waitFor(() => f.state() === 'ready')
    f.request('stop')
    await assert.rejects(running, /cleanup failed/)
    assert.equal(f.events.includes('release'), false)
    assert.equal(f.lock.record.cleanupRequired, true)
    const retained = readJson(join(f.directory, 'run.json'))
    assert.equal(retained.state, 'cleanup-failed')
    assert.deepEqual(
      retained.children.map((child) => child.identity),
      f.all.map((child) => child.identity),
    )
  } finally {
    rmSync(f.directory, { recursive: true, force: true })
  }
})

test('supervisor keeps signal handlers installed throughout asynchronous child cleanup', async () => {
  const f = fixture(),
    before = ['SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal))
  let finish
  const cleanup = new Promise((resolve) => {
    finish = resolve
  })
  const running = supervise({
    ...f.options,
    stopChildren: async (children) => {
      await cleanup
      await f.options.stopChildren(children)
    },
  })
  try {
    await waitFor(() => f.state() === 'ready')
    f.request('stop')
    await waitFor(() => f.state() === 'stopping')
    assert.deepEqual(
      ['SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal)),
      before.map((count) => count + 1),
    )
    finish()
    await running
    assert.deepEqual(
      ['SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal)),
      before,
    )
    assert.equal(f.state(), 'stopped')
  } finally {
    finish()
    await running.catch(() => {})
    rmSync(f.directory, { recursive: true, force: true })
  }
})
