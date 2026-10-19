import test from 'node:test'
import assert from 'node:assert/strict'
import {
  planRetiredTargets,
  planOutboxRow,
  cleanRetiredDatabase,
  executeRetirement,
  retiredConfiguration,
  main,
} from './retire-outline.mjs'

test('exact retired client matching preserves every other client and target field', () => {
  const keep = {
    clientId: 'another-app',
    hydraSid: 'keep',
    sessionId: 'original',
    deliveryEventId: 'event',
  }
  assert.deepEqual(
    planRetiredTargets([
      { clientId: 'ex-outline', hydraSid: 'retired' },
      keep,
      { clientId: 'ex-outline-extra', hydraSid: 'also-keep' },
    ]).remaining,
    [keep, { clientId: 'ex-outline-extra', hydraSid: 'also-keep' }],
  )
  const row = {
    event_id: 'original',
    target_bindings: JSON.stringify([{ clientId: 'ex-outline', hydraSid: 'old' }, keep]),
    delivered_targets: JSON.stringify(['outline:ex-outline:old', 'hydra:another-app:keep']),
    attempts: 7,
    completed_at: null,
    next_attempt_at: 123,
  }
  assert.deepEqual(planOutboxRow(row), {
    ...row,
    target_bindings: JSON.stringify([keep]),
    delivered_targets: JSON.stringify(['hydra:another-app:keep']),
  })
  assert.equal(
    planOutboxRow({
      ...row,
      target_bindings: JSON.stringify([{ clientId: 'ex-outline', hydraSid: 'old' }]),
      delivered_targets: '[]',
    }),
    null,
  )
})
test('malformed or unaccounted snapshot evidence is never guessed', () => {
  for (const target_bindings of ['bad', '{}', '[null]', '[{"clientId":"ex-outline"}]'])
    assert.throws(() => planOutboxRow({ target_bindings, delivered_targets: '[]' }), /SNAPSHOT/)
  assert.throws(
    () =>
      planOutboxRow({
        target_bindings: '[{"clientId":"another-app","hydraSid":"keep"}]',
        delivered_targets: '["outline:ex-outline:unknown"]',
      }),
    /SNAPSHOT/,
  )
})
test('wrong database and a bad later snapshot roll back all Website mutations', async () => {
  for (const wrong of [true, false]) {
    const calls = []
    const db = {
      query: async (sql) => {
        calls.push(sql)
        return {
          rows: sql.includes('current_database')
            ? [{ name: wrong ? 'other' : 'exre' }]
            : sql.includes('SELECT event_id')
              ? [{ event_id: 'bad', target_bindings: 'bad', delivered_targets: '[]' }]
              : [],
        }
      },
    }
    await assert.rejects(cleanRetiredDatabase(db), wrong ? /DATABASE/ : /SNAPSHOT/)
    assert.equal(calls.at(-1), 'ROLLBACK')
    assert.equal(
      calls.some((sql) => /^(DELETE|UPDATE)/.test(sql)),
      false,
    )
  }
})
test('ownership mismatch refuses all side effects and retained resource drift cannot refresh proof', async () => {
  const proof = {
    workspace: 'fixture',
    preserved: {
      postgres: { id: 'original-pg', digest: 'original' },
      hydra: { id: 'original-hydra', digest: 'original' },
    },
    retired: {},
  }
  const operations = []
  await assert.rejects(
    executeRetirement({
      proof,
      workspace: 'other',
      inspect: async () => proof,
      steps: { stop: async () => operations.push('stop') },
    }),
    /OWNERSHIP/,
  )
  assert.deepEqual(operations, [])
  const inspect = async () => ({
    ...proof,
    preserved: { ...proof.preserved, postgres: { id: 'same-name-new-pg', digest: 'other' } },
  })
  await assert.rejects(
    executeRetirement({
      proof,
      workspace: 'fixture',
      inspect,
      steps: { stop: async () => operations.push('stop') },
    }),
    /PROOF/,
  )
  assert.deepEqual(operations, [])
})
test('retirement step ledger is idempotent and always rechecks the original preserved proof', async () => {
  const proof = {
    workspace: 'fixture',
    preserved: { postgres: { id: 'pg', digest: 'same' }, hydra: { id: 'hydra', digest: 'same' } },
    retired: {},
  }
  const done = [],
    calls = [],
    steps = Object.fromEntries(
      ['stop', 'clients', 'website', 'resources', 'configuration'].map((name) => [
        name,
        async () => calls.push(name),
      ]),
    )
  await executeRetirement({
    proof,
    workspace: 'fixture',
    inspect: async () => proof,
    steps,
    done,
    persist: async (value) => {
      done.splice(0, done.length, ...value)
    },
  })
  await executeRetirement({
    proof,
    workspace: 'fixture',
    inspect: async () => proof,
    steps,
    done,
    persist: async () => {},
  })
  assert.deepEqual(calls, ['stop', 'clients', 'website', 'resources', 'configuration'])
})

