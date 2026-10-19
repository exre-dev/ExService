import type { ClickUpCreateTask, ClickUpTask } from '../../modules/clickup/service.js'
import { equivalentMarkdown } from './markdown.js'
import { sha256, type FeedbackForm } from './validation.js'
import { COMMUNITY_TARGET, type CommunityTarget } from './metadata.js'

export type FrozenTaskPayload = {
  listId: string
  task: ClickUpCreateTask
  fieldTypes: Array<'short_text' | 'drop_down' | 'text'>
}
export type CommunityProfile = Readonly<{
  listId: string
  taskType: number
  status: string
  userFieldId: string
  largeFileFieldId: string
}>
export type ValidatedFrozenTask = {
  payload: FrozenTaskPayload
  formVersion: 2 | 3
  contentFormat: 'markdown' | undefined
  userFieldIds: ReadonlySet<string>
}
export type FrozenTaskColumns = {
  task_payload_json: string
  task_payload_sha256: string
  target_list_id: string
  final_markdown: string
  nickname_snapshot: string
  user_id: string
  form_version: number
}

// Accepted generations are append-only. Keep these literal IDs when the active
// ClickUp target changes; an anonymous frozen payload contains no identity ID.
const historicalCommunityProfiles: readonly CommunityProfile[] = Object.freeze([
  Object.freeze({
    listId: '1100500000004310',
    taskType: 1003,
    status: '待处理',
    userFieldId: '346759da-1bc8-4ae7-aa0c-020102bc287b',
    largeFileFieldId: '4f7eb8a3-5de7-4f3b-87bb-8be5dc2d573f',
  }),
])
export function activeCommunityProfile(
  target: CommunityTarget = COMMUNITY_TARGET,
): CommunityProfile {
  return {
    listId: target.list,
    taskType: target.taskType,
    status: target.status,
    userFieldId: target.user,
    largeFileFieldId: target.largeFile,
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const listId = /^\d{1,20}$/
const operationTags = new Set(['新增', '修改', '删除'])
function corrupt(): never {
  throw new Error('Support record invariant failed')
}
function keys(value: unknown, expected: string): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === expected
  )
}
function profilesFor(payload: FrozenTaskPayload, active: CommunityProfile): CommunityProfile[] {
  return [...historicalCommunityProfiles, active].filter(
    (profile) =>
      profile.listId === payload.listId &&
      profile.taskType === payload.task.custom_item_id &&
      profile.status === payload.task.status,
  )
}

