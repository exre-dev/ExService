import { ClickUpError, assertClickUpTaskId } from './errors.js'

export type ClickUpTransport = (url: string, init: RequestInit) => Promise<Response>
export interface ClickUpList {
  id: string
  name: string
  space: { id: string }
  statuses: Array<{ status: string; type?: string }>
}
export interface ClickUpField {
  id: string
  name: string
  type: string
  type_config: {
    options?: Array<{ id: string; name: string; color?: string; orderindex?: number | string }>
  }
  applied_objects?: Array<{ object_type: number; object_id: number | string }>
  value?: string | number | boolean | null
  /** The provider supplied an unsupported value; its contents are intentionally discarded. */
  hasUnsupportedValue?: true
}
export interface ClickUpTaskType {
  id: number
  name: string
}
export interface ClickUpAttachment {
  id: string
  title?: string
  size?: number
}
export interface ClickUpTask {
  id: string
  name: string
  list: { id: string }
  status: { status: string }
  custom_item_id: number | null
  markdown_description: string
  custom_fields: ClickUpField[]
  attachments: ClickUpAttachment[]
  tags: string[]
}
export interface ClickUpCreateTask {
  name: string
  markdown_content: string
  custom_item_id: number
  status: string
  custom_fields: Array<{ id: string; value: string | number | boolean }>
  tags: string[]
}
export interface ClickUpUploadAttachment {
  bytes: Blob | Uint8Array
  filename: string
  contentType: string
}
export interface ClickUpListTasksOptions {
  page?: number
  includeClosed?: boolean
}
export interface ClickUpTaskPage {
  tasks: ClickUpTask[]
  last_page?: boolean
}
export interface ClickUpServices {
  readonly available: boolean
  readonly reason: 'not_configured' | 'configuration_invalid' | null
  getList(listId: string): Promise<ClickUpList>
  getFields(listId: string): Promise<ClickUpField[]>
  getTaskTypes(workspaceId: string): Promise<ClickUpTaskType[]>
  getSpaceTags(spaceId: string): Promise<string[]>
  getTask(taskId: string): Promise<ClickUpTask>
  listTasks(listId: string, options?: ClickUpListTasksOptions): Promise<ClickUpTaskPage>
  createTask(listId: string, input: ClickUpCreateTask): Promise<{ id: string }>
  uploadAttachment(taskId: string, input: ClickUpUploadAttachment): Promise<ClickUpAttachment>
}
export interface ClickUpServiceOptions {
  transport?: ClickUpTransport
  now?: () => number
}
const API_ORIGIN = 'https://api.clickup.com/api/v2'
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
function invalidInput(): never {
  throw new ClickUpError('invalid_input', 'CLICKUP_INVALID_INPUT')
}
function unknown(): never {
  throw new ClickUpError('unknown', 'UPSTREAM_UNKNOWN')
}
function numericId(id: string): string {
  if (typeof id !== 'string' || !/^[0-9]{1,20}$/.test(id)) invalidInput()
  return id
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) unknown()
  return value as Record<string, unknown>
}
function text(value: unknown, max = MAX_RESPONSE_BYTES): string {
  if (typeof value !== 'string' || value.length > max) unknown()
  return value
}
function id(value: unknown): string {
  const result = text(value, 256)
  if (result.length === 0 || /[\x00-\x1f\x7f]/.test(result)) unknown()
  return result
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) unknown()
  return value
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) unknown()
  return value
}
function taskId(value: unknown): string {
  const result = text(value, 128)
  try {
    assertClickUpTaskId(result)
  } catch {
    unknown()
  }
  return result
}
function parseAttachment(value: unknown): ClickUpAttachment {
  const item = object(value)
  return {
    id: id(item.id),
    ...(item.title === undefined ? {} : { title: text(item.title, 1024) }),
    ...(item.size === undefined ? {} : { size: integer(item.size) }),
  }
}
function parseField(value: unknown): ClickUpField {
  const field = object(value)
  const config = object(field.type_config)
  const fieldType = text(field.type, 128)
  const options =
    fieldType !== 'drop_down' || config.options === undefined
      ? undefined
      : array(config.options).map((value) => {
          const option = object(value)
          let orderindex: number | string | undefined
          if (option.orderindex !== undefined) {
            orderindex =
              typeof option.orderindex === 'string'
                ? text(option.orderindex, 32)
                : integer(option.orderindex)
          }
          return {
            id: id(option.id),
            name: text(option.name, 4096),
            ...(option.color === undefined ? {} : { color: text(option.color, 32) }),
            ...(orderindex === undefined ? {} : { orderindex }),
          }
        })
  const applied =
    field.applied_objects === undefined
      ? undefined
      : array(field.applied_objects).map((value) => {
          const scope = object(value)
          return {
            object_type: integer(scope.object_type),
            object_id:
              typeof scope.object_id === 'string' ? id(scope.object_id) : integer(scope.object_id),
          }
        })
  const remoteValue = field.value
  // Complex Custom Fields may contain full user objects. Keep only their
  // presence so privacy checks can fail closed without retaining identities.
  const scalar =
    remoteValue === null ||
    typeof remoteValue === 'string' ||
    typeof remoteValue === 'boolean' ||
    (typeof remoteValue === 'number' && Number.isFinite(remoteValue))
  return {
    id: id(field.id),
    name: text(field.name, 4096),
    type: fieldType,
    type_config: options === undefined ? {} : { options },
    ...(applied === undefined ? {} : { applied_objects: applied }),
    ...(scalar ? { value: remoteValue as string | number | boolean | null } : {}),
    ...(remoteValue !== undefined && !scalar ? { hasUnsupportedValue: true as const } : {}),
  }
}
function parseTask(value: unknown): ClickUpTask {
  const task = object(value)
  const tags =
    task.tags === undefined ? [] : array(task.tags).map((value) => text(object(value).name, 255))
  return {
    id: taskId(task.id),
    name: text(task.name),
    list: { id: id(object(task.list).id) },
    status: { status: text(object(task.status).status, 4096) },
    custom_item_id: task.custom_item_id === null ? null : integer(task.custom_item_id),
    markdown_description: text(task.markdown_description),
    custom_fields: array(task.custom_fields).map(parseField),
    attachments: task.attachments === undefined ? [] : array(task.attachments).map(parseAttachment),
    tags,
  }
}
function positiveSeconds(value: number): number | null {
  const seconds = Math.ceil(value)
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null
}
function retryAfter(headers: Headers, now: number): number | null {
  const retry = headers.get('retry-after')
  const reset = headers.get('x-ratelimit-reset')
  const values: number[] = []
  if (retry !== null) {
    const parsed = /^\d+$/.test(retry)
      ? positiveSeconds(Number(retry))
      : positiveSeconds((Date.parse(retry) - now) / 1000)
    if (parsed !== null) values.push(parsed)
  }
  if (reset !== null && /^\d+$/.test(reset)) {
    const resetSeconds = Number(reset)
    if (Number.isSafeInteger(resetSeconds)) {
      const parsed = positiveSeconds(resetSeconds - now / 1000)
      if (parsed !== null) values.push(parsed)
    }
  }
  return values.length ? Math.max(...values) : null
}
function cancelResponse(response: Response): void {
  // Never wait on a provider's potentially stalled cancellation.
  if (response.body && !response.body.locked) void response.body.cancel().catch(() => {})
}
async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const declared = response.headers.get('content-length')
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_RESPONSE_BYTES) {
    cancelResponse(response)
    unknown()
  }
  if (!response.body) unknown()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      if (signal.aborted) unknown()
      const result = await reader.read()
      if (result.done) break
      length += result.value.byteLength
      if (length > MAX_RESPONSE_BYTES) unknown()
      chunks.push(result.value)
    }
    if (signal.aborted) unknown()
    const bytes = new Uint8Array(length)
    let position = 0
    for (const chunk of chunks) {
      bytes.set(chunk, position)
      position += chunk.byteLength
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
    reader.releaseLock()
  }
}