test(
  'isolated PostgreSQL preserves Website data and mixed event metadata; malformed snapshots roll back',
  { timeout: 120000 },
  async () => {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
    const { default: pg } = await import('pg')
    const container = await new PostgreSqlContainer('postgres:18.4').withDatabase('exre').start()
    const db = new pg.Client({ connectionString: container.getConnectionUri() })
    try {
      await db.connect()
      await db.query(`CREATE TABLE auth_oidc_flows(client_id text, marker text);
   CREATE TABLE auth_oidc_bindings(client_id text, marker text);
   CREATE TABLE auth_identity_outbox(event_id text primary key,target_bindings text,delivered_targets text,attempts int,next_attempt_at bigint,completed_at bigint);
   CREATE TABLE website_accounts(id text primary key,secret text);
   INSERT INTO website_accounts VALUES('keep-account','keep-original');
   INSERT INTO auth_oidc_flows VALUES('ex-outline','retired'),('another-app','keep');
   INSERT INTO auth_oidc_bindings VALUES('ex-outline-local','retired'),('another-app','keep')`)
      const keep = {
        clientId: 'another-app',
        hydraSid: 'keep',
        sessionId: 'old-session',
        deliveryEventId: 'original-event',
      }
      const old = { clientId: 'ex-outline', hydraSid: 'retired' }
      await db.query(
        'INSERT INTO auth_identity_outbox VALUES($1,$2,$3,7,123,NULL),($4,$5,$6,3,987,456)',
        [
          'mixed',
          JSON.stringify([old, keep]),
          JSON.stringify([
            'hydra:ex-outline:retired',
            'outline:ex-outline:retired',
            'hydra:another-app:keep',
          ]),
          'retired-only',
          JSON.stringify([old]),
          '[]',
        ],
      )
      await db.query("INSERT INTO auth_identity_outbox VALUES('broken','not-json','[]',4,1,NULL)")
      await assert.rejects(cleanRetiredDatabase(db), /SNAPSHOT/)
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM auth_oidc_flows WHERE client_id='ex-outline'",
          )
        ).rows[0].n,
        1,
      )
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM auth_identity_outbox')).rows[0].n,
        3,
      )
      await db.query("DELETE FROM auth_identity_outbox WHERE event_id='broken'")
      const before = await db.query('SELECT * FROM website_accounts')
      assert.deepEqual(await cleanRetiredDatabase(db), { removedEvents: 1, changedEvents: 1 })
      const row = (await db.query('SELECT * FROM auth_identity_outbox')).rows[0]
      assert.deepEqual(
        {
          ...row,
          target_bindings: JSON.parse(row.target_bindings),
          delivered_targets: JSON.parse(row.delivered_targets),
        },
        {
          event_id: 'mixed',
          target_bindings: [keep],
          delivered_targets: ['hydra:another-app:keep'],
          attempts: 7,
          next_attempt_at: '123',
          completed_at: null,
        },
      )
      assert.deepEqual((await db.query('SELECT * FROM website_accounts')).rows, before.rows)
      assert.deepEqual((await db.query('SELECT client_id FROM auth_oidc_flows')).rows, [
        { client_id: 'another-app' },
      ])
      assert.deepEqual((await db.query('SELECT client_id FROM auth_oidc_bindings')).rows, [
        { client_id: 'another-app' },
      ])
      assert.deepEqual(await cleanRetiredDatabase(db), { removedEvents: 0, changedEvents: 0 })
    } finally {
      await db.end()
      await container.stop()
    }
  },
)