export function validateStoredTask(
  row: FrozenTaskColumns,
  form: FeedbackForm,
  active: CommunityProfile = activeCommunityProfile(),
): ValidatedFrozenTask {
  if (row.task_payload_sha256 !== sha256(row.task_payload_json)) corrupt()
  let payload: FrozenTaskPayload
  try {
    payload = JSON.parse(row.task_payload_json) as FrozenTaskPayload
  } catch {
    corrupt()
  }
  if (
    !keys(payload, 'fieldTypes,listId,task') ||
    !listId.test(payload.listId) ||
    payload.listId !== row.target_list_id ||
    !keys(payload.task, 'custom_fields,custom_item_id,markdown_content,name,status,tags') ||
    payload.task.name !== form.title ||
    payload.task.markdown_content !== row.final_markdown ||
    !Number.isSafeInteger(payload.task.custom_item_id) ||
    payload.task.custom_item_id < 0 ||
    typeof payload.task.status !== 'string' ||
    !payload.task.status ||
    payload.task.status.length > 255 ||
    !Array.isArray(payload.task.custom_fields) ||
    !Array.isArray(payload.fieldTypes) ||
    !Array.isArray(payload.task.tags)
  )
    corrupt()

  const community = form.kind === 'suggestion' || form.kind === 'complaint'
  if (row.form_version !== (community ? 3 : 2)) corrupt()
  const profiles = community ? profilesFor(payload, active) : []
  if (community && profiles.length === 0) corrupt()
  const anonymous = form.kind === 'complaint' && form.anonymous
  if (anonymous ? row.nickname_snapshot !== '' : !row.nickname_snapshot) corrupt()
  const expected: Array<{
    type: FrozenTaskPayload['fieldTypes'][number]
    value: string
    ids?: ReadonlySet<string>
  }> = []
  if (!anonymous)
    expected.push({
      type: 'short_text',
      value: `${row.nickname_snapshot} (${row.user_id})`,
      ids: community ? new Set(profiles.map((p) => p.userFieldId)) : undefined,
    })
  if ('typeOptionId' in form && form.typeOptionId !== null)
    expected.push({ type: 'drop_down', value: form.typeOptionId })
  if (form.kind === 'feature' && form.departmentOptionId !== null)
    expected.push({ type: 'drop_down', value: form.departmentOptionId })
  if (form.largeFileInfo !== null)
    expected.push({
      type: 'text',
      value: form.largeFileInfo,
      ids: community ? new Set(profiles.map((p) => p.largeFileFieldId)) : undefined,
    })
  if (
    payload.fieldTypes.length !== expected.length ||
    payload.task.custom_fields.length !== expected.length ||
    expected.some(
      (field, index) =>
        payload.fieldTypes[index] !== field.type ||
        !keys(payload.task.custom_fields[index], 'id,value') ||
        !uuid.test(payload.task.custom_fields[index]!.id) ||
        payload.task.custom_fields[index]!.value !== field.value ||
        (field.ids !== undefined && !field.ids.has(payload.task.custom_fields[index]!.id)),
    ) ||
    new Set(payload.task.custom_fields.map((field) => field.id)).size !== expected.length
  )
    corrupt()
  if (
    community &&
    !profiles.some(
      (profile) =>
        (anonymous || payload.task.custom_fields[0]?.id === profile.userFieldId) &&
        (form.largeFileInfo === null ||
          payload.task.custom_fields.at(-1)?.id === profile.largeFileFieldId),
    )
  )
    corrupt()
  const requiredTag =
    form.kind === 'suggestion' ? '反馈' : form.kind === 'complaint' ? '投诉' : null
  const tagCount = community ? 1 : 'action' in form && form.action !== 'other' ? 1 : 0
  if (
    payload.task.tags.length !== tagCount ||
    (requiredTag && payload.task.tags[0] !== requiredTag) ||
    payload.task.tags.some(
      (tag) => typeof tag !== 'string' || !tag || tag.length > 255 || /[\x00-\x1f\x7f]/.test(tag),
    )
  )
    corrupt()
  const userFieldIds = new Set(
    [...historicalCommunityProfiles, active].map((profile) => profile.userFieldId),
  )
  return {
    payload,
    formVersion: community ? 3 : 2,
    contentFormat: form.contentFormat,
    userFieldIds,
  }
}

export function matchesFrozenTask(
  remote: ClickUpTask,
  frozen: ValidatedFrozenTask,
  taskId: string,
): boolean {
  const { payload } = frozen
  const expected = payload.task
  if (
    remote.id !== taskId ||
    remote.list.id !== payload.listId ||
    (remote.custom_item_id ?? 0) !== expected.custom_item_id ||
    remote.name !== expected.name ||
    remote.status.status !== expected.status ||
    !equivalentMarkdown(
      expected.markdown_content,
      remote.markdown_description,
      frozen.contentFormat,
    )
  )
    return false
  const controlled = new Set([
    ...operationTags,
    ...expected.tags,
    ...(frozen.formVersion === 3 ? ['反馈', '投诉'] : []),
  ])
  const actualTags = remote.tags.filter((tag) => controlled.has(tag))
  if (
    actualTags.length !== expected.tags.length ||
    actualTags.some((tag) => !expected.tags.includes(tag))
  )
    return false
  if (
    frozen.formVersion === 3 &&
    !payload.fieldTypes.includes('short_text') &&
    remote.custom_fields.some(
      (field) =>
        frozen.userFieldIds.has(field.id) &&
        (field.hasUnsupportedValue === true ||
          (field.value !== null && field.value !== undefined && field.value !== '')),
    )
  )
    return false
  return expected.custom_fields.every((wanted, index) => {
    const fields = remote.custom_fields.filter((field) => field.id === wanted.id)
    if (fields.length !== 1) return false
    const field = fields[0]!
    const wantedType = payload.fieldTypes[index]
    if (field.type !== wantedType || field.hasUnsupportedValue === true) return false
    if (field.type !== 'drop_down') return field.value === wanted.value
    const options = field.type_config.options ?? []
    const matching =
      typeof field.value === 'number'
        ? options.filter(
            (option) =>
              (typeof option.orderindex === 'number' ||
                (typeof option.orderindex === 'string' && /^\d+$/.test(option.orderindex))) &&
              Number.isSafeInteger(Number(option.orderindex)) &&
              Number(option.orderindex) === field.value,
          )
        : options.filter((option) => option.id === field.value)
    return matching.length === 1 && matching[0]!.id === wanted.value
  })
}
