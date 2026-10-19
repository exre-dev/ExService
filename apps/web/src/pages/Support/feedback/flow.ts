import type { components } from '@workspace/sdk/types'
import { normalizeMime } from '@workspace/common/feedback-content'
import { belongsToArea } from './kind-rules'

export type FeedbackForm = components['schemas']['FeedbackForm']
export type FeedbackSnapshot = components['schemas']['FeedbackSnapshot']
export type FeedbackArea = components['schemas']['FeedbackArea']
type Prepare = components['schemas']['FeedbackPrepare']
type Advance = components['schemas']['FeedbackAdvance']
export interface FeedbackPort {
  prepare(input: Prepare): Promise<FeedbackSnapshot>
  get(id: string): Promise<FeedbackSnapshot>
  lookup(key: string): Promise<FeedbackSnapshot>
  upload(id: string, attachmentId: string, file: File): Promise<FeedbackSnapshot>
  advance(id: string, input: Advance): Promise<FeedbackSnapshot>
}
type Pointer = { submissionKey: string; submissionId?: string }
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export async function fileDigest(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}
export class FeedbackStopped extends Error {}

/** Browser commands never infer success from HTTP status or regenerate a key on failure. */
export class FeedbackFlow {
  private pending: Prepare | undefined
  private files: File[] = []
  private epoch = 0
  private runningEpoch: number | null = null
  snapshot: FeedbackSnapshot | undefined
  readonly storageKey: string
  constructor(
    private readonly port: FeedbackPort,
    private readonly storage: StoragePort,
    private readonly changed: (snapshot: FeedbackSnapshot) => void,
    private readonly active: () => boolean,
    private readonly delay: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly area: FeedbackArea = 'development',
  ) {
    this.storageKey =
      area === 'community' ? 'exwebsite.feedback.community.v1' : 'exwebsite.feedback.v2'
    if (area === 'development') {
      this.storage.removeItem('exwebsite.feedback.v1.request')
      this.storage.removeItem('exwebsite.feedback.v1.bug')
    }
  }
  stop(forgetMemory = false): void {
    this.epoch++
    if (forgetMemory) {
      this.pending = undefined
      this.files = []
      this.snapshot = undefined
    }
  }
  canReplayPrepare(): boolean {
    return Boolean(this.pending)
  }
  async replayPrepare(): Promise<FeedbackSnapshot | undefined> {
    if (!this.pending) throw new Error('请先核对原提交')
    return this.submit(this.pending.form, this.files)
  }
  hasPending(): boolean {
    return Boolean(this.pending || this.snapshot || this.pointer())
  }
  pointer(): Pointer | null {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return null
    try {
      const value: unknown = JSON.parse(raw)
      if (
        value &&
        typeof value === 'object' &&
        'submissionKey' in value &&
        typeof value.submissionKey === 'string' &&
        uuid.test(value.submissionKey) &&
        (!('submissionId' in value) ||
          (typeof value.submissionId === 'string' && uuid.test(value.submissionId)))
      )
        return value as Pointer
    } catch {
      /* invalid identifier does not become a command */
    }
    this.storage.removeItem(this.storageKey)
    return null
  }
  private ensure(epoch: number): void {
    if (epoch !== this.epoch || !this.active()) throw new FeedbackStopped()
  }
  private checkForm(form: FeedbackForm): void {
    if (!belongsToArea(form.kind, this.area)) throw new Error('反馈类型不属于当前入口')
  }
  private accept(snapshot: FeedbackSnapshot, epoch: number): FeedbackSnapshot {
    this.ensure(epoch)
    this.checkForm(snapshot.form)
    this.snapshot = snapshot
    this.storage.setItem(
      this.storageKey,
      JSON.stringify({ submissionKey: snapshot.submissionKey, submissionId: snapshot.id }),
    )
    if (epoch === this.epoch && this.active()) this.changed(snapshot)
    return snapshot
  }
  private async run<T>(work: (epoch: number) => Promise<T>): Promise<T> {
    const epoch = this.epoch
    if (this.runningEpoch === epoch) throw new Error('反馈正在处理中，请先核对当前进度')
    this.runningEpoch = epoch
    try {
      this.ensure(epoch)
      return await work(epoch)
    } catch (error) {
      this.ensure(epoch)
      throw error
    } finally {
      if (this.runningEpoch === epoch) this.runningEpoch = null
    }
  }
  async recover(): Promise<FeedbackSnapshot | null> {
    return this.run(async (epoch) => {
      const pointer = this.pointer()
      if (!pointer) return null
      try {
        const result = pointer.submissionId
          ? await this.port.get(pointer.submissionId)
          : await this.port.lookup(pointer.submissionKey)
        this.ensure(epoch)
        if (
          result.submissionKey !== pointer.submissionKey ||
          (pointer.submissionId && result.id !== pointer.submissionId) ||
          !belongsToArea(result.form.kind, this.area)
        ) {
          this.storage.removeItem(this.storageKey)
          throw new Error('反馈记录不属于当前入口')
        }
        return this.accept(result, epoch)
      } catch (error) {
        this.ensure(epoch)
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null
        if (pointer.submissionId && code === 'NOT_FOUND') {
          this.reset()
          return null
        }
        throw error
      }
    })
  }
  reset(): void {
    this.stop()
    this.pending = undefined
    this.snapshot = undefined
    this.files = []
    this.storage.removeItem(this.storageKey)
  }
  async submit(form: Prepare['form'], files: File[]): Promise<FeedbackSnapshot | undefined> {
    return this.run(async (epoch) => {
      this.checkForm(form)
      if (!this.pending && !this.snapshot) {
        if (this.pointer()) throw new Error('请先核对原提交')
        const attachments: Prepare['attachments'] = []
        for (const file of files) {
          this.ensure(epoch)
          attachments.push({
            id: crypto.randomUUID(),
            originalName: file.name,
            contentType: normalizeMime(file.type),
            byteLength: file.size,
            sha256: await fileDigest(file),
          })
        }
        this.ensure(epoch)
        this.pending = { submissionKey: crypto.randomUUID(), form, attachments }
        this.files = [...files]
        this.storage.setItem(
          this.storageKey,
          JSON.stringify({ submissionKey: this.pending.submissionKey }),
        )
      }
      let snapshot = this.snapshot
      if (!snapshot) {
        this.storage.setItem(
          this.storageKey,
          JSON.stringify({ submissionKey: this.pending!.submissionKey }),
        )
        try {
          snapshot = await this.port.prepare(this.pending!)
        } catch (error) {
          this.ensure(epoch)
          // A lost response can already have committed; lookup never changes the key.
          try {
            snapshot = await this.port.lookup(this.pending!.submissionKey)
          } catch {
            throw error
          }
        }
        this.accept(snapshot, epoch)
      }
      this.ensure(epoch)
      return this.drive(snapshot, epoch, 'continue')
    })
  }
  async continue(
    files: File[],
    intent: 'continue' | 'retry' = 'continue',
  ): Promise<FeedbackSnapshot | undefined> {
    return this.run(async (epoch) => {
      if (!this.snapshot) throw new Error('请先核对提交进度')
      this.checkForm(this.snapshot.form)
      if (files.length) this.files = [...files]
      return this.drive(this.snapshot, epoch, intent)
    })
  }
  private async readAfterFailure(
    snapshot: FeedbackSnapshot,
    epoch: number,
  ): Promise<FeedbackSnapshot> {
    const read = await this.port.get(snapshot.id)
    this.ensure(epoch)
    return this.accept(read, epoch)
  }
  private async drive(
    initial: FeedbackSnapshot,
    epoch: number,
    intent: 'continue' | 'retry',
  ): Promise<FeedbackSnapshot> {
    this.checkForm(initial.form)
    let snapshot = initial,
      waitMs = 1000
    const deadline = Date.now() + 180000
    for (;;) {
      this.ensure(epoch)
      if (snapshot.nextAction === 'done') {
        this.storage.removeItem(this.storageKey)
        this.pending = undefined
        this.files = []
        return snapshot
      }
      if (
        snapshot.nextAction === 'verify' ||
        snapshot.nextAction === 'restart' ||
        (snapshot.nextAction === 'retry' && intent !== 'retry')
      )
        return snapshot
      if (snapshot.nextAction === 'wait') {
        if (Date.now() > deadline) return snapshot
        await this.delay(waitMs)
        this.ensure(epoch)
        waitMs = Math.min(5000, waitMs + 1000)
        snapshot = await this.readAfterFailure(snapshot, epoch)
        continue
      }
      if (snapshot.nextAction === 'upload') {
        const missing = snapshot.attachments.filter((file) => file.status === 'expected')
        for (const attachment of missing) {
          let file: File | undefined
          for (const candidate of this.files)
            if (
              candidate.name === attachment.originalName &&
              candidate.size === attachment.byteLength &&
              normalizeMime(candidate.type) === attachment.contentType &&
              (await fileDigest(candidate)) === attachment.sha256
            ) {
              file = candidate
              break
            }
          if (!file) throw new Error('请选择与原清单一致的缺失附件')
          this.ensure(epoch)
          try {
            snapshot = await this.port.upload(snapshot.id, attachment.id, file)
            this.accept(snapshot, epoch)
          } catch (error) {
            this.ensure(epoch)
            snapshot = await this.readAfterFailure(snapshot, epoch)
            if (
              snapshot.attachments.find((file) => file.id === attachment.id)?.status === 'expected'
            )
              throw error
          }
        }
      }
      this.ensure(epoch)
      const before = snapshot.revision
      try {
        snapshot = await this.port.advance(snapshot.id, { expectedRevision: before, intent })
        this.accept(snapshot, epoch)
      } catch (error) {
        this.ensure(epoch)
        snapshot = await this.readAfterFailure(snapshot, epoch)
        if (snapshot.revision === before) throw error
      }
      intent = 'continue'
      if (snapshot.nextAction === 'continue' && snapshot.revision <= before) return snapshot
    }
  }
}