test('retired configuration removes only confirmed retired keys and keeps active and unknown values', () => {
  const before = {
    RUNTIME_PROFILE: 'local',
    DATABASE_PASSWORD: 'preserve',
    HYDRA_SYSTEM_SECRET: 'keep',
    IDENTITY_FLOW_KEY: 'original',
    OUTLINE_SECRET_KEY: 'retired',
    OUTLINE_FUTURE_SETTING: 'unknown-preserve',
    LOCAL_REDIS_PORT: '6379',
    IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({
      'ex-outline': { old: 'retired' },
      'another-app': { hydraAdminUrl: 'http://127.0.0.1:4445/' },
    }),
  }
  const result = retiredConfiguration(before)
  assert.equal(result.DATABASE_PASSWORD, 'preserve')
  assert.equal(result.HYDRA_SYSTEM_SECRET, 'keep')
  assert.equal(result.IDENTITY_FLOW_KEY, 'original')
  assert.equal(result.OUTLINE_FUTURE_SETTING, 'unknown-preserve')
  assert.equal(result.OUTLINE_SECRET_KEY, undefined)
  assert.equal(result.LOCAL_REDIS_PORT, undefined)
  assert.deepEqual(JSON.parse(result.IDENTITY_OUTBOX_TARGETS_JSON), {
    'another-app': { hydraAdminUrl: 'http://127.0.0.1:4445/' },
  })
  assert.equal(before.OUTLINE_SECRET_KEY, 'retired')
})

test('retirement-only normalization preserves original Outline URL credentials until explicit cleanup', async () => {
  const { convertValues } = await import('./convert.mjs')
  const original = {
    DATABASE_URL: 'postgres://site:original-site@127.0.0.1:17432/exre',
    HYDRA_DATABASE_URL: 'postgres://hydra:original-hydra@127.0.0.1:17432/hydra',
    OUTLINE_DATABASE_URL:
      'postgres://outline:original-docs@127.0.0.1:17432/outline?sslmode=disable',
  }
  assert.equal(convertValues(original).OUTLINE_DATABASE_URL, original.OUTLINE_DATABASE_URL)
  const normalized = convertValues(original, { includeRetired: true })
  assert.equal(normalized.OUTLINE_DATABASE_PASSWORD, 'original-docs')
  assert.equal(normalized.OUTLINE_DATABASE_PORT, '17432')
  const cleaned = retiredConfiguration(normalized)
  assert.equal(cleaned.DATABASE_PASSWORD, 'original-site')
  assert.equal(cleaned.HYDRA_DATABASE_PASSWORD, 'original-hydra')
  assert.equal(
    Object.keys(cleaned).some((key) => key.startsWith('OUTLINE_DATABASE_')),
    false,
  )
})

test('failed Hydra removal is retried without recording success or running Website cleanup', async () => {
  const proof = {
    workspace: 'fixture',
    preserved: { postgres: { id: 'pg', digest: 'same' }, hydra: { id: 'hydra', digest: 'same' } },
    retired: {},
  }
  let done = [],
    fail = true
  const calls = []
  const steps = {
    stop: async () => calls.push('stop'),
    clients: async () => {
      calls.push('clients')
      if (fail) throw Error('HYDRA_UNAVAILABLE')
    },
    website: async () => calls.push('website'),
    resources: async () => calls.push('resources'),
    configuration: async () => calls.push('configuration'),
  }
  const options = {
    proof,
    workspace: 'fixture',
    inspect: async () => proof,
    steps,
    persist: async (value) => {
      done = [...value]
    },
  }
  await assert.rejects(executeRetirement({ ...options, done }), /HYDRA_UNAVAILABLE/)
  assert.deepEqual(done, ['stop'])
  assert.deepEqual(calls, ['stop', 'clients'])
  fail = false
  await executeRetirement({ ...options, done })
  assert.deepEqual(calls, ['stop', 'clients', 'clients', 'website', 'resources', 'configuration'])
})

test('apply CLI reports restart/readiness pending and distinct exit status after maintenance succeeds', async () => {
  const lines = [],
    completed = ['stop', 'clients', 'website', 'resources', 'configuration'],
    plan = { version: 1 }
  const result = await main(['--apply'], {
    workspace: 'fixture',
    readPlan: (path) => {
      assert.ok(path.endsWith('outline-retirement-plan.json'))
      return plan
    },
    apply: async (received) => {
      assert.equal(received, plan)
      return { completed }
    },
    write: (line) => lines.push(line),
  })
  assert.deepEqual(result, {
    status: 'maintenance-applied-awaiting-restart-and-readiness',
    appliedSteps: completed,
    pendingSteps: ['restart', 'readiness'],
    exitCode: 2,
  })
  assert.deepEqual(JSON.parse(lines[0]), result)
  assert.equal(result.appliedSteps.includes('restart'), false)
  assert.equal(result.appliedSteps.includes('readiness'), false)
})
import * as retirement from './retire-outline.mjs'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { digest } from './local-config.mjs'
import { serializeEnvironment } from './convert.mjs'
import { containerProof } from './container-proof.mjs'
import { readRuntimeConfiguration, environmentFile } from './settings.mjs'
import { deploymentBinding } from './deployment.mjs'
import { createHash } from 'node:crypto'

