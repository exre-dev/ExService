import { createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import {
  approvedInvitation,
  createTestAuth,
  experiencedJoinApplication,
  joinSnapshot,
  newJoinApplication,
  registerInvited,
  type TestAuth,
} from '@tests/helpers/auth'
import { normalizeJoinApplicationPayload } from '@server/src/domains/join/applications/form-validation'
import {
  MAX_PROOF_BYTES,
  validateJoinProofs,
} from '@server/src/domains/join/applications/attachment-validation'
const fixtures: TestAuth[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})
async function setup() {
  const f = await createTestAuth()
  fixtures.push(f)
  return f
}
const code = (value: string) => expect.objectContaining({ code: value })
const proof = (originalName = 'proof.txt', bytes = Buffer.from('证明材料')) => ({
  originalName,
  bytes,
})
const rows = async (f: TestAuth) =>
  (
    await f.db.query<{ id: string }>(
      'SELECT id FROM join_applications ORDER BY created_at DESC, id DESC',
    )
  ).rows
const all = async <T extends Record<string, unknown>>(
  f: TestAuth,
  sql: string,
  values: unknown[] = [],
) => (await f.db.query<T>(sql, values)).rows
const one = async <T extends Record<string, unknown>>(
  f: TestAuth,
  sql: string,
  values: unknown[] = [],
) => (await all<T>(f, sql, values))[0]
const injectFailure = (f: TestAuth, table: string, at = 1) => {
  const original = f.db.transaction.bind(f.db)
  let seen = 0
  return vi.spyOn(f.db, 'transaction').mockImplementation((run, mode) =>
    original(
      async (tx) =>
        run({
          query: async (sql, values) => {
            if (sql.startsWith(`INSERT INTO ${table} `) && ++seen === at)
              throw new Error('injected storage failure')
            return tx.query(sql, values)
          },
        }),
      mode,
    ),
  )
}

it('persists both complete categories, normalized declared text and exact optional attachment bytes', async () => {
  const f = await setup(),
    input = experiencedJoinApplication('  EXPERIENCED@EXAMPLE.COM  ')
  input.nickname = '  😀  '
  input.form.freeTime = '  周末  '
  input.form.answers.leaveReason = '  自由填写\n第二行  '
  const files = [proof('证明.PDF', Buffer.from('%PDF-1.7\ncontent')), proof()]
  expect(await f.joinServices.submit(input, files)).toEqual({ status: 'received' })
  const id = (await rows(f))[0]!.id,
    result = await f.joinServices.get(id)
  expect(result).toMatchObject({
    formVersion: 1,
    application: {
      applicationType: 'experienced',
      email: 'experienced@example.com',
      nickname: '😀',
    },
    form: { freeTime: '周末', answers: { leaveReason: '自由填写\n第二行' } },
  })
  expect(result.attachments).toHaveLength(2)
  for (const [ordinal, metadata] of result.attachments.entries()) {
    const file = files[ordinal]!
    expect(metadata).toMatchObject({
      originalName: file.originalName,
      ordinal,
      byteLength: file.bytes.length,
      sha256: createHash('sha256').update(file.bytes).digest('hex'),
    })
    expect(Object.keys(metadata).sort()).toEqual([
      'byteLength',
      'extension',
      'id',
      'ordinal',
      'originalName',
      'sha256',
    ])
    expect((await f.joinServices.download(id, metadata.id)).bytes).toEqual(file.bytes)
  }
  await f.joinServices.submit(newJoinApplication('new@example.com'))
  expect(await f.joinServices.get((await rows(f))[0]!.id)).toMatchObject({
    formVersion: 1,
    application: { applicationType: 'new' },
    attachments: [],
    form: {
      commitments: {
        informationAccurate: true,
        obeyCommunityRules: true,
        acceptAcademyAttendanceConsequences: true,
      },
    },
  })
})

