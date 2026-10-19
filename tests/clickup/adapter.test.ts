import { afterEach, describe, expect, it, vi } from 'vitest'
import Fastify from '../../apps/server/node_modules/fastify/fastify.js'
import { readClickUpConfig } from '@server/src/modules/clickup/config'
import { createClickUpServices } from '@server/src/modules/clickup/factory'
import { ClickUpError, clickUpTaskUrl } from '@server/src/modules/clickup/errors'
import plugin from '@server/src/modules/clickup/plugin'
import type { ClickUpTransport } from '@server/src/modules/clickup/service'
import { frozenTaskInput, TARGET } from '@server/src/domains/support/metadata'
import { matchesFrozenTask, validateStoredTask } from '@server/src/domains/support/frozen-payload'
import { sha256 } from '@server/src/domains/support/validation'

const token = 'pk_test_fixture_only'
const list = {
  id: '123',
  name: 'Example',
  space: { id: '789' },
  statuses: [{ status: '新增', type: 'open' }],
}
const field = {
  id: 'field-1',
  name: 'Category',
  type: 'drop_down',
  type_config: { options: [{ id: 'option-1', name: '修复', orderindex: 0 }] },
  applied_objects: [{ object_type: 19, object_id: 1001 }],
}
const task = {
  id: 'abc-123',
  name: 'Title',
  list: { id: '123' },
  status: { status: '新增' },
  custom_item_id: 1001,
  markdown_description: 'Body',
  custom_fields: [{ ...field, value: 0 }],
  tags: [],
}
const createInput = {
  name: 'Title',
  markdown_content: 'Body',
  status: '新增',
  custom_item_id: 1001,
  custom_fields: [{ id: 'field-1', value: 'option-1' }],
  tags: [],
}
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers })
function fixture(response: Response | (() => Promise<Response>) = json(list)) {
  const requests: { url: string; init: RequestInit }[] = []
  const transport: ClickUpTransport = async (url, init) => {
    requests.push({ url, init })
    return typeof response === 'function' ? response() : response
  }
  return {
    requests,
    service: createClickUpServices(readClickUpConfig({ CLICKUP_TOKEN: token }), {
      transport,
      now: () => 1_700_000_000_000,
    }),
  }
}
afterEach(() => {
  vi.useRealTimers()
})

describe('ClickUp configuration and plugin boundary', () => {
  it('keeps absent credentials disabled and rejects unsafe header values without exposing them', () => {
    expect(readClickUpConfig({})).toEqual({ kind: 'disabled' })
    expect(readClickUpConfig({ CLICKUP_TOKEN: '' })).toEqual({ kind: 'disabled' })
    for (const invalid of [' ', 'pk_bad\r\nInjected: yes', '中文', 'x'.repeat(4097)]) {
      expect(readClickUpConfig({ CLICKUP_TOKEN: invalid })).toEqual({
        kind: 'invalid',
        reason: 'configuration_invalid',
      })
    }
    expect(readClickUpConfig({ CLICKUP_TOKEN: token })).toEqual({ kind: 'enabled', token })
  })
  it.each(['disabled', 'invalid'] as const)(
    'provides an explicit unavailable service when %s',
    async (kind) => {
      const transport = vi.fn()
      const service = createClickUpServices(
        kind === 'disabled' ? { kind } : { kind, reason: 'configuration_invalid' },
        { transport },
      )
      expect(service.available).toBe(false)
      await expect(service.getList('123')).rejects.toMatchObject({
        kind: 'unavailable',
        code: 'CLICKUP_UNAVAILABLE',
      })
      await expect(service.createTask('123', createInput)).rejects.toMatchObject({
        kind: 'unavailable',
      })
      expect(transport).not.toHaveBeenCalled()
    },
  )
  it('registers a disabled service without making a remote request', async () => {
    const app = Fastify()
    try {
      const service = createClickUpServices({ kind: 'disabled' })
      await app.register(plugin, { clickupServices: service })
      await app.ready()
      expect(app.clickupServices).toBe(service)
    } finally {
      await app.close()
    }
  })
  it('rejects missing plugin service at runtime', async () => {
    const app = Fastify()
    try {
      await expect(app.register(plugin, {} as never).ready()).rejects.toMatchObject({
        code: 'BUSINESS_PLUGIN_BOOT_FAILED',
      })
    } finally {
      await app.close()
    }
  })
})