function applyFixture(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'retirement-apply-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const values = {
    RUNTIME_PROFILE: 'local',
    LOCAL_POSTGRES_PORT: '17432',
    AUTH_CODE_HMAC_KEY: 'a'.repeat(64),
    HYDRA_SYSTEM_SECRET: 'b'.repeat(64),
    IDENTITY_FLOW_KEY: 'c'.repeat(64),
    IDENTITY_BOOTSTRAP_KEY: 'd'.repeat(64),
    POSTGRES_USER: 'admin',
    POSTGRES_PASSWORD: 'unchanged admin',
    OUTLINE_OIDC_CLIENT_SECRET: 'old client',
    IDENTITY_DELIVERY_KEY: 'e'.repeat(64),
  }
  for (const [prefix, name, user, host] of [
    ['DATABASE', 'exre', 'site', 'website-cluster'],
    ['HYDRA_DATABASE', 'hydra', 'hydra', 'hydra-cluster'],
    ['OUTLINE_DATABASE', 'outline', 'outline', 'outline-cluster'],
  ])
    Object.assign(
      values,
      Object.fromEntries(
        Object.entries({
          HOST: host,
          NAME: name,
          USER: user,
          PASSWORD: `original ${name}`,
          SSLMODE: 'verify-full',
          SSLROOTCERT: 'C:/original/cert.pem',
          CONNECT_TIMEOUT: '9',
          OPTIONS: '-c statement_timeout=7000',
        }).map(([key, value]) => [`${prefix}_${key}`, value]),
      ),
    )
  mkdirSync(join(workspace, '.local/runtime'), { recursive: true })
  const source = serializeEnvironment(values)
  writeFileSync(join(workspace, '.env.local'), source)
  assert.equal(typeof retirement.retirementDatabaseTargets, 'function')
  const targets = retirement.retirementDatabaseTargets(values),
    containers = Object.fromEntries(
      ['postgres', 'hydra'].map((name) => [
        name,
        {
          Id: `${name}-exact`,
          Image: `${name}-image`,
          Config: { Labels: { 'com.docker.compose.service': name } },
          HostConfig: { Dns: null, DnsOptions: null, DnsSearch: null, Privileged: false },
          Mounts: [
            { Type: 'bind', Source: `/${name}/b`, Destination: '/b', Mode: 'rw', RW: true },
            { Type: 'bind', Source: `/${name}/a`, Destination: '/a', Mode: 'ro', RW: false },
          ],
        },
      ]),
    )
  const preserved = Object.fromEntries(
    Object.entries(containers).map(([name, item]) => [name, containerProof(item)]),
  )
  const identities = {
    exre: { name: 'exre', user: 'site', owner: 'site', oid: '123' },
    hydra: { name: 'hydra', user: 'hydra', owner: 'hydra', oid: '124' },
    outline: { name: 'outline', user: 'outline', owner: 'outline', oid: '125' },
    postgres: { name: 'postgres', user: 'admin', owner: 'postgres-owner', oid: '126' },
  }
  const databases = Object.fromEntries(
    ['exre', 'hydra', 'outline'].map((name) => [
      name,
      { ...identities[name], targetFingerprint: digest(targets[name]) },
    ]),
  )
  const calls = [],
    mutations = [],
    dockerMutations = []
  const plan = {
    version: 1,
    workspace: resolve(workspace),
    sourceFingerprint: digest(source),
    receiptFingerprint: null,
    preserved,
    databases,
    outlineAdmin: { ...identities.postgres, targetFingerprint: digest(targets.outlineAdmin) },
    retired: { redis: null, storage: join(workspace, '.local/attachments') },
    completed: ['stop', 'clients', 'resources', 'configuration'],
    progress: {},
  }
  let mismatchPurpose,
    mismatchField = 'user'
  const connect = async (url, options = {}) => {
    calls.push({ url, purpose: options.purpose })
    const name = new URL(url).pathname.slice(1),
      identity = { ...identities[name] }
    if (options.purpose === mismatchPurpose) identity[mismatchField] = 'mismatched-proof'
    return {
      query: async (sql, args) => {
        if (/^(DELETE|UPDATE|DROP)/.test(sql)) mutations.push({ url, sql, args })
        if (sql.includes('current_database'))
          return { rows: [{ name: identity.name, owner: identity.user }] }
        if (sql.includes('FROM pg_database')) {
          const selected = (args?.[0] ?? name) === name ? identity : identities[args?.[0]]
          return { rows: selected ? [{ owner: selected.owner, oid: selected.oid }] : [] }
        }
        return { rows: [] }
      },
      end: async () => {},
    }
  }
  const dockerCall = (args) => {
    calls.push({ docker: args })
    if (args[0] === 'inspect') {
      const item = Object.entries(containers).find(([name]) => `${name}-exact` === args[1])?.[1]
      assert.ok(item)
      return JSON.stringify([item])
    }
    if (args[0] === 'ps')
      return Object.keys(containers)
        .map((name) => `${name}-exact`)
        .join('\n')
    if (args[0] === 'rm') {
      dockerMutations.push(args)
      return ''
    }
    throw Error('unexpected Docker mutation')
  }
  const acquire = () => {
    calls.push({ lock: true })
    return { release() {} }
  }
  return {
    workspace,
    values,
    targets,
    identities,
    containers,
    plan,
    calls,
    mutations,
    dockerMutations,
    connect,
    dockerCall,
    acquire,
    applicationAcquire: acquire,
    mismatch: (purpose, field = 'user') => {
      mismatchPurpose = purpose
      mismatchField = field
    },
  }
}

