import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, serviceHandlers } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { supportFixture, requestInput, typeOption } from '@tests/helpers/support-clickup'
import {
  compileComponentSchema,
  assertOperationCoverage,
  readContract,
} from '@tests/helpers/contract'
import { sha256 } from '@server/src/domains/support/validation'
import { ClickUpError } from '@server/src/modules/clickup/errors'
import type { ApiRequest } from '@server/src/http/handler-types'
const validateSnapshot = compileComponentSchema('FeedbackSnapshot'),
  validateOptions = compileComponentSchema('FeedbackOptions')
const apps: ReturnType<typeof createApp>[] = [],
  fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})
async function setup() {
  const f = await createTestAuth()
  fixtures.push(f)
  const s = await supportFixture(f)
  const app = createApp({ ...f, clickupServices: s.fake.service, supportServices: s.support })
  apps.push(app)
  const rawResults = new Map<string, unknown>()
  app.addHook('preSerialization', async (request, reply, payload) => {
    const operation = request.routeOptions.schema?.operationId
    if (
      typeof operation === 'string' &&
      operation.includes('SupportFeedback') &&
      reply.statusCode < 300
    )
      rawResults.set(operation, structuredClone(payload))
    return payload
  })
  await app.ready()
  const session = await f.authServices.login({
    email: 'support@example.com',
    password: 'valid password',
  })
  return { f, ...s, app, rawResults, headers: { authorization: `Bearer ${session.token}` } }
}
async function multipart(bytes: Buffer, name = 'file', filename = 'a.txt', type = 'text/plain') {
  const form = new FormData()
  form.append(name, new Blob([Uint8Array.from(bytes)], { type }), filename)
  const r = new Response(form)
  return {
    headers: { 'content-type': r.headers.get('content-type')! },
    payload: Buffer.from(await r.arrayBuffer()),
  }
}
describe('support Contract HTTP and raw handlers', () => {
  it('rejects Markdown that would absorb the frozen submission footer', async () => {
    const { app, support, userId, headers, f } = await setup()
    const reply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
    } as unknown as Parameters<typeof serviceHandlers.prepareSupportFeedback>[1]
    const base = requestInput()
    for (const body of ['```txt\nhello', '~~~txt\nhello']) {
      const input = {
        ...base,
        submissionKey: randomUUID(),
        form: { ...base.form, contentFormat: 'markdown' as const, contentText: body },
      }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/support/feedback/submissions',
            headers,
            payload: input,
          })
        ).statusCode,
      ).toBe(400)
      await expect(
        serviceHandlers.prepareSupportFeedback(
          {
            server: { supportServices: support },
            body: input,
            authSession: { userId },
          } as unknown as ApiRequest<'prepareSupportFeedback'>,
          reply,
        ),
      ).rejects.toMatchObject({ code: 'FEEDBACK_INVALID_INPUT' })
    }
    const closed = {
      ...base,
      submissionKey: randomUUID(),
      form: {
        ...base.form,
        contentFormat: 'markdown' as const,
        contentText: '```html\n<script>literal</script>\n```',
      },
    }
    const response = await app.inject({
      method: 'POST',
      url: '/api/support/feedback/submissions',
      headers,
      payload: closed,
    })
    expect(response.statusCode).toBe(201)
    const row = (
      await f.db.query<{ final_markdown: string }>(
        'SELECT final_markdown FROM support_feedback_submissions WHERE id=$1',
        [response.json().id],
      )
    ).rows[0]!
    expect(row.final_markdown).toContain('```\n\n---\n\nExWebsite 提交编号：')
  })
  it('preserves Markdown with content rule 1 in HTTP, raw handlers and frozen rows while legacy replay stays literal', async () => {
    const { app, support, userId, headers, f, fake } = await setup()
    const reply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
    } as unknown as Parameters<typeof serviceHandlers.prepareSupportFeedback>[1]
    const legacy = requestInput()
    legacy.form.contentText = '**bold**'
    const old = await app.inject({
      method: 'POST',
      url: '/api/support/feedback/submissions',
      headers,
      payload: legacy,
    })
    expect(old.statusCode).toBe(201)
    expect(old.json().form).toEqual(legacy.form)
    const oldRow = (
      await f.db.query<{ content_rule_version: number; user_markdown: string }>(
        'SELECT content_rule_version,user_markdown FROM support_feedback_submissions WHERE id=$1',
        [old.json().id],
      )
    ).rows[0]!
    expect(oldRow.content_rule_version).toBe(1)
    expect(oldRow.user_markdown).toBe('\\*\\*bold\\*\\*')
    const newInput = {
      ...requestInput(),
      form: {
        ...requestInput().form,
        contentFormat: 'markdown' as const,
        contentText: '**bold**\n\n- [x] done',
      },
    }
    const response = await app.inject({
      method: 'POST',
      url: '/api/support/feedback/submissions',
      headers,
      payload: newInput,
    })
    expect(response.statusCode).toBe(201)
    expect(validateSnapshot(response.json())).toBe(true)
    expect(response.json().form.contentFormat).toBe('markdown')
    const raw = await serviceHandlers.prepareSupportFeedback(
      {
        server: { supportServices: support },
        body: newInput,
        authSession: { userId },
      } as unknown as ApiRequest<'prepareSupportFeedback'>,
      reply,
    )
    expect(validateSnapshot(raw)).toBe(true)
    expect(raw.form).toEqual(newInput.form)
    const row = (
      await f.db.query<{
        content_rule_version: number
        form_version: number
        user_markdown: string
        final_markdown: string
      }>(
        'SELECT content_rule_version,form_version,user_markdown,final_markdown FROM support_feedback_submissions WHERE id=$1',
        [response.json().id],
      )
    ).rows[0]!
    expect(row.content_rule_version).toBe(1)
    expect(row.form_version).toBe(2)
    expect(row.user_markdown).toBe(newInput.form.contentText)
    expect(row.final_markdown).toContain(newInput.form.contentText)
    const replay = await app.inject({
      method: 'POST',
      url: '/api/support/feedback/submissions',
      headers,
      payload: newInput,
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.json().id).toBe(response.json().id)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/support/feedback/submissions',
          headers,
          payload: { ...legacy, form: { ...legacy.form, contentFormat: 'markdown' } },
        })
      ).statusCode,
    ).toBe(409)
    expect(
      (
        await support.advance(userId, old.json().id, {
          expectedRevision: old.json().revision,
          intent: 'continue',
        })
      ).snapshot.status,
    ).toBe('completed')
    expect(fake.createTask).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ markdown_content: expect.stringContaining(oldRow.user_markdown) }),
    )
    const bugInput = {
      submissionKey: randomUUID(),
      form: {
        kind: 'bug' as const,
        title: 'Markdown bug',
        typeOptionId: typeOption,
        largeFileInfo: null,
        contentFormat: 'markdown' as const,
        details: {
          description: '**broken**',
          reproductionSteps: '- [x] reproduce',
          expectedResult: '`ready`',
          actualResult: '~~wrong~~',
          frequency: null,
        },
      },
      attachments: [],
    }
    const bug = await app.inject({
      method: 'POST',
      url: '/api/support/feedback/submissions',
      headers,
      payload: bugInput,
    })
    expect(bug.statusCode).toBe(201)
    expect(validateSnapshot(bug.json())).toBe(true)
    const bugRow = (
      await f.db.query<{ content_rule_version: number; user_markdown: string }>(
        'SELECT content_rule_version,user_markdown FROM support_feedback_submissions WHERE id=$1',
        [bug.json().id],
      )
    ).rows[0]!
    expect(bugRow.content_rule_version).toBe(1)
    expect(bugRow.user_markdown).toContain('## 问题描述\n\n**broken**')
    expect(bugRow.user_markdown).toContain('## 复现步骤\n\n- [x] reproduce')
    expect(
      (
        await support.advance(userId, bug.json().id, {
          expectedRevision: bug.json().revision,
          intent: 'continue',
        })
      ).snapshot.status,
    ).toBe('completed')
  })
  it('serves community options and validates v3 forms in HTTP and raw handlers', async () => {
    const { app, support, userId, headers } = await setup()
    const reply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
    } as unknown as Parameters<typeof serviceHandlers.prepareSupportFeedback>[1]
    const options = await app.inject({
      url: '/api/support/feedback/options?area=community',
      headers,
    })
    expect(options.statusCode).toBe(200)
    expect(validateOptions(options.json())).toBe(true)
    expect(options.json().kinds.map((kind: { kind: string }) => kind.kind)).toEqual([
      'suggestion',
      'complaint',
    ])
    expect(options.json().actions).toEqual([])
    const rawOptions = await serviceHandlers.getSupportFeedbackOptions(
      {
        server: { supportServices: support },
        query: { area: 'community' },
      } as unknown as ApiRequest<'getSupportFeedbackOptions'>,
      reply,
    )
    expect(validateOptions(rawOptions)).toBe(true)
    expect(rawOptions.kinds).toHaveLength(2)
    const forms = [
      { kind: 'suggestion', title: '社区建议', contentText: '建议内容', largeFileInfo: null },
      {
        kind: 'complaint',
        title: '社区投诉',
        contentText: '投诉内容',
        largeFileInfo: null,
        anonymous: true,
      },
    ] as const
    for (const form of forms) {
      const input = { submissionKey: randomUUID(), form, attachments: [] }
      const response = await app.inject({
        method: 'POST',
        url: '/api/support/feedback/submissions',
        headers,
        payload: input,
      })
      expect(response.statusCode).toBe(201)
      expect(validateSnapshot(response.json())).toBe(true)
      const raw = await serviceHandlers.prepareSupportFeedback(
        {
          server: { supportServices: support },
          body: input,
          authSession: { userId },
        } as unknown as ApiRequest<'prepareSupportFeedback'>,
        reply,
      )
      expect(validateSnapshot(raw)).toBe(true)
      expect(raw.form).toEqual(form)
    }
    for (const form of [
      { ...forms[0], anonymous: false },
      { ...forms[1], anonymous: 'true' },
      { ...requestInput().form, anonymous: true },
    ]) {
      const input = { submissionKey: randomUUID(), form, attachments: [] }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/support/feedback/submissions',
            headers,
            payload: input,
          })
        ).statusCode,
      ).toBe(400)
      await expect(
        serviceHandlers.prepareSupportFeedback(
          {
            server: { supportServices: support },
            body: input,
            authSession: { userId },
          } as unknown as ApiRequest<'prepareSupportFeedback'>,
          reply,
        ),
      ).rejects.toMatchObject({ code: 'FEEDBACK_INVALID_INPUT' })
    }
    expect(
      (await app.inject({ url: '/api/support/feedback/options?area=elsewhere', headers }))
        .statusCode,
    ).toBe(400)
  })
  it('accepts each v2 kind and rejects removed or cross-kind fields at HTTP and raw handler boundaries', async () => {
    const { app, support, userId, headers } = await setup()
    const common = { title: 'contract title', largeFileInfo: null, contentText: 'contract body' }
    const forms = [
      {
        kind: 'bug',
        title: common.title,
        typeOptionId: typeOption,
        largeFileInfo: null,
        details: {
          description: 'problem',
          reproductionSteps: null,
          expectedResult: null,
          actualResult: null,
          frequency: null,
        },
      },
      { kind: 'feature', ...common, typeOptionId: null, departmentOptionId: null },
      { kind: 'asset', ...common, typeOptionId: null, action: 'other' },
      { kind: 'request', ...common, typeOptionId: null },
      { kind: 'content', ...common, action: 'other' },
      { kind: 'campaign', ...common },
    ] as const
    const reply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
    } as unknown as Parameters<typeof serviceHandlers.prepareSupportFeedback>[1]
    for (const form of forms) {
      const input = { submissionKey: randomUUID(), form, attachments: [] }
      const http = await app.inject({
        method: 'POST',
        url: '/api/support/feedback/submissions',
        headers,
        payload: input,
      })
      expect(http.statusCode).toBe(201)
      expect(validateSnapshot(http.json())).toBe(true)
      expect(http.json().form.kind).toBe(form.kind)
      const raw = await serviceHandlers.prepareSupportFeedback(
        {
          server: { supportServices: support },
          body: input,
          authSession: { userId },
        } as unknown as ApiRequest<'prepareSupportFeedback'>,
        reply,
      )
      expect(validateSnapshot(raw)).toBe(true)
      expect(raw.form.kind).toBe(form.kind)
      expect(
        (
          await support.advance(userId, http.json().id, {
            expectedRevision: http.json().revision,
            intent: 'continue',
          })
        ).snapshot.status,
      ).toBe('completed')
    }
    const invalid = [
      { ...forms[0], typeOptionId: null },
      { ...forms[0], departmentOptionId: null },
      { ...forms[1], action: 'add' },
      { ...forms[2], departmentOptionId: null },
      { ...forms[3], categoryOptionId: null },
      { ...forms[4], typeOptionId: null },
      { ...forms[5], action: 'other' },
    ]
    for (const form of invalid) {
      const input = { submissionKey: randomUUID(), form, attachments: [] }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/support/feedback/submissions',
            headers,
            payload: input,
          })
        ).statusCode,
      ).toBe(400)
      await expect(
        serviceHandlers.prepareSupportFeedback(
          {
            server: { supportServices: support },
            body: input,
            authSession: { userId },
          } as unknown as ApiRequest<'prepareSupportFeedback'>,
          reply,
        ),
      ).rejects.toMatchObject({ code: 'FEEDBACK_INVALID_INPUT' })
    }
  })
  it('covers six operations and raw snapshot/options objects with no credential fields', async () => {
    const { app, support, userId, headers, rawResults } = await setup()
    assertOperationCoverage(readContract(), serviceHandlers)
    const options = await app.inject({ url: '/api/support/feedback/options', headers })
    expect(options.statusCode).toBe(200)
    expect(validateOptions(options.json())).toBe(true)
    const input = requestInput()
    const prepared = await app.inject({
      method: 'POST',
      url: '/api/support/feedback/submissions',
      headers,
      payload: input,
    })
    expect(prepared.statusCode).toBe(201)
    expect(validateSnapshot(prepared.json())).toBe(true)
    expect(prepared.headers['cache-control']).toBe('no-store')
    const id = prepared.json().id
    const fakeReply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
    } as unknown as Parameters<typeof serviceHandlers.prepareSupportFeedback>[1]
    const request = {
      server: { supportServices: support },
      body: input,
      authSession: { userId },
    } as unknown as ApiRequest<'prepareSupportFeedback'>
    const raw = await serviceHandlers.prepareSupportFeedback(request, fakeReply)
    expect(validateSnapshot(raw)).toBe(true)
    expect(fakeReply.code).toHaveBeenCalledWith(200)
    expect(JSON.stringify(raw)).not.toMatch(/attempt|nickname_snapshot|bytes|token|email/)
    const rawOptions = await serviceHandlers.getSupportFeedbackOptions(
      request as unknown as ApiRequest<'getSupportFeedbackOptions'>,
      fakeReply,
    )
    expect(validateOptions(rawOptions)).toBe(true)
    for (const url of [
      `/api/support/feedback/submissions/${id}`,
      `/api/support/feedback/submissions/lookup?submissionKey=${input.submissionKey}`,
    ]) {
      const response = await app.inject({ url, headers })
      expect(response.statusCode).toBe(200)
      expect(validateSnapshot(response.json())).toBe(true)
    }
    for (const operation of [
      'prepareSupportFeedback',
      'getSupportFeedback',
      'lookupSupportFeedback',
    ])
      expect(validateSnapshot(rawResults.get(operation))).toBe(true)
    expect(validateOptions(rawResults.get('getSupportFeedbackOptions'))).toBe(true)
  })
  it('authenticates every operation, hides other owners and HEAD is strictly read-only', async () => {
    const { app, f, support, userId, headers, fake } = await setup(),
      input = requestInput(),
      s = (await support.prepare(userId, input)).snapshot
    const paths = [
      '/api/support/feedback/options',
      `/api/support/feedback/submissions/${s.id}`,
      `/api/support/feedback/submissions/lookup?submissionKey=${s.submissionKey}`,
    ]
    for (const url of paths) expect((await app.inject(url)).statusCode).toBe(401)
    for (const method of ['POST', 'PUT'] as const) {
      const url =
        method === 'POST'
          ? `/api/support/feedback/submissions/${s.id}/advance`
          : `/api/support/feedback/submissions/${s.id}/attachments/${randomUUID()}`
      expect(
        (
          await app.inject({
            method,
            url,
            payload: method === 'POST' ? { expectedRevision: 0, intent: 'continue' } : undefined,
          })
        ).statusCode,
      ).toBe(401)
    }
    const before = await f.db.query(
      'SELECT revision,status FROM support_feedback_submissions WHERE id=$1',
      [s.id],
    )
    for (const url of paths)
      expect((await app.inject({ method: 'HEAD', url, headers })).statusCode).toBe(200)
    expect(
      (
        await f.db.query('SELECT revision,status FROM support_feedback_submissions WHERE id=$1', [
          s.id,
        ])
      ).rows,
    ).toEqual(before.rows)
    expect(fake.createTask).not.toHaveBeenCalled()
    expect(fake.service.uploadAttachment).not.toHaveBeenCalled()
    await f.seedUser({ email: 'other@example.com', nickname: 'Other', password: 'valid password' })
    const other = await f.authServices.login({
      email: 'other@example.com',
      password: 'valid password',
    })
    for (const url of paths.slice(1))
      expect(
        (await app.inject({ url, headers: { authorization: `Bearer ${other.token}` } })).statusCode,
      ).toBe(404)
  })
  it('uses controlled single-file lifecycle, validates filename/MIME/digest and raw upload/advance snapshots', async () => {
    const { app, support, userId, headers, rawResults } = await setup(),
      bytes = Buffer.from('file bytes'),
      id = randomUUID()
    const input = {
      ...requestInput(),
      attachments: [
        {
          id,
          originalName: 'a.txt',
          contentType: 'text/plain',
          byteLength: bytes.length,
          sha256: sha256(bytes),
        },
      ],
    }
    let s = (await support.prepare(userId, input)).snapshot
    const url = `/api/support/feedback/submissions/${s.id}/attachments/${id}`
    const wrong = await multipart(bytes, 'other')
    expect(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers: { ...headers, ...wrong.headers },
          payload: wrong.payload,
        })
      ).statusCode,
    ).toBe(400)
    const wrongFilename = await multipart(bytes, 'file', 'b.txt')
    expect(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers: { ...headers, ...wrongFilename.headers },
          payload: wrongFilename.payload,
        })
      ).statusCode,
    ).toBe(409)
    const wrongMime = await multipart(bytes, 'file', 'a.txt', 'application/octet-stream')
    expect(
      (
        await app.inject({
          method: 'PUT',
          url,
          headers: { ...headers, ...wrongMime.headers },
          payload: wrongMime.payload,
        })
      ).statusCode,
    ).toBe(409)
    const valid = await multipart(bytes)
    const response = await app.inject({
      method: 'PUT',
      url,
      headers: { ...headers, ...valid.headers },
      payload: valid.payload,
    })
    expect(response.statusCode).toBe(200)
    expect(validateSnapshot(response.json())).toBe(true)
    s = response.json()
    const fakeReply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
    } as unknown as Parameters<typeof serviceHandlers.advanceSupportFeedback>[1]
    const request = {
      server: { supportServices: support },
      body: { expectedRevision: s.revision, intent: 'continue' },
      params: { submissionId: s.id },
      authSession: { userId },
    } as unknown as ApiRequest<'advanceSupportFeedback'>
    const raw = await serviceHandlers.advanceSupportFeedback(request, fakeReply)
    expect(validateSnapshot(raw)).toBe(true)
    expect(raw.status).toBe('uploading')
    expect(fakeReply.code).toHaveBeenCalledWith(202)
    const complete = await app.inject({
      method: 'POST',
      url: `/api/support/feedback/submissions/${s.id}/advance`,
      headers,
      payload: { expectedRevision: raw.revision, intent: 'continue' },
    })
    expect(complete.statusCode).toBe(200)
    expect(validateSnapshot(complete.json())).toBe(true)
    expect(complete.json().status).toBe('completed')
    expect(validateSnapshot(rawResults.get('uploadSupportFeedbackAttachment'))).toBe(true)
    expect(validateSnapshot(rawResults.get('advanceSupportFeedback'))).toBe(true)
  })
  it('rejects closed input injection, wire overflow, nonmultipart and missing attachments', async () => {
    const { app, headers } = await setup()
    const input = requestInput()
    for (const payload of [
      { ...input, listId: 'evil' },
      { ...input, form: { ...input.form, userId: randomUUID() } },
      { ...input, form: { ...input.form, contentText: ' ' } },
    ])
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/support/feedback/submissions',
            headers,
            payload,
          })
        ).statusCode,
      ).toBe(400)
    const tooLarge = await app.inject({
      method: 'POST',
      url: '/api/support/feedback/submissions',
      headers,
      payload: { ...input, form: { ...input.form, contentText: 'x'.repeat(196608) } },
    })
    expect(tooLarge.statusCode).toBe(413)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/support/feedback/submissions',
          headers,
          payload: input,
        })
      ).statusCode,
    ).toBe(201)
  })
  it('unknown create response returns recoverable 202 snapshot, stale replay returns 200', async () => {
    const { app, headers, fake } = await setup(),
      input = requestInput()
    fake.createTask.mockRejectedValueOnce(new ClickUpError('unknown', 'UPSTREAM_UNKNOWN'))
    const prepare = await app.inject({
        method: 'POST',
        url: '/api/support/feedback/submissions',
        headers,
        payload: input,
      }),
      s = prepare.json()
    const url = `/api/support/feedback/submissions/${s.id}/advance`
    const advance = await app.inject({
      method: 'POST',
      url,
      headers,
      payload: { expectedRevision: s.revision, intent: 'continue' },
    })
    expect(advance.statusCode).toBe(202)
    expect(validateSnapshot(advance.json())).toBe(true)
    expect(advance.json().nextAction).toBe('verify')
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          headers,
          payload: { expectedRevision: s.revision, intent: 'continue' },
        })
      ).statusCode,
    ).toBe(200)
    expect(fake.createTask).toHaveBeenCalledTimes(1)
  })
})
