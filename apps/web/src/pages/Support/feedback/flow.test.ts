import { expect, it, vi } from 'vitest'
import type { components } from '@workspace/sdk/types'
import { FeedbackFlow, FeedbackStopped, type FeedbackPort } from './flow'

type Snapshot = components['schemas']['FeedbackSnapshotData']
const form: components['schemas']['FeedbackForm'] = {
  kind: 'request',
  title: '标题',
  typeOptionId: null,
  largeFileInfo: null,
  contentText: '内容',
}
const initial = (): Snapshot => ({
  id: '11111111-1111-4111-8111-111111111111',
  submissionKey: '22222222-2222-4222-8222-222222222222',
  revision: 0,
  form,
  createdAt: 1,
  receiveExpiresAt: 86401,
  status: 'receiving',
  nextAction: 'upload',
  taskId: null,
  taskUrl: null,
  failure: null,
  attachments: [],
})
function harness(area: 'development' | 'community' = 'development') {
  let state = initial()
  const storage = new Map<string, string>()
  const port: FeedbackPort = {
    prepare: vi.fn(async (input) => {
      state = { ...state, submissionKey: input.submissionKey }
      return state
    }),
    get: vi.fn(async () => state),
    lookup: vi.fn(async () => state),
    upload: vi.fn(async () => state),
    advance: vi.fn(async (_id, input) => {
      state = {
        ...state,
        revision: input.expectedRevision + 1,
        status: 'completed',
        nextAction: 'done',
        taskId: null,
        taskUrl: null,
      }
      return state
    }),
  }
  const changed = vi.fn()
  const flow = new FeedbackFlow(
    port,
    {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    },
    changed,
    () => true,
    area,
    `exwebsite.php.feedback.v1:test:${area}`,
  )
  return {
    flow,
    port,
    storage,
    changed,
    setState: (next: Snapshot) => {
      state = next
    },
  }
}
it('only finishes after done and clears identifier-only recovery storage', async () => {
  const h = harness()
  const done = await h.flow.submit(form, [])
  expect(done?.nextAction).toBe('done')
  expect(h.port.advance).toHaveBeenCalledWith(expect.any(String), {
    expectedRevision: 0,
    intent: 'continue',
  })
  expect(h.storage.size).toBe(0)
})
it('uses a separate community pointer and rejects forms outside its area before writing', async () => {
  const development = harness()
  const community = harness('community')
  expect(development.flow.storageKey).toBe('exwebsite.php.feedback.v1:test:development')
  expect(community.flow.storageKey).toBe('exwebsite.php.feedback.v1:test:community')
  await expect(community.flow.submit(form, [])).rejects.toThrow()
  expect(community.port.prepare).not.toHaveBeenCalled()
  expect(community.storage.size).toBe(0)
  await expect(
    development.flow.submit(
      {
        kind: 'complaint',
        title: '投诉',
        contentText: '内容',
        largeFileInfo: null,
        anonymous: false,
      },
      [],
    ),
  ).rejects.toThrow()
  expect(development.port.prepare).not.toHaveBeenCalled()
})
it('rejects a wrong-area recovered snapshot before accepting or advancing it', async () => {
  const h = harness('community')
  const key = initial().submissionKey
  h.storage.set(
    h.flow.storageKey,
    JSON.stringify({ submissionKey: key, submissionId: initial().id }),
  )
  await expect(h.flow.recover()).rejects.toThrow()
  expect(h.port.get).toHaveBeenCalledOnce()
  expect(h.port.advance).not.toHaveBeenCalled()
  expect(h.changed).not.toHaveBeenCalled()
  expect(h.flow.snapshot).toBeUndefined()
  expect(h.storage.has(h.flow.storageKey)).toBe(false)
})
it('rejects a recovered pointer whose returned key differs from the saved key', async () => {
  const h = harness()
  h.storage.set(
    h.flow.storageKey,
    JSON.stringify({
      submissionKey: '33333333-3333-4333-8333-333333333333',
      submissionId: initial().id,
    }),
  )
  await expect(h.flow.recover()).rejects.toThrow()
  expect(h.flow.snapshot).toBeUndefined()
  expect(h.storage.has(h.flow.storageKey)).toBe(false)
})
it('does not advance a community prepare response carrying a development form', async () => {
  const h = harness('community')
  vi.mocked(h.port.prepare).mockResolvedValueOnce(initial())
  const complaint = {
    kind: 'complaint',
    title: '投诉',
    contentText: '正文',
    largeFileInfo: null,
    anonymous: true,
  } as const
  await expect(h.flow.submit(complaint, [])).rejects.toThrow()
  expect(h.port.advance).not.toHaveBeenCalled()
  expect(h.flow.snapshot).toBeUndefined()
})
it('forgets frozen private content on account switch without replaying it as the next account', async () => {
  const h = harness('community')
  const complaint = {
    kind: 'complaint',
    title: 'A 的投诉',
    contentText: 'A 的私密正文',
    largeFileInfo: null,
    anonymous: true,
  } as const
  vi.mocked(h.port.prepare).mockRejectedValueOnce(new Error('offline'))
  vi.mocked(h.port.lookup).mockRejectedValueOnce({ code: 'NOT_FOUND' })
  await expect(h.flow.submit(complaint, [])).rejects.toThrow()
  expect(h.flow.canReplayPrepare()).toBe(true)
  const pointer = h.storage.get(h.flow.storageKey)
  h.flow.stop(true)
  expect(h.flow.canReplayPrepare()).toBe(false)
  expect(h.flow.snapshot).toBeUndefined()
  expect(h.storage.get(h.flow.storageKey)).toBe(pointer)
  vi.mocked(h.port.lookup).mockRejectedValueOnce({ code: 'NOT_FOUND' })
  await expect(h.flow.recover()).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(h.flow.replayPrepare()).rejects.toThrow('请先核对原提交')
  expect(h.port.prepare).toHaveBeenCalledTimes(1)
})
it('does not let a stopped recovery delete a replacement pointer after NOT_FOUND', async () => {
  const h = harness()
  const old = JSON.stringify({ submissionKey: initial().submissionKey, submissionId: initial().id })
  const replacement = JSON.stringify({ submissionKey: '33333333-3333-4333-8333-333333333333' })
  h.storage.set(h.flow.storageKey, old)
  let rejectGet!: (reason: unknown) => void
  vi.mocked(h.port.get).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectGet = reject
      }),
  )
  const recovery = h.flow.recover()
  h.flow.stop(true)
  h.storage.set(h.flow.storageKey, replacement)
  rejectGet({ code: 'NOT_FOUND' })
  await expect(recovery).rejects.toBeInstanceOf(FeedbackStopped)
  expect(h.storage.get(h.flow.storageKey)).toBe(replacement)
})
it('does not let a stopped prepare response replace a new account pointer', async () => {
  const h = harness()
  let resolvePrepare!: (snapshot: Snapshot) => void
  vi.mocked(h.port.prepare).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolvePrepare = resolve
      }),
  )
  const submission = h.flow.submit(form, [])
  await vi.waitFor(() => expect(h.port.prepare).toHaveBeenCalledOnce())
  h.flow.stop(true)
  const replacement = JSON.stringify({ submissionKey: '33333333-3333-4333-8333-333333333333' })
  h.storage.set(h.flow.storageKey, replacement)
  resolvePrepare(initial())
  await expect(submission).rejects.toBeInstanceOf(FeedbackStopped)
  expect(h.storage.get(h.flow.storageKey)).toBe(replacement)
  expect(h.flow.snapshot).toBeUndefined()
  expect(h.port.advance).not.toHaveBeenCalled()
})
it('lets the next account recover while a stopped request is still unresolved', async () => {
  const h = harness()
  let resolvePrepare!: (snapshot: Snapshot) => void
  vi.mocked(h.port.prepare).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolvePrepare = resolve
      }),
  )
  const oldSubmission = h.flow.submit(form, [])
  await vi.waitFor(() => expect(h.port.prepare).toHaveBeenCalledOnce())
  h.flow.stop(true)
  const next = { ...initial(), submissionKey: '33333333-3333-4333-8333-333333333333' }
  h.storage.set(h.flow.storageKey, JSON.stringify({ submissionKey: next.submissionKey }))
  vi.mocked(h.port.lookup).mockResolvedValueOnce(next)
  expect(await h.flow.recover()).toEqual(next)
  resolvePrepare(initial())
  await expect(oldSubmission).rejects.toBeInstanceOf(FeedbackStopped)
  expect(h.flow.snapshot).toEqual(next)
  expect(JSON.parse(h.storage.get(h.flow.storageKey)!)).toEqual({
    submissionKey: next.submissionKey,
    submissionId: next.id,
  })
})
it('reuses a frozen prepare key and payload after a lost prepare response', async () => {
  const h = harness()
  vi.mocked(h.port.prepare).mockRejectedValueOnce(new Error('network'))
  vi.mocked(h.port.lookup).mockRejectedValueOnce(new Error('not yet found'))
  await expect(h.flow.submit(form, [])).rejects.toThrow()
  const pointer = [...h.storage.values()][0]!
  expect(pointer).not.toContain('内容')
  expect(pointer).not.toContain('标题')
  await h.flow.submit({ ...form, title: '不同内容' }, [])
  const calls = vi.mocked(h.port.prepare).mock.calls
  expect(calls[0]![0]).toEqual(calls[1]![0])
})
it('keeps an unchanged receiving snapshot after an ambiguous failed advance', async () => {
  const h = harness()
  vi.mocked(h.port.advance).mockRejectedValueOnce(new Error('timeout'))
  await expect(h.flow.submit(form, [])).rejects.toThrow('timeout')
  expect(h.port.advance).toHaveBeenCalledTimes(1)
  expect(h.port.get).toHaveBeenCalledTimes(1)
  expect(h.flow.snapshot?.status).toBe('receiving')
  expect(h.flow.pointer()).not.toBeNull()
})
it('reconciles completed PHP state after a lost advance response', async () => {
  const h = harness()
  vi.mocked(h.port.advance).mockImplementationOnce(async () => {
    h.setState({ ...initial(), revision: 1, status: 'completed', nextAction: 'done' })
    throw new Error('timeout')
  })
  expect((await h.flow.submit(form, []))?.nextAction).toBe('done')
  expect(h.port.advance).toHaveBeenCalledTimes(1)
  expect(h.port.get).toHaveBeenCalledTimes(1)
  expect(h.flow.pointer()).toBeNull()
})