function saveApplyProofEvidence(f) {
  const directory = join(f.workspace, '.local/runtime'),
    dependencies = join(directory, 'dependencies.json'),
    path = join(directory, 'outline-retirement-plan.json')
  const record = {
    version: 1,
    project: 'exwebsite-runtime',
    proofs: [
      ...Object.values(f.plan.preserved),
      ...(f.plan.retired.redis ? [f.plan.retired.redis] : []),
    ],
    newlyStarted: [],
  }
  writeFileSync(dependencies, JSON.stringify(record))
  f.plan.dependencyFingerprint = digest(record)
  writeFileSync(path, JSON.stringify(f.plan))
  return {
    dependencies,
    path,
    dependencyBytes: readFileSync(dependencies),
    planBytes: readFileSync(path),
  }
}

test('apply rechecks original preserved proofs despite Docker mount and unset DNS presentation changes', async (t) => {
  const f = applyFixture(t),
    original = structuredClone(f.plan.preserved)
  saveApplyProofEvidence(f)
  for (const item of Object.values(f.containers)) {
    item.Mounts.reverse()
    Object.assign(item.HostConfig, { Dns: [], DnsOptions: [], DnsSearch: [] })
  }
  await retirement.applyRetirementPlan(f.plan, f)
  assert.ok(f.mutations.some((call) => call.sql.startsWith('DELETE')))
  assert.deepEqual(f.dockerMutations, [])
  assert.deepEqual(f.plan.preserved, original)
  assert.deepEqual(
    JSON.parse(
      readFileSync(join(f.workspace, '.local/runtime/outline-retirement-plan.json'), 'utf8'),
    ).preserved,
    original,
  )
})

test('apply refuses each preserved container drift before any mutation and leaves proofs and plan unchanged', async (t) => {
  const changes = [
    [
      'Dns',
      (item) => {
        item.HostConfig.Dns = ['1.1.1.1']
      },
    ],
    [
      'DnsOptions',
      (item) => {
        item.HostConfig.DnsOptions = ['ndots:2']
      },
    ],
    [
      'DnsSearch',
      (item) => {
        item.HostConfig.DnsSearch = ['example.test']
      },
    ],
    [
      'HostConfig',
      (item) => {
        item.HostConfig.Privileged = true
      },
    ],
    [
      'Config',
      (item) => {
        item.Config.WorkingDir = '/changed'
      },
    ],
    [
      'Image',
      (item) => {
        item.Image = 'replacement-image'
      },
    ],
    [
      'Id',
      (item) => {
        item.Id = 'replacement-exact'
      },
    ],
  ]
  const mountFields = Object.keys(applyFixture(t).containers.postgres.Mounts[0])
  for (const key of mountFields)
    changes.push([
      `Mounts.${key}`,
      (item) => {
        item.Mounts[0][key] =
          typeof item.Mounts[0][key] === 'boolean' ? !item.Mounts[0][key] : 'changed'
      },
    ])
  for (const [name, change] of changes) {
    const f = applyFixture(t),
      evidence = saveApplyProofEvidence(f),
      original = structuredClone(f.plan.preserved)
    change(f.containers.postgres)
    await assert.rejects(
      retirement.applyRetirementPlan(f.plan, f),
      /RETIREMENT_PRESERVED_PROOF_CHANGED/,
      name,
    )
    assert.deepEqual(f.mutations, [], name)
    assert.deepEqual(f.dockerMutations, [], name)
    assert.deepEqual(f.plan.preserved, original, name)
    assert.deepEqual(readFileSync(evidence.dependencies), evidence.dependencyBytes, name)
    assert.deepEqual(readFileSync(evidence.path), evidence.planBytes, name)
  }
})

