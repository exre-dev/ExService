import type {
  ClickUpServices,
  ClickUpField,
  ClickUpCreateTask,
} from '../../modules/clickup/service.js'
import { FEEDBACK_LIMITS } from '@workspace/common/feedback-content'
import { FeedbackError } from './errors.js'
import { FIELD_IDS, loadFieldDefinitions, type FieldDefinition } from './field-config.js'
import type { FeedbackForm, FeedbackOptions } from './validation.js'
import type { FrozenTaskPayload } from './frozen-payload.js'

export const TARGET = Object.freeze({
  workspace: '90181517066',
  list: '901810170816',
  space: '90185812083',
  bug: 1001,
  feature: 0,
  asset: 1009,
  request: 1005,
  content: 1007,
  campaign: 1008,
  status: '新增',
  type: FIELD_IDS.type,
  department: FIELD_IDS.department,
  largeFile: FIELD_IDS.largeFile,
  user: '346759da-1bc8-4ae7-aa0c-020102bc287b',
})
export const KINDS = ['bug', 'feature', 'asset', 'request', 'content', 'campaign'] as const
export const COMMUNITY_TARGET = Object.freeze({
  workspace: TARGET.workspace,
  list: '1100500000004310',
  space: '90186006983',
  status: '待处理',
  taskType: 1003,
  user: TARGET.user,
  largeFile: TARGET.largeFile,
})
export type CommunityTarget = Readonly<{
  workspace: string
  list: string
  space: string
  status: string
  taskType: number
  user: string
  largeFile: string
}>
export const COMMUNITY_KINDS = ['suggestion', 'complaint'] as const
export type FeedbackArea = 'development' | 'community'
export const areaOf = (kind: FeedbackForm['kind']): FeedbackArea =>
  kind === 'suggestion' || kind === 'complaint' ? 'community' : 'development'
const targetOf = (kind: FeedbackForm['kind'], communityTarget: CommunityTarget) =>
  areaOf(kind) === 'community' ? communityTarget : TARGET
const taskTypeOf = (kind: FeedbackForm['kind'], communityTarget: CommunityTarget): number =>
  areaOf(kind) === 'community'
    ? communityTarget.taskType
    : (TARGET[kind as keyof typeof TARGET] as number)
const ACTION_TAG = { add: '新增', modify: '修改', delete: '删除', other: null } as const
type Kind = FeedbackForm['kind']
export function frozenTaskInput(
  form: FeedbackForm,
  markdown: string,
  nickname: string,
  userId: string,
  communityTarget: CommunityTarget = COMMUNITY_TARGET,
): FrozenTaskPayload {
  const fieldTypes: FrozenTaskPayload['fieldTypes'] =
    form.kind === 'complaint' && form.anonymous ? [] : ['short_text']
  if ('typeOptionId' in form && form.typeOptionId !== null) fieldTypes.push('drop_down')
  if (form.kind === 'feature' && form.departmentOptionId !== null) fieldTypes.push('drop_down')
  if (form.largeFileInfo !== null) fieldTypes.push('text')
  return {
    listId: targetOf(form.kind, communityTarget).list,
    task: taskInput(form, markdown, nickname, userId, communityTarget),
    fieldTypes,
  }
}
type MetadataState = {
  fields: FieldDefinition[]
  remote: ClickUpField[]
  types: Set<number>
  tags: Set<string>
}