it.each([
  'join_applications',
  'join_application_email_registry',
  'join_application_forms',
  'join_application_attachments',
])('rolls back every table when %s insertion fails', async (table) => {
  const f = await setup(),
    before = await joinSnapshot(f)
  const failure = injectFailure(f, table)
  await expect(f.joinServices.submit(experiencedJoinApplication(), [proof()])).rejects.toThrow(
    'injected storage failure',
  )
  expect(await joinSnapshot(f)).toEqual(before)
  failure.mockRestore()
  expect(await f.joinServices.submit(experiencedJoinApplication(), [proof()])).toEqual({
    status: 'received',
  })
})
it('rolls back a failure after an earlier attachment was inserted', async () => {
  const f = await setup(),
    before = await joinSnapshot(f)
  injectFailure(f, 'join_application_attachments', 2)
  await expect(
    f.joinServices.submit(experiencedJoinApplication(), [proof(), proof('second.txt')]),
  ).rejects.toThrow('injected storage failure')
  expect(await joinSnapshot(f)).toEqual(before)
})
it('keeps unexpected uniqueness failures internal rather than reporting an email duplicate', async () => {
  const f = await setup(),
    original = f.db.transaction.bind(f.db)
  vi.spyOn(f.db, 'transaction').mockImplementation((run, mode) =>
    original(
      async (tx) =>
        run({
          query: async (sql, values) => {
            if (sql.startsWith('INSERT INTO join_application_forms ')) {
              await tx.query(sql, values)
            }
            return tx.query(sql, values)
          },
        }),
      mode,
    ),
  )
  await expect(f.joinServices.submit(newJoinApplication())).rejects.toMatchObject({ code: '23505' })
  expect(await rows(f)).toEqual([])
})
it('preserves rejection/registration lifetime occupancy, prioritizes application history and has a registry fallback', async () => {
  const f = await setup()
  await f.joinServices.submit(newJoinApplication())
  const id = (await rows(f))[0]!.id
  await f.joinServices.reject(id)
  await f.seedUser({
    email: 'member@example.com',
    nickname: 'Existing',
    password: 'valid password',
  })
  await f.db.query('DELETE FROM join_application_email_registry WHERE email = $1', [
    'member@example.com',
  ])
  const before = await joinSnapshot(f)
  await expect(
    f.joinServices.submit(experiencedJoinApplication(' MEMBER@EXAMPLE.COM '), [proof()]),
  ).rejects.toMatchObject(code('JOIN_APPLICATION_EXISTS'))
  expect(await joinSnapshot(f)).toEqual(before)
  await registerInvited(f, 'registered@example.com')
  const after = await joinSnapshot(f)
  await expect(
    f.joinServices.submit(newJoinApplication('registered@example.com')),
  ).rejects.toMatchObject(code('JOIN_APPLICATION_EXISTS'))
  expect(await joinSnapshot(f)).toEqual(after)
})
it('does not clean stale invitation or delivery state when submitting', async () => {
  const f = await setup()
  await approvedInvitation(f, 'old@example.com')
  f.advance(7 * 86_400_000)
  await f.db.query("UPDATE join_delivery_attempts SET status='pending', finished_at=NULL")
  const invitation = await all(f, 'SELECT * FROM join_invitations'),
    delivery = await all(f, 'SELECT * FROM join_delivery_attempts')
  await f.joinServices.submit(newJoinApplication('new@example.com'))
  expect(await all(f, 'SELECT * FROM join_invitations')).toEqual(invitation)
  expect(await all(f, 'SELECT * FROM join_delivery_attempts')).toEqual(delivery)
})