describe('ClickUp official request mapping', () => {
  it('uses a fixed origin, token header and redirect:error for metadata', async () => {
    const { service, requests } = fixture()
    expect(await service.getList('123')).toEqual(list)
    expect(requests[0].url).toBe('https://api.clickup.com/api/v2/list/123')
    expect(requests[0].init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: { Authorization: token },
    })
  })
  it('requests applied object restrictions and preserves dropdown mapping', async () => {
    const { service, requests } = fixture(json({ fields: [field] }))
    expect(await service.getFields('123')).toEqual([field])
    expect(requests[0].url).toBe(
      'https://api.clickup.com/api/v2/list/123/field?include_applied_objects=true',
    )
  })
  it('does not let unrelated label fields prevent scalar dropdown metadata reads', async () => {
    const labels = {
      id: 'labels',
      name: 'Tags',
      type: 'labels',
      type_config: { options: [{ id: 'label-1', label: 'Other' }] },
    }
    expect(await fixture(json({ fields: [labels, field] })).service.getFields('123')).toEqual([
      { id: 'labels', name: 'Tags', type: 'labels', type_config: {} },
      field,
    ])
  })
  it('does not copy complex field values containing provider user identities', async () => {
    const complex = {
      id: 'users',
      name: 'Reviewer',
      type: 'users',
      type_config: {},
      value: [{ email: 'private@example.com' }],
    }
    const { service } = fixture(json({ ...task, custom_fields: [complex] }))
    const parsed = (await service.getTask('abc-123')).custom_fields
    expect(parsed).toEqual([
      { id: 'users', name: 'Reviewer', type: 'users', type_config: {}, hasUnsupportedValue: true },
    ])
    expect(JSON.stringify(parsed)).not.toContain('private@example.com')
  })
  it('does not treat a parsed complex user field as empty for an anonymous complaint', async () => {
    const form = {
      kind: 'complaint' as const,
      title: 'Complaint',
      contentText: 'body',
      largeFileInfo: null,
      anonymous: true,
    }
    const userId = '11111111-1111-4111-8111-111111111111'
    const frozen = frozenTaskInput(form, 'body', '', userId)
    const task_payload_json = JSON.stringify(frozen)
    const validated = validateStoredTask(
      {
        task_payload_json,
        task_payload_sha256: sha256(task_payload_json),
        target_list_id: frozen.listId,
        final_markdown: 'body',
        nickname_snapshot: '',
        user_id: userId,
        form_version: 3,
      },
      form,
    )
    const remote = {
      id: 'task-1',
      name: frozen.task.name,
      list: { id: frozen.listId },
      status: { status: frozen.task.status },
      custom_item_id: frozen.task.custom_item_id,
      markdown_description: 'body',
      custom_fields: [
        {
          id: TARGET.user,
          name: 'User',
          type: 'short_text',
          type_config: {},
          value: { id: 'secret-id', username: 'secret-name' },
        },
      ],
      tags: frozen.task.tags.map((name) => ({ name })),
    }
    const parsed = await fixture(json(remote)).service.getTask('task-1')
    expect(matchesFrozenTask(parsed, validated, 'task-1')).toBe(false)
    expect(JSON.stringify(parsed)).not.toMatch(/secret-id|secret-name/)
  })
  it('reads custom task types from the official custom_items envelope', async () => {
    const { service, requests } = fixture(json({ custom_items: [{ id: 1001, name: 'Bug' }] }))
    expect(await service.getTaskTypes('456')).toEqual([{ id: 1001, name: 'Bug' }])
    expect(requests[0].url).toBe('https://api.clickup.com/api/v2/team/456/custom_item')
  })
  it('reads Space tags and creates a task with the requested tag in one write', async () => {
    const tags = fixture(json({ tags: [{ name: '新增' }, { name: '修改' }] }))
    expect(await tags.service.getSpaceTags('789')).toEqual(['新增', '修改'])
    expect(tags.requests[0].url).toBe('https://api.clickup.com/api/v2/space/789/tag')
    const created = fixture(json({ id: 'abc-123' }))
    await created.service.createTask('123', { ...createInput, tags: ['新增'] })
    expect(JSON.parse(created.requests[0].init.body as string)).toMatchObject({ tags: ['新增'] })
    expect(created.requests).toHaveLength(1)
  })
  it('reads Markdown and strips provider users and attachment URLs', async () => {
    const { service, requests } = fixture(
      json({
        ...task,
        creator: { email: 'private@example.com' },
        url: 'https://evil.test/',
        attachments: [
          {
            id: 'attachment.png',
            title: 'a.png',
            size: 3,
            url: 'https://signed.test/',
            user: { email: 'private@example.com' },
          },
        ],
      }),
    )
    expect(await service.getTask('abc-123')).toEqual({
      ...task,
      attachments: [{ id: 'attachment.png', title: 'a.png', size: 3 }],
    })
    expect(requests[0].url).toBe(
      'https://api.clickup.com/api/v2/task/abc-123?include_markdown_description=true',
    )
  })
  it('returns one bounded List page and does not interpret no results as write proof', async () => {
    const { service, requests } = fixture(json({ tasks: [], last_page: true }))
    expect(await service.listTasks('123', { page: 2, includeClosed: true })).toEqual({
      tasks: [],
      last_page: true,
    })
    expect(requests[0].url).toBe(
      'https://api.clickup.com/api/v2/list/123/task?page=2&include_closed=true&include_markdown_description=true',
    )
  })
  it('preserves nullable ordinary task types in a mixed nonempty List page', async () => {
    const regularTask = { ...task, id: 'regular', custom_item_id: null }
    const { service } = fixture(json({ tasks: [regularTask, task], last_page: true }))
    expect(await service.listTasks('123')).toEqual({
      tasks: [
        { ...regularTask, attachments: [] },
        { ...task, attachments: [] },
      ],
      last_page: true,
    })
  })
  it('preserves a nullable task type in an individual task response', async () => {
    const regularTask = { ...task, custom_item_id: null }
    expect(await fixture(json(regularTask)).service.getTask('abc-123')).toEqual({
      ...regularTask,
      attachments: [],
    })
  })
  it('sends only permitted create fields and returns only a validated task ID', async () => {
    const { service, requests } = fixture(
      json({ id: 'abc-123', creator: { email: 'private@example.com' } }),
    )
    expect(
      await service.createTask('123', { ...createInput, extra: 'ignored' } as typeof createInput),
    ).toEqual({ id: 'abc-123' })
    expect(requests[0].url).toBe('https://api.clickup.com/api/v2/list/123/task')
    expect(JSON.parse(requests[0].init.body as string)).toEqual(createInput)
  })
  it('sends one raw multipart attachment preserving the visible bytes and original name', async () => {
    const { service, requests } = fixture(
      json({ id: 'attachment.png', title: 'a.png', url: 'https://signed.test/' }),
    )
    const bytes = new Uint8Array([0, 1, 2, 3]).subarray(1, 3)
    expect(
      await service.uploadAttachment('abc-123', {
        bytes,
        filename: 'a.png',
        contentType: 'image/png',
      }),
    ).toEqual({ id: 'attachment.png', title: 'a.png' })
    const body = requests[0].init.body as FormData
    expect([...body.keys()]).toEqual(['attachment'])
    const file = body.get('attachment') as File
    expect(file.name).toBe('a.png')
    expect(file.type).toBe('image/png')
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2])
    expect(requests[0].init.headers).not.toHaveProperty('Content-Type')
  })
  it('uploads raw Blob content while applying the explicit media type', async () => {
    const { service, requests } = fixture(json({ id: 'attachment.bin' }))
    await service.uploadAttachment('abc', {
      bytes: new Blob(['data'], { type: 'text/html' }),
      filename: '文件.bin',
      contentType: 'application/octet-stream',
    })
    const file = (requests[0].init.body as FormData).get('attachment') as File
    expect(await file.text()).toBe('data')
    expect(file.name).toBe('文件.bin')
    expect(file.type).toBe('application/octet-stream')
  })
  it.each(['', '../evil', 'a/b', 'id?x=y', 'x'.repeat(129)])(
    'rejects unsafe task ID %j before transport',
    async (id) => {
      const { service, requests } = fixture()
      await expect(service.getTask(id)).rejects.toMatchObject({ kind: 'invalid_input' })
      expect(requests).toHaveLength(0)
      expect(() => clickUpTaskUrl(id)).toThrow(ClickUpError)
    },
  )
  it('builds the task URL itself', () => {
    expect(clickUpTaskUrl('Abc-_1')).toBe('https://app.clickup.com/t/Abc-_1')
  })
})