test('apply rejects Redis proof drift before Docker rm or any retirement mutation', async (t) => {
  const f = applyFixture(t),
    redis = {
      Id: 'redis-exact',
      Image: 'redis-image',
      Config: { Labels: { 'com.docker.compose.service': 'redis' } },
      HostConfig: { Dns: null, DnsOptions: null, DnsSearch: null },
      Mounts: [],
    }
  f.containers.redis = redis
  f.plan.retired = {
    ...f.plan.retired,
    redis: containerProof(redis),
    redisMounts: [],
    redisVolumes: [],
  }
  f.plan.completed = ['stop', 'clients', 'website']
  const evidence = saveApplyProofEvidence(f)
  redis.Image = 'replacement-image'
  await assert.rejects(retirement.applyRetirementPlan(f.plan, f), /RETIREMENT_REDIS_PROOF_CHANGED/)
  assert.deepEqual(f.mutations, [])
  assert.deepEqual(f.dockerMutations, [])
  assert.deepEqual(readFileSync(evidence.dependencies), evidence.dependencyBytes)
  assert.deepEqual(readFileSync(evidence.path), evidence.planBytes)
})

test('apply writes Website only on the verified nondefault cluster and preserves original connection options', async (t) => {
  const f = applyFixture(t)
  await retirement.applyRetirementPlan(f.plan, f)
  const mutations = f.mutations.filter((call) => call.sql.startsWith('DELETE'))
  assert.equal(mutations.length, 2)
  for (const call of mutations) {
    const url = new URL(call.url)
    assert.equal(url.hostname, 'website-cluster')
    assert.equal(url.port, '17432')
    assert.equal(url.searchParams.get('sslmode'), 'verify-full')
    assert.equal(url.searchParams.get('options'), '-c statement_timeout=7000')
  }
  assert.equal(f.calls.filter((call) => call.purpose === 'website-mutation').length, 1)
})
test('apply verifies its Website mutation connection identity before deleting anything', async (t) => {
  for (const field of ['user', 'owner', 'oid', 'name']) {
    const f = applyFixture(t)
    f.mismatch('website-mutation', field)
    await assert.rejects(retirement.applyRetirementPlan(f.plan, f), /DATABASE_IDENTITY_CONFLICT/)
    assert.deepEqual(f.mutations, [])
  }
})
test('apply Outline DROP uses its verified cluster and original TLS semantics rather than the Website cluster', async (t) => {
  const f = applyFixture(t)
  f.plan.completed = ['stop', 'clients', 'website', 'configuration']
  f.plan.progress = { storage: true }
  const old = {
    version: 1,
    project: 'exwebsite-runtime',
    proofs: Object.values(f.plan.preserved),
    newlyStarted: [],
  }
  mkdirSync(join(f.workspace, '.local/runtime'), { recursive: true })
  writeFileSync(join(f.workspace, '.local/runtime/dependencies.json'), JSON.stringify(old))
  f.plan.dependencyFingerprint = digest(old)
  await retirement.applyRetirementPlan(f.plan, f)
  const drop = f.mutations.find((call) => call.sql === 'DROP DATABASE outline')
  assert.ok(drop)
  const admin = new URL(drop.url),
    original = new URL(f.targets.outline)
  assert.equal(admin.hostname, 'outline-cluster')
  assert.equal(admin.port, '17432')
  assert.equal(admin.pathname, '/postgres')
  assert.equal(admin.username, 'admin')
  assert.equal(admin.search, original.search)
  assert.equal(
    f.mutations.some((call) => new URL(call.url).hostname === 'website-cluster'),
    false,
  )
})
test('apply refuses a mismatched Outline admin mutation identity before DROP', async (t) => {
  const f = applyFixture(t)
  f.plan.completed = ['stop', 'clients', 'website', 'configuration']
  f.plan.progress = { storage: true }
  f.mismatch('outline-admin-mutation')
  await assert.rejects(retirement.applyRetirementPlan(f.plan, f), /DATABASE_IDENTITY_CONFLICT/)
  assert.deepEqual(f.mutations, [])
})
test('storage deletion rejects a junction at .local itself and leaves outside bytes intact', async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'retirement-junction-')),
    outside = mkdtempSync(join(tmpdir(), 'retirement-shared-'))
  t.after(() => {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })
  mkdirSync(join(outside, 'attachments'))
  writeFileSync(join(outside, 'attachments/keep'), 'shared bytes')
  symlinkSync(outside, join(workspace, '.local'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal(typeof retirement.removeRetiredStorage, 'function')
  let removed = false
  assert.throws(
    () =>
      retirement.removeRetiredStorage(workspace, join(workspace, '.local/attachments'), {
        remove: () => {
          removed = true
        },
      }),
    /STORAGE_OWNERSHIP/,
  )
  assert.equal(removed, false)
  assert.equal(readFileSync(join(outside, 'attachments/keep'), 'utf8'), 'shared bytes')
})
test('apply rejects missing/replaced planned pins before any lock, client, or database mutation', async (t) => {
  for (const mode of ['missing', 'replaced']) {
    const f = applyFixture(t),
      path = join(f.workspace, '.local/runtime-deployment/identity.json')
    mkdirSync(join(f.workspace, '.local/runtime-deployment'), { recursive: true })
    const original = { version: 1, issuer: 'original' }
    f.plan.receiptFingerprint = digest(original)
    if (mode === 'replaced') writeFileSync(path, JSON.stringify({ version: 1, issuer: 'other' }))
    await assert.rejects(retirement.applyRetirementPlan(f.plan, f), /RECEIPT/)
    assert.deepEqual(f.calls, [])
    assert.deepEqual(f.mutations, [])
  }
})
test('apply accepts only recorded v1-to-v2 continuation with the matching original backup and expected projection', async (t) => {
  const f = applyFixture(t),
    directory = join(f.workspace, '.local/runtime-deployment'),
    path = join(directory, 'identity.json')
  mkdirSync(directory, { recursive: true })
  const original = { version: 1, issuer: 'original' },
    next = deploymentBinding(
      readRuntimeConfiguration({
        workspace: f.workspace,
        inherited: {},
        sourceValues: retiredConfiguration(f.values),
      }),
    )
  f.plan.receiptFingerprint = digest(original)
  f.plan.completed = ['stop', 'clients', 'website', 'resources']
  writeFileSync(path, JSON.stringify(next))
  writeFileSync(`${path}.v1-backup`, JSON.stringify(original))
  await assert.rejects(retirement.applyRetirementPlan(f.plan, f), /RECEIPT/)
  assert.deepEqual(f.calls, [])
  f.plan.progress.receiptConversion = {
    fromFingerprint: digest(original),
    toFingerprint: digest(next),
  }
  await retirement.applyRetirementPlan(f.plan, f)
  writeFileSync(`${path}.v1-backup`, JSON.stringify({ version: 1, issuer: 'wrong' }))
  f.calls.length = 0
  await assert.rejects(retirement.applyRetirementPlan(f.plan, f), /RECEIPT/)
  assert.deepEqual(f.calls, [])
})