it.each([
  (v: ReturnType<typeof newJoinApplication>) => ({ ...v, unknown: true }),
  (v: ReturnType<typeof newJoinApplication>) => ({ ...v, form: { ...v.form, unknown: true } }),
  (v: ReturnType<typeof newJoinApplication>) => ({
    ...v,
    form: { ...v.form, answers: { ...v.form.answers, previousServer: 'wrong category' } },
  }),
  (v: ReturnType<typeof newJoinApplication>) => ({
    ...v,
    form: { ...v.form, commitments: { ...v.form.commitments, informationAccurate: false } },
  }),
  (v: ReturnType<typeof newJoinApplication>) => ({
    ...v,
    form: { ...v.form, discoveryChannels: ['friends', 'friends'] },
  }),
  (v: ReturnType<typeof newJoinApplication>) => ({ ...v, form: { ...v.form, freeTime: '  ' } }),
  (v: ReturnType<typeof newJoinApplication>) => ({
    ...v,
    form: { ...v.form, birthDate: '2001-02-29' },
  }),
  (v: ReturnType<typeof newJoinApplication>) => ({
    ...v,
    form: { ...v.form, birthDate: '2099-01-01' },
  }),
  (v: ReturnType<typeof newJoinApplication>) => ({ ...v, nickname: '\u0000hidden' }),
  (v: ReturnType<typeof newJoinApplication>) => ({ ...v, email: 'invalid' }),
  (v: ReturnType<typeof newJoinApplication>) => ({ ...v, qq: '1234' }),
  (v: ReturnType<typeof newJoinApplication>) => ({ ...v, qq: '12345678901234' }),
  () => ({ email: 'member@example.com', nickname: 'Old request', qq: '001234' }),
])('independently rejects invalid Contract form input %# without any writes', async (invalid) => {
  const f = await setup(),
    before = await joinSnapshot(f)
  await expect(f.joinServices.submit(invalid(newJoinApplication()))).rejects.toMatchObject(
    code('BAD_REQUEST'),
  )
  expect(await joinSnapshot(f)).toEqual(before)
})
it('normalizes only declared strings and retains unknown fields and QQ for rejection', () => {
  const input = {
    ...newJoinApplication('  MEMBER@EXAMPLE.COM  ', '  Name  ', '00000'),
    extra: '  unchanged  ',
  }
  const normalized = normalizeJoinApplicationPayload(input)
  expect(normalized).toMatchObject({
    email: 'member@example.com',
    nickname: 'Name',
    qq: '00000',
    extra: '  unchanged  ',
  })
  expect(input.email).toBe('  MEMBER@EXAMPLE.COM  ')
})
it('counts Unicode codepoints at essay and nickname boundaries and validates real dates against UTC today', async () => {
  const f = await setup(),
    input = experiencedJoinApplication()
  input.form.answers.deescalationEssay = '😀'.repeat(149)
  await expect(f.joinServices.submit(input)).rejects.toMatchObject(code('BAD_REQUEST'))
  input.form.answers.deescalationEssay = '😀'.repeat(150)
  input.form.answers.discretionEssay = '😀'.repeat(4000)
  input.nickname = '😀'.repeat(32)
  input.form.birthDate = new Date(f.now()).toISOString().slice(0, 10)
  expect(await f.joinServices.submit(input)).toEqual({ status: 'received' })
  const overflow = experiencedJoinApplication('overflow@example.com')
  overflow.form.answers.discretionEssay = '😀'.repeat(4001)
  await expect(f.joinServices.submit(overflow)).rejects.toMatchObject(code('BAD_REQUEST'))
  const name = newJoinApplication('nickname@example.com', '😀'.repeat(33))
  await expect(f.joinServices.submit(name)).rejects.toMatchObject(code('BAD_REQUEST'))
})