describe('ClickUp bounded and conservative failure classification', () => {
  it.each([400, 401, 403, 404, 413, 422])(
    'classifies received %i as explicit rejection without provider body',
    async (status) => {
      const { service } = fixture(
        json({ err: `${token} provider secret`, ECODE: 'secret' }, status),
      )
      const error = await service.createTask('123', createInput).catch((e) => e)
      expect(error).toMatchObject({
        kind: 'rejected',
        code: status === 401 || status === 403 ? 'UPSTREAM_CONFIGURATION' : 'UPSTREAM_REJECTED',
        retryAfterSeconds: null,
      })
      expect(JSON.stringify(error)).not.toContain(token)
      expect(error.message).not.toContain('secret')
      expect(error.cause).toBeUndefined()
    },
  )
  it('classifies 429 with a safe retry interval', async () => {
    const { service } = fixture(json({}, 429, { 'Retry-After': '7' }))
    await expect(service.createTask('123', createInput)).rejects.toMatchObject({
      kind: 'rate_limited',
      code: 'UPSTREAM_RATE_LIMITED',
      retryAfterSeconds: 7,
    })
  })
  it('uses the later retry/reset bound and ignores unsafe values', async () => {
    const { service } = fixture(
      json({}, 429, { 'Retry-After': '2', 'x-ratelimit-reset': '1700000010' }),
    )
    await expect(service.createTask('123', createInput)).rejects.toMatchObject({
      retryAfterSeconds: 10,
    })
    const invalid = fixture(json({}, 429, { 'Retry-After': '9007199254740992' }))
    await expect(invalid.service.createTask('123', createInput)).rejects.toMatchObject({
      retryAfterSeconds: null,
    })
  })
  it.each([302, 408, 409, 500, 503])('keeps ambiguous HTTP %i unknown', async (status) => {
    const { service } = fixture(json({ error: 'private' }, status))
    await expect(service.createTask('123', createInput)).rejects.toMatchObject({
      kind: 'unknown',
      code: 'UPSTREAM_UNKNOWN',
    })
  })
  it.each([{}, { id: '../evil' }, { id: 3 }])(
    'treats malformed create success %j as unknown',
    async (body) => {
      await expect(
        fixture(json(body)).service.createTask('123', createInput),
      ).rejects.toMatchObject({ kind: 'unknown' })
    },
  )
  it('sanitizes connection failures and never retries a write', async () => {
    const { service, requests } = fixture(async () => {
      throw new Error(token)
    })
    await expect(service.createTask('123', createInput)).rejects.toMatchObject({
      kind: 'unknown',
      message: 'ClickUp 操作结果未知。',
    })
    expect(requests).toHaveLength(1)
  })
  it('bounds streamed responses even without Content-Length and cancels the reader', async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(512 * 1024))
      },
      cancel() {
        cancelled = true
      },
    })
    await expect(
      fixture(new Response(stream)).service.createTask('123', createInput),
    ).rejects.toMatchObject({ kind: 'unknown' })
    expect(cancelled).toBe(true)
  })
  it('allows a valid JSON response at exactly 2 MiB and rejects one byte more', async () => {
    const small = JSON.stringify({ id: 'abc-123', unused: '' })
    const exact = JSON.stringify({
      id: 'abc-123',
      unused: 'a'.repeat(2 * 1024 * 1024 - small.length),
    })
    await expect(
      fixture(new Response(exact)).service.createTask('123', createInput),
    ).resolves.toEqual({ id: 'abc-123' })
    await expect(
      fixture(new Response(exact + ' ')).service.createTask('123', createInput),
    ).rejects.toMatchObject({ kind: 'unknown' })
  })
  it('rejects an oversized Content-Length without reading the body', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start() {},
      cancel() {
        cancelled = true
      },
    })
    await expect(
      fixture(new Response(body, { headers: { 'Content-Length': '2097153' } })).service.createTask(
        '123',
        createInput,
      ),
    ).rejects.toMatchObject({ kind: 'unknown' })
    expect(cancelled).toBe(true)
  })
  it.each([
    new Response('not json'),
    new Response(new Uint8Array([0xff])),
    new Response(null, { status: 204 }),
  ])('treats unreadable success bodies as unknown', async (response) => {
    await expect(fixture(response).service.createTask('123', createInput)).rejects.toMatchObject({
      kind: 'unknown',
    })
  })
  it('treats a disconnect while reading a successful response as unknown', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error(token))
      },
    })
    await expect(
      fixture(new Response(body)).service.createTask('123', createInput),
    ).rejects.toMatchObject({ kind: 'unknown' })
  })
  it('does not let redirects turn into explicit rejection classifications', async () => {
    const response = json({}, 401)
    Object.defineProperty(response, 'redirected', { value: true })
    await expect(fixture(response).service.createTask('123', createInput)).rejects.toMatchObject({
      kind: 'unknown',
    })
  })
  it('handles valid HTTP-date retry hints as bounded seconds', async () => {
    const { service } = fixture(json({}, 429, { 'Retry-After': 'Tue, 14 Nov 2023 22:13:25 GMT' }))
    await expect(service.createTask('123', createInput)).rejects.toMatchObject({
      retryAfterSeconds: 5,
    })
  })
  it.each(['metadata', 'create', 'upload'] as const)(
    'aborts %s after its complete response deadline',
    async (operation) => {
      vi.useFakeTimers()
      let signal: AbortSignal | undefined
      const service = createClickUpServices(
        { kind: 'enabled', token },
        {
          transport: async (_, init) => {
            signal = init.signal as AbortSignal
            return new Response(new ReadableStream<Uint8Array>({ start() {} }))
          },
        },
      )
      const pending =
        operation === 'metadata'
          ? service.getList('123')
          : operation === 'create'
            ? service.createTask('123', createInput)
            : service.uploadAttachment('abc', {
                bytes: new Uint8Array([1]),
                filename: 'a',
                contentType: 'application/octet-stream',
              })
      const assertion = expect(pending).rejects.toMatchObject({ kind: 'unknown' })
      const deadline = operation === 'metadata' ? 10_000 : operation === 'create' ? 30_000 : 60_000
      await vi.advanceTimersByTimeAsync(deadline - 1)
      expect(signal?.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await assertion
      expect(signal?.aborted).toBe(true)
    },
  )
})