test('storage deletion permits a real checkout child while preserving its sibling', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'retirement-storage-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const target = join(workspace, '.local/attachments'),
    sibling = join(workspace, '.local/keep')
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'old'), 'retired')
  writeFileSync(sibling, 'keep')
  retirement.removeRetiredStorage(workspace, target)
  assert.equal(existsSync(target), false)
  assert.equal(readFileSync(sibling, 'utf8'), 'keep')
})

test('apply rejects conflicting original env bytes before locks or mutations with or without configuration intent', async (t) => {
  for (const withIntent of [false, true]) {
    const f = applyFixture(t),
      source = join(f.workspace, '.env.local'),
      backup = join(f.workspace, '.local/runtime/outline-retirement-original.env')
    f.plan.completed = ['stop', 'clients', 'website', 'resources']
    if (withIntent)
      f.plan.progress.configurationIntent = digest(
        serializeEnvironment(retiredConfiguration(f.values)),
      )
    const original = readFileSync(source),
      conflict = Buffer.from(original.toString().replace('a'.repeat(64), 'f'.repeat(64)))
    writeFileSync(backup, conflict)
    await assert.rejects(
      retirement.applyRetirementPlan(f.plan, f),
      /RETIREMENT_ORIGINAL_ENV_CONFLICT/,
    )
    assert.deepEqual(readFileSync(source), original)
    assert.deepEqual(readFileSync(backup), conflict)
    assert.deepEqual(f.calls, [])
    assert.deepEqual(f.mutations, [])
    assert.equal(existsSync(`${source}.retirement.tmp`), false)
  }
})