it('reconciles an uploaded attachment after a lost PUT response using its declared digest and ID', async () => {
  const h = harness()
  const file = new File(['evidence'], 'evidence.txt', { type: 'text/plain' })
  vi.mocked(h.port.prepare).mockImplementationOnce(async (input) => {
    const state: Snapshot = {
      ...initial(),
      submissionKey: input.submissionKey,
      attachments: input.attachments.map((attachment, ordinal) => ({
        ...attachment,
        id: attachment.id!,
        ordinal,
        status: 'expected',
        remoteAttachmentId: null,
      })),
    }
    h.setState(state)
    return state
  })
  vi.mocked(h.port.upload).mockImplementationOnce(async (id, attachmentId) => {
    const state = h.flow.snapshot!
    h.setState({
      ...state,
      revision: 1,
      nextAction: 'continue',
      attachments: state.attachments.map((item) =>
        item.id === attachmentId ? { ...item, status: 'uploaded' } : item,
      ),
    })
    expect(id).toBe(state.id)
    throw new Error('response lost')
  })
  expect((await h.flow.submit(form, [file]))?.status).toBe('completed')
  const input = vi.mocked(h.port.prepare).mock.calls[0]![0]
  expect(input.attachments[0]).toMatchObject({ byteLength: 8, originalName: 'evidence.txt' })
  expect(input.attachments[0]!.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(h.port.upload).toHaveBeenCalledWith(initial().id, input.attachments[0]!.id, file)
  expect(h.port.advance).toHaveBeenCalledWith(initial().id, {
    expectedRevision: 1,
    intent: 'continue',
  })
})

it('refreshes a 409 snapshot and advances only the new revision', async () => {
  const h = harness()
  vi.mocked(h.port.advance).mockImplementationOnce(async () => {
    h.setState({ ...initial(), revision: 2, nextAction: 'continue' })
    throw { status: 409 }
  })
  expect((await h.flow.submit(form, []))?.status).toBe('completed')
  expect(h.port.get).toHaveBeenCalledTimes(1)
  expect(h.port.advance).toHaveBeenNthCalledWith(2, initial().id, {
    expectedRevision: 2,
    intent: 'continue',
  })
})