function applicable(field: ClickUpField, kind: Kind, communityTarget: CommunityTarget): boolean {
  const scopes = field.applied_objects
  return (
    !scopes ||
    scopes.some(
      (scope) =>
        scope.object_type === 19 && Number(scope.object_id) === taskTypeOf(kind, communityTarget),
    )
  )
}
function configured(
  state: MetadataState,
  id: string,
  kind: Kind,
  communityTarget: CommunityTarget,
): boolean {
  const local = state.fields.find((f) => f.id === id)
  const remote = state.remote.filter((f) => f.id === id)
  if (id === (areaOf(kind) === 'community' ? communityTarget.user : TARGET.user))
    return (
      remote.length === 1 &&
      remote[0]!.type === 'short_text' &&
      applicable(remote[0]!, kind, communityTarget)
    )
  if (
    !local ||
    remote.length !== 1 ||
    remote[0]!.type !== local.type ||
    !applicable(remote[0]!, kind, communityTarget)
  )
    return false
  if (local.type !== 'drop_down') return true
  const choices = remote[0]!.type_config.options ?? []
  return local.type_config.options.every((option) =>
    choices.some((remoteOption) => remoteOption.id === option.id),
  )
}
function available(state: MetadataState, kind: Kind, communityTarget: CommunityTarget): boolean {
  if (kind !== 'feature' && !state.types.has(taskTypeOf(kind, communityTarget))) return false
  if (
    !configured(
      state,
      areaOf(kind) === 'community' ? communityTarget.user : TARGET.user,
      kind,
      communityTarget,
    )
  )
    return false
  if (
    areaOf(kind) === 'development' &&
    kind !== 'content' &&
    kind !== 'campaign' &&
    !configured(state, TARGET.type, kind, communityTarget)
  )
    return false
  if (kind === 'feature' && !configured(state, TARGET.department, kind, communityTarget))
    return false
  return (
    configured(
      state,
      areaOf(kind) === 'community' ? communityTarget.largeFile : TARGET.largeFile,
      kind,
      communityTarget,
    ) &&
    ((kind !== 'suggestion' && kind !== 'complaint') ||
      state.tags.has(kind === 'suggestion' ? '反馈' : '投诉'))
  )
}
export function createMetadata(
  clickup: ClickUpServices,
  now: () => number,
  definitions: FieldDefinition[] = loadFieldDefinitions(),
  communityTarget: CommunityTarget = COMMUNITY_TARGET,
) {
  const cache: Partial<Record<FeedbackArea, { state: MetadataState; expires: number }>> = {}
  const refresh: Partial<Record<FeedbackArea, Promise<MetadataState>>> = {}
  const read = async (area: FeedbackArea): Promise<MetadataState> => {
    if (!clickup.available) throw new FeedbackError('FEEDBACK_UNAVAILABLE')
    if (cache[area] && cache[area]!.expires > now()) return cache[area]!.state
    refresh[area] ??= (async () => {
      try {
        const target = area === 'community' ? communityTarget : TARGET
        const [list, remote, types, tags] = await Promise.all([
          clickup.getList(target.list),
          clickup.getFields(target.list),
          clickup.getTaskTypes(target.workspace).catch(() => []),
          clickup.getSpaceTags(target.space).catch(() => []),
        ])
        if (
          list.id !== target.list ||
          list.space.id !== target.space ||
          !list.statuses.some((s) => s.status === target.status)
        )
          throw new Error('Invalid target list')
        const areaDefinitions =
          area === 'community'
            ? definitions.filter((f) => f.id === communityTarget.largeFile)
            : definitions
        const ids = new Set(areaDefinitions.map((f) => f.id))
        if (
          ids.size !== areaDefinitions.length ||
          [...ids].some(
            (id) => ![...Object.values(FIELD_IDS), communityTarget.largeFile].includes(id),
          )
        )
          throw new Error('Invalid field definitions')
        const state = {
          fields: areaDefinitions,
          remote,
          types: new Set(types.map((t) => t.id)),
          tags: new Set(tags),
        }
        cache[area] = { state, expires: now() + 60000 }
        return state
      } catch {
        delete cache[area]
        throw new FeedbackError('FEEDBACK_UNAVAILABLE')
      } finally {
        delete refresh[area]
      }
    })()
    return refresh[area]
  }
  return {
    async options(area: FeedbackArea = 'development'): Promise<FeedbackOptions> {
      const kinds = area === 'community' ? COMMUNITY_KINDS : KINDS
      try {
        const state = await read(area)
        return {
          available: true,
          reason: null,
          fields: state.fields,
          kinds: kinds.map((kind) => ({
            kind,
            available: available(state, kind, communityTarget),
            reason: available(state, kind, communityTarget) ? null : 'configuration_invalid',
          })),
          actions:
            area === 'community'
              ? []
              : (Object.keys(ACTION_TAG) as Array<keyof typeof ACTION_TAG>).map((action) => ({
                  action,
                  available: ACTION_TAG[action] === null || state.tags.has(ACTION_TAG[action]),
                  reason:
                    ACTION_TAG[action] === null || state.tags.has(ACTION_TAG[action])
                      ? null
                      : 'tag_missing',
                })),
          limits: { ...FEEDBACK_LIMITS, largeFileInfoBytes: 16384 },
        }
      } catch {
        const reason = clickup.reason ?? 'upstream_unavailable'
        return {
          available: false,
          reason,
          fields: [],
          kinds: kinds.map((kind) => ({ kind, available: false, reason })),
          actions:
            area === 'community'
              ? []
              : (Object.keys(ACTION_TAG) as Array<keyof typeof ACTION_TAG>).map((action) => ({
                  action,
                  available: false,
                  reason: 'tag_missing',
                })),
          limits: { ...FEEDBACK_LIMITS, largeFileInfoBytes: 16384 },
        }
      }
    },
    async preflight(form: FeedbackForm): Promise<void> {
      const state = await read(areaOf(form.kind))
      if (!available(state, form.kind, communityTarget))
        throw new FeedbackError('FEEDBACK_UNAVAILABLE')
      const fields: Array<[string, string | null]> = []
      if ('typeOptionId' in form) fields.push([TARGET.type, form.typeOptionId])
      if (form.kind === 'feature') fields.push([TARGET.department, form.departmentOptionId])
      for (const [id, value] of fields) {
        if (
          value !== null &&
          !state.fields
            .find((field) => field.id === id)!
            .type_config.options.some((option) => option.id === value)
        )
          throw new FeedbackError('FEEDBACK_INVALID_INPUT')
      }
      if ('action' in form) {
        const tag = ACTION_TAG[form.action]
        if (tag !== null && !state.tags.has(tag)) throw new FeedbackError('FEEDBACK_UNAVAILABLE')
      }
    },
  }
}
export function taskInput(
  form: FeedbackForm,
  markdown: string,
  nickname: string,
  userId: string,
  communityTarget: CommunityTarget = COMMUNITY_TARGET,
): ClickUpCreateTask {
  const custom_fields: ClickUpCreateTask['custom_fields'] =
    form.kind === 'complaint' && form.anonymous
      ? []
      : [
          {
            id: areaOf(form.kind) === 'community' ? communityTarget.user : TARGET.user,
            value: `${nickname} (${userId})`,
          },
        ]
  if ('typeOptionId' in form && form.typeOptionId !== null)
    custom_fields.push({ id: TARGET.type, value: form.typeOptionId })
  if (form.kind === 'feature' && form.departmentOptionId !== null)
    custom_fields.push({ id: TARGET.department, value: form.departmentOptionId })
  if (form.largeFileInfo !== null)
    custom_fields.push({
      id: areaOf(form.kind) === 'community' ? communityTarget.largeFile : TARGET.largeFile,
      value: form.largeFileInfo,
    })
  const tag =
    form.kind === 'suggestion'
      ? '反馈'
      : form.kind === 'complaint'
        ? '投诉'
        : 'action' in form
          ? ACTION_TAG[form.action]
          : null
  return {
    name: form.title,
    markdown_content: markdown,
    custom_item_id: taskTypeOf(form.kind, communityTarget),
    status: targetOf(form.kind, communityTarget).status,
    custom_fields,
    tags: tag ? [tag] : [],
  }
}