export function createEnabledClickUpServices(
  token: string,
  options: ClickUpServiceOptions = {},
): ClickUpServices {
  const transport = options.transport ?? ((url, init) => fetch(url, init))
  const now = options.now ?? Date.now
  async function request<T>(
    path: string,
    timeout: number,
    parse: (body: unknown) => T,
    body?: string | FormData,
  ): Promise<T> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new ClickUpError('unknown', 'UPSTREAM_UNKNOWN'))
      }, timeout)
    })
    const operation = async () => {
      const response = await transport(`${API_ORIGIN}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Authorization: token,
          ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body === undefined ? {} : { body }),
      })
      if (controller.signal.aborted) {
        cancelResponse(response)
        unknown()
      }
      if (response.redirected) {
        cancelResponse(response)
        unknown()
      }
      if (response.status === 429) {
        cancelResponse(response)
        throw new ClickUpError(
          'rate_limited',
          'UPSTREAM_RATE_LIMITED',
          retryAfter(response.headers, now()),
        )
      }
      if ([400, 401, 403, 404, 413, 422].includes(response.status)) {
        cancelResponse(response)
        throw new ClickUpError(
          'rejected',
          response.status === 401 || response.status === 403
            ? 'UPSTREAM_CONFIGURATION'
            : 'UPSTREAM_REJECTED',
        )
      }
      if (!response.ok) {
        cancelResponse(response)
        unknown()
      }
      return parse(await readJson(response, controller.signal))
    }
    try {
      return await Promise.race([operation(), deadline])
    } catch (error) {
      if (error instanceof ClickUpError) throw error
      // Do not retain a provider exception, request URL, cause, body, or credential.
      throw new ClickUpError('unknown', 'UPSTREAM_UNKNOWN')
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    available: true,
    reason: null,
    getList: async (listId) =>
      request(`/list/${numericId(listId)}`, 10_000, (body) => {
        const list = object(body)
        return {
          id: id(list.id),
          name: text(list.name, 4096),
          space: { id: id(object(list.space).id) },
          statuses: array(list.statuses).map((value) => {
            const status = object(value)
            return {
              status: text(status.status, 4096),
              ...(status.type === undefined ? {} : { type: text(status.type, 128) }),
            }
          }),
        }
      }),
    getFields: async (listId) =>
      request(`/list/${numericId(listId)}/field?include_applied_objects=true`, 10_000, (body) =>
        array(object(body).fields).map(parseField),
      ),
    getTaskTypes: async (workspaceId) =>
      request(`/team/${numericId(workspaceId)}/custom_item`, 10_000, (body) =>
        array(object(body).custom_items).map((value) => {
          const type = object(value)
          return { id: integer(type.id), name: text(type.name, 4096) }
        }),
      ),
    getSpaceTags: async (spaceId) =>
      request(`/space/${numericId(spaceId)}/tag`, 10_000, (body) => {
        const tags = array(object(body).tags).map((value) => text(object(value).name, 255))
        if (tags.length > 500 || new Set(tags).size !== tags.length) unknown()
        return tags
      }),
    getTask: async (taskId) => {
      assertClickUpTaskId(taskId)
      return request(
        `/task/${encodeURIComponent(taskId)}?include_markdown_description=true`,
        10_000,
        parseTask,
      )
    },
    listTasks: async (listId, query = {}) => {
      numericId(listId)
      const page = query.page ?? 0
      if (
        !Number.isSafeInteger(page) ||
        page < 0 ||
        (query.includeClosed !== undefined && typeof query.includeClosed !== 'boolean')
      )
        invalidInput()
      return request(
        `/list/${listId}/task?page=${page}&include_closed=${query.includeClosed ?? false}&include_markdown_description=true`,
        10_000,
        (body) => {
          const result = object(body)
          const tasks = array(result.tasks)
          if (
            tasks.length > 100 ||
            (result.last_page !== undefined && typeof result.last_page !== 'boolean')
          )
            unknown()
          return {
            tasks: tasks.map(parseTask),
            ...(result.last_page === undefined ? {} : { last_page: result.last_page as boolean }),
          }
        },
      )
    },
    createTask: async (listId, input) => {
      numericId(listId)
      if (
        !input ||
        typeof input.name !== 'string' ||
        typeof input.markdown_content !== 'string' ||
        typeof input.status !== 'string' ||
        !Number.isSafeInteger(input.custom_item_id) ||
        input.custom_item_id < 0 ||
        !Array.isArray(input.custom_fields) ||
        !Array.isArray(input.tags) ||
        input.tags.length > 3 ||
        new Set(input.tags).size !== input.tags.length ||
        input.tags.some((tag) => typeof tag !== 'string' || tag.length > 255 || !tag.trim())
      )
        invalidInput()
      const custom_fields = input.custom_fields.map((field) => {
        if (
          !field ||
          typeof field.id !== 'string' ||
          field.id.length === 0 ||
          !['string', 'number', 'boolean'].includes(typeof field.value) ||
          (typeof field.value === 'number' && !Number.isFinite(field.value))
        )
          invalidInput()
        return { id: field.id, value: field.value }
      })
      return request(
        `/list/${listId}/task`,
        30_000,
        (body) => ({ id: taskId(object(body).id) }),
        JSON.stringify({
          name: input.name,
          markdown_content: input.markdown_content,
          custom_item_id: input.custom_item_id,
          status: input.status,
          custom_fields,
          tags: input.tags,
        }),
      )
    },
    uploadAttachment: async (taskId, input) => {
      assertClickUpTaskId(taskId)
      if (
        !input ||
        !(input.bytes instanceof Blob || input.bytes instanceof Uint8Array) ||
        typeof input.filename !== 'string' ||
        [...input.filename].length < 1 ||
        [...input.filename].length > 255 ||
        /[\x00-\x1f\x7f]/.test(input.filename) ||
        typeof input.contentType !== 'string' ||
        input.contentType.length > 127 ||
        !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(input.contentType)
      )
        invalidInput()
      const bytes = input.bytes instanceof Blob ? input.bytes : Uint8Array.from(input.bytes)
      const file = new Blob([bytes], { type: input.contentType })
      const form = new FormData()
      form.append('attachment', file, input.filename)
      return request(
        `/task/${encodeURIComponent(taskId)}/attachment`,
        60_000,
        parseAttachment,
        form,
      )
    },
  }
}