it.each([
  ['png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ['jpg', Buffer.from([255, 216, 255])],
  ['jpeg', Buffer.from([255, 216, 255])],
  ['gif', Buffer.from('GIF89a')],
  ['bmp', Buffer.from('BM')],
  ['pdf', Buffer.from('%PDF-')],
  ['doc', Buffer.from([208, 207, 17, 224, 161, 177, 26, 225])],
  ['xls', Buffer.from([208, 207, 17, 224, 161, 177, 26, 225])],
  ['ppt', Buffer.from([208, 207, 17, 224, 161, 177, 26, 225])],
  ['docx', Buffer.from([80, 75, 3, 4])],
  ['xlsx', Buffer.from([80, 75, 5, 6])],
  ['pptx', Buffer.from([80, 75, 7, 8])],
  ['zip', Buffer.from([80, 75, 3, 4])],
  ['rar', Buffer.from([82, 97, 114, 33, 26, 7, 0])],
  ['7z', Buffer.from([55, 122, 188, 175, 39, 28])],
  ['txt', Buffer.from('合法UTF-8')],
  [
    'svg',
    Buffer.from(
      '\uFEFF <?xml version="1.0"?><!--root--><svg xmlns="http://www.w3.org/2000/svg"></svg>',
    ),
  ],
])('accepts declared %s file family signatures without relying on MIME', (extension, bytes) => {
  expect(
    validateJoinProofs([proof(`proof.${extension}`, bytes)], 'experienced')[0]!.extension,
  ).toBe(extension)
})
it.each([
  ['proof.png', Buffer.from('%PDF-')],
  ['proof.exe', Buffer.from('MZ')],
  ['proof.txt', Buffer.from([0xc3, 0x28])],
  ['proof.txt', Buffer.from('nul\0')],
  ['proof.svg', Buffer.from('<!DOCTYPE svg><svg></svg>')],
  ['proof.svg', Buffer.from('<!ENTITY bad "x"><svg></svg>')],
  ['proof.svg', Buffer.from('<html></html>')],
])('rejects unsupported signature/text %s', (name, bytes) => {
  expect(() => validateJoinProofs([proof(name, bytes)], 'experienced')).toThrow(
    code('JOIN_UNSUPPORTED_MEDIA_TYPE'),
  )
})
it.each([
  '../proof.txt',
  'a\\proof.txt',
  'bad\r\n.txt',
  'bad".txt',
  '.',
  '..',
  '😀'.repeat(256) + '.txt',
])('rejects unsafe filename %s', (name) => {
  expect(() => validateJoinProofs([proof(name)], 'experienced')).toThrow(code('BAD_REQUEST'))
})
it('enforces zero/five/six attachments, actual byte lengths and 10MiB boundary', () => {
  const bytes = Buffer.alloc(MAX_PROOF_BYTES, 65)
  expect(validateJoinProofs([], 'new')).toEqual([])
  expect(
    validateJoinProofs(
      Array.from({ length: 5 }, () => proof('proof.txt', bytes)),
      'experienced',
    ),
  ).toHaveLength(5)
  expect(() =>
    validateJoinProofs(
      Array.from({ length: 6 }, () => proof()),
      'experienced',
    ),
  ).toThrow(code('JOIN_UPLOAD_TOO_LARGE'))
  expect(() =>
    validateJoinProofs([proof('proof.txt', Buffer.alloc(MAX_PROOF_BYTES + 1, 65))], 'experienced'),
  ).toThrow(code('JOIN_UPLOAD_TOO_LARGE'))
  expect(() => validateJoinProofs([proof('empty.txt', Buffer.alloc(0))], 'experienced')).toThrow(
    code('BAD_REQUEST'),
  )
  expect(() => validateJoinProofs([proof()], 'new')).toThrow(code('BAD_REQUEST'))
})

it('returns all six minimal results without changing any business table', async () => {
  const f = await setup()
  const query = async (email: string, expected: object) => {
    const before = await joinSnapshot(f)
    expect(await f.joinServices.query({ email })).toEqual(expected)
    expect(await joinSnapshot(f)).toEqual(before)
  }
  await query('unknown@example.com', { status: 'not_found', nextAction: 'apply' })
  await f.seedUser({
    email: 'account@example.com',
    nickname: 'Old account',
    password: 'valid password',
  })
  await query('account@example.com', { status: 'not_found', nextAction: 'apply' })
  await f.joinServices.submit(newJoinApplication())
  await query(' MEMBER@EXAMPLE.COM ', { status: 'pending', nextAction: 'wait' })
  await f.joinServices.reject((await rows(f))[0]!.id)
  await query('member@example.com', { status: 'rejected', nextAction: 'contact_community' })
  await approvedInvitation(f, 'approved@example.com')
  await f.db.query("UPDATE join_delivery_attempts SET status='failed' WHERE status='sent'")
  await query('approved@example.com', { status: 'approved', nextAction: 'register' })
  f.advance(7 * 86_400_000)
  await query('approved@example.com', {
    status: 'invitation_expired',
    nextAction: 'contact_community',
  })
  expect(
    await one(f, 'SELECT status FROM join_invitations ORDER BY issued_at DESC LIMIT 1'),
  ).toEqual({ status: 'active' })
  await registerInvited(f, 'registered@example.com')
  await query('registered@example.com', { status: 'registered', nextAction: 'login' })
})
it('prioritizes completed historical user links over newer rejected history and stable IDs break time ties', async () => {
  const f = await setup()
  await registerInvited(f)
  await f.db.query(
    "INSERT INTO join_applications (id,email,nickname,qq,status,created_at,reviewed_at) VALUES ('zz-new-rejected',$1,'Old','1','rejected',$2,$3)",
    ['member@example.com', f.now() + 1, f.now() + 1],
  )
  expect(await f.joinServices.query({ email: 'member@example.com' })).toEqual({
    status: 'registered',
    nextAction: 'login',
  })
  await f.db.query(
    "INSERT INTO join_applications (id,email,nickname,qq,status,created_at,reviewed_at) VALUES ('a','ties@example.com','A','1','rejected',1,2), ('b','ties@example.com','B','1','pending',1,NULL)",
  )
  expect(await f.joinServices.query({ email: 'ties@example.com' })).toEqual({
    status: 'pending',
    nextAction: 'wait',
  })
})
it('rejects corrupt approved invitation associations with no query writes', async () => {
  const f = await setup()
  await f.joinServices.submit(newJoinApplication())
  await f.db.query("UPDATE join_applications SET status='approved',reviewed_at=1")
  let before = await joinSnapshot(f)
  await expect(f.joinServices.query({ email: 'member@example.com' })).rejects.toThrow(
    'inconsistent',
  )
  expect(await joinSnapshot(f)).toEqual(before)
  const user = await f.seedUser({
    email: 'other@example.com',
    nickname: 'Other',
    password: 'valid password',
  })
  await f.db.query(
    "INSERT INTO join_invitations (id,application_id,status,issued_at,expires_at,code_version,completed_user_id,completed_at) VALUES ('broken',$1,'completed',1,2,1,$2,2)",
    [(await rows(f))[0]!.id, user],
  )
  await f.db.query('ALTER TABLE join_invitations DROP CONSTRAINT join_invitations_completion_check')
  await f.db.query("UPDATE join_invitations SET completed_user_id = NULL WHERE id = 'broken'")
  before = await joinSnapshot(f)
  await expect(f.joinServices.query({ email: 'member@example.com' })).rejects.toThrow(
    'inconsistent',
  )
  expect(await joinSnapshot(f)).toEqual(before)
})
it.each(['missing', 'invalid-json', 'wrong-type', 'extra-field'])(
  'fails corrupted version 1 reads safely: %s',
  async (variant) => {
    const f = await setup()
    await f.joinServices.submit(newJoinApplication())
    const id = (await rows(f))[0]!.id
    if (variant === 'missing')
      await f.db.query('DELETE FROM join_application_forms WHERE application_id=$1', [id])
    else if (variant === 'invalid-json')
      await f.db.query('UPDATE join_application_forms SET form_json=$1 WHERE application_id=$2', [
        '{',
        id,
      ])
    else if (variant === 'wrong-type')
      await f.db.query(
        "UPDATE join_application_forms SET application_type='experienced' WHERE application_id=$1",
        [id],
      )
    else
      await f.db.query('UPDATE join_application_forms SET form_json=$1 WHERE application_id=$2', [
        JSON.stringify({ ...newJoinApplication().form, extra: true }),
        id,
      ])
    await expect(f.joinServices.get(id)).rejects.toThrow()
    await expect(f.joinServices.list()).rejects.toThrow()
  },
)
it('keeps genuine legacy records reviewable with no fabricated form or commitments', async () => {
  const f = await setup()
  await f.db.query(
    "INSERT INTO join_applications (id,email,nickname,qq,status,created_at) VALUES ('legacy','legacy@example.com','Old','1','pending',1)",
  )
  expect(await f.joinServices.get('legacy')).toMatchObject({
    formVersion: 0,
    form: null,
    attachments: [],
    application: { applicationType: 'legacy', qq: '1' },
  })
  expect((await f.joinServices.approve('legacy')).application.status).toBe('approved')
  const grant = await f.invitationServices.verifyCode('legacy@example.com', f.deliveries[0]!.code)
  expect(
    await f.invitationServices.complete({
      completionToken: grant.completionToken,
      nickname: 'Legacy',
      password: 'valid password',
    }),
  ).toEqual({ status: 'registered', email: 'legacy@example.com' })
})
it('does not SELECT attachment bytes for list/detail and scopes download to both IDs', async () => {
  const f = await setup()
  await f.joinServices.submit(experiencedJoinApplication(), [proof()])
  const id = (await rows(f))[0]!.id
  const statements: string[] = []
  const transaction = f.db.transaction.bind(f.db)
  vi.spyOn(f.db, 'transaction').mockImplementation((run, mode) =>
    transaction(
      async (tx) =>
        run({
          query: (sql, values) => {
            statements.push(sql)
            return tx.query(sql, values)
          },
        }),
      mode,
    ),
  )
  await f.joinServices.list()
  const result = await f.joinServices.get(id)
  const attachmentQueries = statements.filter((sql) => sql.includes('join_application_attachments'))
  expect(attachmentQueries.length).toBeGreaterThan(0)
  expect(attachmentQueries.every((sql) => !sql.includes('bytes') && !sql.includes('*'))).toBe(true)
  await expect(f.joinServices.download('other', result.attachments[0]!.id)).rejects.toMatchObject(
    code('JOIN_ATTACHMENT_NOT_FOUND'),
  )
  await expect(f.joinServices.download(id, 'missing')).rejects.toMatchObject(
    code('JOIN_ATTACHMENT_NOT_FOUND'),
  )
})
it('does not approve or dispatch an invitation when version 1 form data is corrupt', async () => {
  const f = await setup()
  await f.joinServices.submit(newJoinApplication())
  const id = (await rows(f))[0]!.id
  await f.db.query('DELETE FROM join_application_forms WHERE application_id=$1', [id])
  const before = await joinSnapshot(f)
  await expect(f.joinServices.approve(id)).rejects.toThrow('missing')
  expect(await joinSnapshot(f)).toEqual(before)
  expect(f.deliveries).toEqual([])
})
it('persists five metadata entries in order and checks stored bytes against their digest on download', async () => {
  const f = await setup()
  await f.joinServices.submit(
    experiencedJoinApplication(),
    Array.from({ length: 5 }, (_, ordinal) =>
      proof(`${ordinal}.txt`, Buffer.from(`proof ${ordinal}`)),
    ),
  )
  const id = (await rows(f))[0]!.id,
    result = await f.joinServices.get(id)
  expect(result.attachments.map((file) => file.ordinal)).toEqual([0, 1, 2, 3, 4])
  const attachment = result.attachments[0]!
  await f.db.query('UPDATE join_application_attachments SET sha256=$1 WHERE id=$2', [
    '0'.repeat(64),
    attachment.id,
  ])
  await expect(f.joinServices.download(id, attachment.id)).rejects.toThrow('inconsistent')
})
it('orders same-time invitations by ID and treats the exact expiration instant as expired without writes', async () => {
  const f = await setup(),
    approved = await approvedInvitation(f)
  await f.db.query("UPDATE join_invitations SET status='expired'")
  await f.db.query(
    "INSERT INTO join_invitations (id,application_id,status,issued_at,expires_at,code_version) VALUES ('zz-tie',$1,'active',$2,$3,1)",
    [approved.id, f.now(), f.now() + 1000],
  )
  expect(await f.joinServices.query({ email: approved.email })).toEqual({
    status: 'approved',
    nextAction: 'register',
  })
  f.advance(1000)
  const before = await joinSnapshot(f)
  expect(await f.joinServices.query({ email: approved.email })).toEqual({
    status: 'invitation_expired',
    nextAction: 'contact_community',
  })
  expect(await joinSnapshot(f)).toEqual(before)
})
it.each([
  '<svg/>',
  '<?xml version="1.0"?><svg/>',
  '\uFEFF\n<!-- root -->\n<svg/>',
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
])('accepts a self-closing SVG root with ordinary XML prolog: %s', (content) => {
  expect(
    validateJoinProofs([proof('root.svg', Buffer.from(content))], 'experienced')[0]!.extension,
  ).toBe('svg')
})
it.each(['GIF87a', 'GIF89a'])('recognizes exact GIF signature %s', (signature) => {
  expect(
    validateJoinProofs([proof('image.gif', Buffer.from(signature))], 'experienced')[0]!.extension,
  ).toBe('gif')
})
it('rejects high-bit GIF bytes that lossy ASCII decoding disguises as GIF89a', () => {
  expect(() =>
    validateJoinProofs(
      [proof('image.gif', Buffer.from([0xc7, 0xc9, 0xc6, 0xb8, 0xb9, 0xe1]))],
      'experienced',
    ),
  ).toThrow(code('JOIN_UNSUPPORTED_MEDIA_TYPE'))
})
it.each([
  Buffer.from('<!DOCTYPE svg><svg/>'),
  Buffer.from('<?xml version="1.0"?><!ENTITY name "value"><svg/>'),
  Buffer.from('<svg>\0</svg>'),
  Buffer.from([0xc3, 0x28]),
  Buffer.from('<?xml version="1.0"?><svg-like/>'),
])('retains SVG declaration, NUL, UTF-8 and non-root rejections %#', (bytes) => {
  expect(() => validateJoinProofs([proof('root.svg', bytes)], 'experienced')).toThrow(
    code('JOIN_UNSUPPORTED_MEDIA_TYPE'),
  )
})