test('apply accepts matching original env bytes after interrupted configuration and preserves active values', async (t) => {
  for (const replaced of [false, true]) {
    const f = applyFixture(t),
      source = join(f.workspace, '.env.local'),
      backup = join(f.workspace, '.local/runtime/outline-retirement-original.env')
    const original = readFileSync(source),
      converted = serializeEnvironment(retiredConfiguration(environmentFile(source)))
    f.plan.completed = ['stop', 'clients', 'website', 'resources']
    f.plan.progress.configurationIntent = digest(converted)
    writeFileSync(backup, original)
    if (replaced) writeFileSync(source, converted)
    await retirement.applyRetirementPlan(f.plan, f)
    assert.deepEqual(readFileSync(backup), original)
    assert.equal(readFileSync(source, 'utf8'), converted)
    assert.deepEqual(f.mutations, [])
  }
})

test('original env backup proof compares raw bytes rather than lossy UTF-8 decoding', async (t) => {
  const f = applyFixture(t),
    source = join(f.workspace, '.env.local'),
    backup = join(f.workspace, '.local/runtime/outline-retirement-original.env')
  const original = Buffer.concat([readFileSync(source), Buffer.from('# original \uFFFD\n')])
  const conflicting = Buffer.concat([
    original.subarray(0, original.length - 4),
    Buffer.from([0xff, 0x0a]),
  ])
  assert.equal(conflicting.toString('utf8'), original.toString('utf8'))
  f.plan.sourceFingerprint = createHash('sha256').update(original).digest('hex')
  f.plan.completed = ['stop', 'clients', 'website', 'resources']
  writeFileSync(source, original)
  writeFileSync(backup, conflicting)
  await assert.rejects(
    retirement.applyRetirementPlan(f.plan, f),
    /RETIREMENT_ORIGINAL_ENV_CONFLICT/,
  )
  assert.deepEqual(f.calls, [])
  assert.deepEqual(readFileSync(source), original)
  assert.deepEqual(readFileSync(backup), conflicting)
})

test('retirement probes form-encoded legacy secrets against the original raw fingerprint before deleting clients', async (t) => {
  let secret, wrong, deleted, probed
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const path = new URL(url).pathname,
      id = path.split('/').at(-1)
    if (path === '/oauth2/token') {
      const basic = Buffer.from(
          options.headers.Authorization.slice('Basic '.length),
          'base64',
        ).toString(),
        separator = basic.indexOf(':')
      let decoded
      try {
        decoded = decodeURIComponent(basic.slice(separator + 1).replaceAll('+', ' '))
      } catch {}
      probed.push(decoded)
      const valid = !wrong && decoded === secret
      return Response.json(
        { error: valid ? 'invalid_grant' : 'invalid_client' },
        { status: valid ? 400 : 401 },
      )
    }
    if (options.method === 'DELETE') {
      deleted.push(id)
      return new Response(null, { status: 204 })
    }
    return Response.json({
      client_id: id,
      redirect_uris: ['http://127.0.0.1:8080/docs/auth/oidc.callback'],
      post_logout_redirect_uris: ['http://127.0.0.1:8080/identity/signed-out'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      subject_type: 'public',
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'openid profile email',
      metadata: {
        issuer: 'http://127.0.0.1:4444/',
        secretFingerprint: createHash('sha256').update(secret).digest('hex'),
      },
    })
  })
  for (secret of ['legacy+secret', 'legacy%20secret', 'legacy%secret', 'legacy secret:雪!*'])
    for (wrong of [false, true]) {
      const f = applyFixture(t)
      f.values.OUTLINE_OIDC_CLIENT_SECRET = secret
      const source = serializeEnvironment(f.values)
      writeFileSync(join(f.workspace, '.env.local'), source)
      f.plan.sourceFingerprint = digest(source)
      f.plan.completed = ['stop', 'website', 'resources', 'configuration']
      deleted = []
      probed = []
      if (wrong) {
        await assert.rejects(retirement.applyRetirementPlan(f.plan, f), /HYDRA_SECRET_CONFLICT/)
        assert.deepEqual(deleted, [])
      } else {
        await retirement.applyRetirementPlan(f.plan, f)
        assert.deepEqual(deleted, ['ex-outline-local', 'ex-outline'])
        assert.deepEqual(probed, [secret, secret])
      }
    }
})
